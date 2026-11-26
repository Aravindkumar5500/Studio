import * as React from "react";
import ts from "typescript";
import type { CodeDiagnostic } from "../domain/types";

/** Dynamically inspect installed React exports for hooks (`use*`). */
function getReactHooks(): Set<string> {
  const hooks = new Set<string>();
  for (const key of Object.keys(React)) {
    if (/^use[A-Z]/.test(key)) hooks.add(key);
  }
  return hooks;
}

export const REACT_HOOKS: Set<string> = getReactHooks();

let cachedLucideIcons: Set<string> | null = null;

/**
 * Dynamically reads all PascalCase icon exports from the installed `lucide-react`
 * package when running on Node.js, avoiding hardcoded icon allowlists.
 */
function getLucideExports(): Set<string> {
  if (cachedLucideIcons) return cachedLucideIcons;
  const icons = new Set<string>();
  if (typeof process !== "undefined" && Boolean(process.versions?.node)) {
    try {
      const nodeRequire = eval("require") as NodeRequire;
      const lucide = nodeRequire("lucide-react") as Record<string, unknown>;
      for (const key of Object.keys(lucide)) {
        if (/^[A-Z][A-Za-z0-9]+$/.test(key) && key !== "Icon" && !key.endsWith("Icon")) {
          icons.add(key);
        }
      }
    } catch {
      // Non-fatal if lucide-react cannot be resolved in current runtime
    }
  }
  cachedLucideIcons = icons;
  return icons;
}

export interface ImportValidationOutcome {
  diagnostics: CodeDiagnostic[];
  missingReactHooks: string[];
  missingLucideIcons: string[];
  missingNextLink: boolean;
  missingNextImage: boolean;
  repairedSource: string;
}

/**
 * Deduplicates conflicting import bindings across declarations (e.g. `import Link from "next/link"`
 * colliding with `import { Link, Menu } from "lucide-react"`) and fixes `<Link href="...">`
 * accidentally imported from `lucide-react` instead of `next/link`.
 *
 * When `Link` is used as both a navigation element (with `href`) and a Lucide icon, the
 * navigation `Link` from `next/link` wins and the Lucide `Link` is replaced with `Link2`.
 */
function deduplicateAndResolveImportConflicts(source: string, filePath: string): string {
  const sf = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  // Detect whether JSX uses <Link href=...> (navigation link rather than Lucide Link icon)
  let hasJsxLinkWithHref = false;
  // Detect whether JSX uses <Link> without href (icon usage)
  let hasJsxLinkAsIcon = false;
  function checkJsxLink(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      if (node.tagName.getText(sf) === "Link") {
        const hasHref = node.attributes.properties.some(
          (attr) => ts.isJsxAttribute(attr) && attr.name.getText(sf) === "href",
        );
        if (hasHref) {
          hasJsxLinkWithHref = true;
        } else {
          hasJsxLinkAsIcon = true;
        }
      }
    }
    ts.forEachChild(node, checkJsxLink);
  }
  checkJsxLink(sf);

  const importDecls = sf.statements.filter(ts.isImportDeclaration);
  if (importDecls.length === 0) return source;

  const hasNextLinkImport = importDecls.some(
    (d) => d.moduleSpecifier.getText(sf).replace(/['"]/g, "") === "next/link",
  );

  const hasLucideLinkImport = importDecls.some((d) => {
    const spec = d.moduleSpecifier.getText(sf).replace(/['"]/g, "");
    if (spec !== "lucide-react") return false;
    const clause = d.importClause;
    if (!clause?.namedBindings || !ts.isNamedImports(clause.namedBindings)) return false;
    return clause.namedBindings.elements.some((el) => el.name.text === "Link");
  });

  // Determine whether Link is used in a navigation context (next/link takes precedence)
  const linkConflict = hasLucideLinkImport && (hasNextLinkImport || hasJsxLinkWithHref);

  // Track seen local binding names; prefer next/link for `Link` if both next/link and lucide-react exist
  const seenBindings = new Set<string>();
  if (hasNextLinkImport || hasJsxLinkWithHref) {
    seenBindings.add("Link");
  }

  const edits: { start: number; end: number; replacement: string }[] = [];
  let needInjectNextLink = false;
  // If Link icon usage exists and there's a conflict, we need to alias it to Link2
  let needAliasLinkIcon: boolean = linkConflict && hasJsxLinkAsIcon;

  for (const decl of importDecls) {
    const clause = decl.importClause;
    if (!clause || clause.isTypeOnly) continue;

    const moduleSpec = decl.moduleSpecifier.getText(sf).replace(/['"]/g, "");
    const isNextLink = moduleSpec === "next/link";
    const isLucide = moduleSpec === "lucide-react";

    let changed = false;
    let defaultName = clause.name?.text ?? null;

    if (defaultName) {
      if (isNextLink) {
        // Reserve Link for next/link
        seenBindings.add(defaultName);
      } else if (seenBindings.has(defaultName)) {
        defaultName = null;
        changed = true;
      } else {
        seenBindings.add(defaultName);
      }
    }

    let keptNamed: string[] | null = null;
    let namespaceName: string | null = null;

    if (clause.namedBindings) {
      if (ts.isNamedImports(clause.namedBindings)) {
        keptNamed = [];
        for (const el of clause.namedBindings.elements) {
          const localName = el.name.text;
          if (localName === "Link" && isLucide && (hasNextLinkImport || hasJsxLinkWithHref)) {
            changed = true;
            if (!hasNextLinkImport && hasJsxLinkWithHref) {
              needInjectNextLink = true;
            }
            // If used as icon too, add Link2 alias instead of dropping entirely
            if (hasJsxLinkAsIcon && !seenBindings.has("Link2")) {
              keptNamed.push("Link2");
              seenBindings.add("Link2");
              needAliasLinkIcon = true;
            }
            continue;
          }
          if (seenBindings.has(localName)) {
            changed = true;
            continue;
          }
          seenBindings.add(localName);
          keptNamed.push(el.getText(sf));
        }
      } else if (ts.isNamespaceImport(clause.namedBindings)) {
        const ns = clause.namedBindings.name.text;
        if (seenBindings.has(ns)) {
          changed = true;
        } else {
          seenBindings.add(ns);
          namespaceName = ns;
        }
      }
    }

    if (!changed) continue;

    const parts: string[] = [];
    if (defaultName) parts.push(defaultName);
    if (namespaceName) parts.push(`* as ${namespaceName}`);
    if (keptNamed && keptNamed.length > 0) parts.push(`{ ${keptNamed.join(", ")} }`);

    const start = decl.getStart(sf);
    let end = decl.getEnd();
    if (parts.length === 0) {
      // Remove entire empty import line including trailing newline
      while (end < source.length && (source[end] === "\r" || source[end] === "\n")) {
        end++;
        if (source[end - 1] === "\n") break;
      }
      edits.push({ start, end, replacement: "" });
    } else {
      edits.push({
        start,
        end,
        replacement: `import ${parts.join(", ")} from ${decl.moduleSpecifier.getText(sf)};`,
      });
    }
  }

  let next = source;
  if (edits.length > 0) {
    // Apply from end to start so offsets stay valid
    for (const edit of [...edits].sort((a, b) => b.start - a.start)) {
      next = next.slice(0, edit.start) + edit.replacement + next.slice(edit.end);
    }
  }

  if (needInjectNextLink) {
    const linkImport = `import Link from "next/link";\n`;
    if (/^\s*["']use client["'];?\s*\n/m.test(next)) {
      next = next.replace(/^\s*["']use client["'];?\s*\n/m, (m) => `${m}${linkImport}`);
    } else {
      next = `${linkImport}${next}`;
    }
  }

  // Replace <Link ... /> icon usages with <Link2 ... /> when aliased
  if (needAliasLinkIcon) {
    // Replace JSX <Link (without href) with <Link2, and </Link> icon closings
    // We do a targeted replacement: <Link followed by space or /> but NOT href
    next = next.replace(
      /(<\/?)Link(\s*(?:\/>|>))/g,
      (match, open, close, offset) => {
        // Check if this is a navigation Link (has href= nearby) or icon Link
        const after = next.slice(offset, offset + match.length + 100);
        const isNav = /^<\/?Link[\s>]/.test(match) && /\bhref\s*=/.test(after.slice(0, after.indexOf(">")));
        if (isNav) return match;
        return `${open}Link2${close}`;
      },
    );
  }

  return next;
}

/**
 * Inspects source code via TypeScript AST to detect symbols used without corresponding imports.
 * Automatically generates clean drop-in import fixes.
 */
export function validateAndRepairImports(filePath: string, source: string): ImportValidationOutcome {
  const isTsxOrJsx = /\.(tsx|jsx|ts|js)$/.test(filePath);
  if (!isTsxOrJsx) {
    return {
      diagnostics: [],
      missingReactHooks: [],
      missingLucideIcons: [],
      missingNextLink: false,
      missingNextImage: false,
      repairedSource: source,
    };
  }

  const normalizedInput = deduplicateAndResolveImportConflicts(source, filePath);

  const sourceFile = ts.createSourceFile(
    filePath,
    normalizedInput,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  const importedSymbols = new Set<string>();
  const declaredSymbols = new Set<string>();
  const referencedIdentifiers = new Map<string, ts.Node>();
  const referencedJsxTags = new Map<string, ts.Node>();

  let hasReactDefaultImport = false;
  let reactImportDecl: ts.ImportDeclaration | null = null;
  let lucideImportDecl: ts.ImportDeclaration | null = null;
  let nextLinkImportDecl: ts.ImportDeclaration | null = null;
  let nextImageImportDecl: ts.ImportDeclaration | null = null;

  // 1. Collect all existing imports
  for (const stmt of sourceFile.statements) {
    if (ts.isImportDeclaration(stmt)) {
      const moduleSpecifier = stmt.moduleSpecifier.getText(sourceFile).replace(/['"]/g, "");
      if (moduleSpecifier === "react") reactImportDecl = stmt;
      if (moduleSpecifier === "lucide-react") lucideImportDecl = stmt;
      if (moduleSpecifier === "next/link") nextLinkImportDecl = stmt;
      if (moduleSpecifier === "next/image") nextImageImportDecl = stmt;

      const importClause = stmt.importClause;
      if (importClause) {
        if (importClause.name) {
          importedSymbols.add(importClause.name.text);
          if (moduleSpecifier === "react" && importClause.name.text === "React") {
            hasReactDefaultImport = true;
          }
        }
        if (importClause.namedBindings) {
          if (ts.isNamedImports(importClause.namedBindings)) {
            for (const el of importClause.namedBindings.elements) {
              importedSymbols.add(el.name.text);
            }
          } else if (ts.isNamespaceImport(importClause.namedBindings)) {
            importedSymbols.add(importClause.namedBindings.name.text);
            if (moduleSpecifier === "react" && importClause.namedBindings.name.text === "React") {
              hasReactDefaultImport = true;
            }
          }
        }
      }
    }
  }

  // 2. Collect locally declared symbols
  function collectDeclarations(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name) {
      declaredSymbols.add(node.name.text);
    } else if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      declaredSymbols.add(node.name.text);
    } else if (ts.isClassDeclaration(node) && node.name) {
      declaredSymbols.add(node.name.text);
    } else if (ts.isInterfaceDeclaration(node)) {
      declaredSymbols.add(node.name.text);
    } else if (ts.isTypeAliasDeclaration(node)) {
      declaredSymbols.add(node.name.text);
    } else if (ts.isParameter(node) && ts.isIdentifier(node.name)) {
      declaredSymbols.add(node.name.text);
    }
    ts.forEachChild(node, collectDeclarations);
  }
  collectDeclarations(sourceFile);

  // 3. Collect referenced identifiers and JSX tags
  function scanUsages(node: ts.Node) {
    if (ts.isIdentifier(node)) {
      const parent = node.parent;
      // Skip import clauses and property declarations
      if (
        !ts.isImportSpecifier(parent) &&
        !ts.isImportClause(parent) &&
        !ts.isPropertyAssignment(parent) &&
        !ts.isPropertyAccessExpression(parent) ||
        (ts.isPropertyAccessExpression(parent) && parent.expression === node)
      ) {
        if (!referencedIdentifiers.has(node.text)) {
          referencedIdentifiers.set(node.text, node);
        }
      }
    }

    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(sourceFile);
      if (/^[A-Z]/.test(tagName) && !referencedJsxTags.has(tagName)) {
        referencedJsxTags.set(tagName, node);
      }
    }

    ts.forEachChild(node, scanUsages);
  }
  scanUsages(sourceFile);

  // 4. Identify missing symbols
  const missingReactHooks: string[] = [];
  const diagnostics: CodeDiagnostic[] = [];

  for (const hook of REACT_HOOKS) {
    if (referencedIdentifiers.has(hook) && !importedSymbols.has(hook) && !declaredSymbols.has(hook)) {
      const node = referencedIdentifiers.get(hook)!;
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      missingReactHooks.push(hook);
      diagnostics.push({
        id: `diag_${filePath}_hook_${hook}`,
        code: "REACT_HOOK_NOT_IMPORTED",
        severity: "error",
        filePath,
        line: line + 1,
        column: character + 1,
        message: `React hook '${hook}' is used without being imported from 'react'.`,
        source: "ast",
        suggestedFix: `import { ${hook} } from "react";`,
      });
    }
  }

  const lucideIcons = getLucideExports();
  const missingLucideIcons: string[] = [];
  for (const [tag, node] of referencedJsxTags) {
    if (
      lucideIcons.has(tag) &&
      !importedSymbols.has(tag) &&
      !declaredSymbols.has(tag)
    ) {
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      missingLucideIcons.push(tag);
      diagnostics.push({
        id: `diag_${filePath}_icon_${tag}`,
        code: "ICON_NOT_IMPORTED",
        severity: "error",
        filePath,
        line: line + 1,
        column: character + 1,
        message: `Icon component '<${tag} />' is used without being imported from 'lucide-react'.`,
        source: "ast",
        suggestedFix: `import { ${tag} } from "lucide-react";`,
      });
    }
  }

  let missingNextLink = false;
  if (
    referencedJsxTags.has("Link") &&
    !importedSymbols.has("Link") &&
    !declaredSymbols.has("Link") &&
    !nextLinkImportDecl
  ) {
    missingNextLink = true;
    const node = referencedJsxTags.get("Link")!;
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    diagnostics.push({
      id: `diag_${filePath}_next_link`,
      code: "NEXT_LINK_NOT_IMPORTED",
      severity: "error",
      filePath,
      line: line + 1,
      column: character + 1,
      message: "Component '<Link />' is used without being imported from 'next/link'.",
      source: "ast",
      suggestedFix: `import Link from "next/link";`,
    });
  }

  let missingNextImage = false;
  if (
    referencedJsxTags.has("Image") &&
    !importedSymbols.has("Image") &&
    !declaredSymbols.has("Image") &&
    !nextImageImportDecl
  ) {
    missingNextImage = true;
    const node = referencedJsxTags.get("Image")!;
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    diagnostics.push({
      id: `diag_${filePath}_next_image`,
      code: "NEXT_IMAGE_NOT_IMPORTED",
      severity: "error",
      filePath,
      line: line + 1,
      column: character + 1,
      message: "Component '<Image />' is used without being imported from 'next/image'.",
      source: "ast",
      suggestedFix: `import Image from "next/image";`,
    });
  }

  // 5. Automatic Source Repair
  let repairedSource = normalizedInput;

  // A. Repair React Hooks
  if (missingReactHooks.length > 0) {
    if (reactImportDecl) {
      const declText = reactImportDecl.getText(sourceFile);
      const namedMatch = /import\s+(?:([A-Za-z0-9_$]+)\s*,\s*)?\{([^}]*)\}\s+from\s+["']react["']/.exec(
        declText,
      );
      if (namedMatch) {
        const defaultImport = namedMatch[1];
        const existingNamed = namedMatch[2]
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const combined = Array.from(new Set([...existingNamed, ...missingReactHooks]));
        const newImportText = defaultImport
          ? `import ${defaultImport}, { ${combined.join(", ")} } from "react";`
          : `import { ${combined.join(", ")} } from "react";`;
        repairedSource = repairedSource.replace(declText, newImportText);
      } else {
        const defaultOnlyMatch = /import\s+([A-Za-z0-9_$]+)\s+from\s+["']react["']/.exec(declText);
        if (defaultOnlyMatch) {
          const defaultImport = defaultOnlyMatch[1];
          const newImportText = `import ${defaultImport}, { ${missingReactHooks.join(", ")} } from "react";`;
          repairedSource = repairedSource.replace(declText, newImportText);
        }
      }
    } else {
      // Add react import at top (after "use client" if present)
      const importLine = `import { ${missingReactHooks.join(", ")} } from "react";\n`;
      if (/^\s*["']use client["'];?/m.test(repairedSource)) {
        repairedSource = repairedSource.replace(
          /^\s*["']use client["'];?\s*\n/m,
          (match) => `${match}${importLine}`,
        );
      } else {
        repairedSource = `${importLine}${repairedSource}`;
      }
    }
  }

  // B. Repair Lucide Icons
  if (missingLucideIcons.length > 0) {
    if (lucideImportDecl) {
      const declText = lucideImportDecl.getText(sourceFile);
      const namedMatch = /import\s+\{([^}]*)\}\s+from\s+["']lucide-react["']/.exec(declText);
      if (namedMatch) {
        const existingNamed = namedMatch[1]
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const combined = Array.from(new Set([...existingNamed, ...missingLucideIcons]));
        const newImportText = `import { ${combined.join(", ")} } from "lucide-react";`;
        repairedSource = repairedSource.replace(declText, newImportText);
      }
    } else {
      const importLine = `import { ${missingLucideIcons.join(", ")} } from "lucide-react";\n`;
      if (/^\s*["']use client["'];?/m.test(repairedSource)) {
        repairedSource = repairedSource.replace(
          /^\s*["']use client["'];?\s*\n/m,
          (match) => `${match}${importLine}`,
        );
      } else {
        repairedSource = `${importLine}${repairedSource}`;
      }
    }
  }

  // C. Repair Next Link / Image
  if (missingNextLink) {
    const importLine = `import Link from "next/link";\n`;
    repairedSource = `${importLine}${repairedSource}`;
  }
  if (missingNextImage) {
    const importLine = `import Image from "next/image";\n`;
    repairedSource = `${importLine}${repairedSource}`;
  }

  // D. Normalize local import paths and strip redundant file extensions
  repairedSource = repairedSource
    // Map "src/..." to "@/..."
    .replace(/(from\s+)(["'])src\/([^"']+)\2/g, "$1$2@/$3$2")
    // Map bare "components/...", "data/...", "lib/...", "theme/..." to "@/..."
    .replace(/(from\s+)(["'])(components|data|lib|theme)\/([^"']+)\2/g, "$1$2@/$3/$4$2")
    // Strip trailing .tsx/.jsx/.ts/.js from local/alias imports
    .replace(/(from\s+)(["'])((?:@\/|\.\.?\/)[^"']+?)\.(tsx|jsx|ts|js)\2/g, "$1$2$3$2");

  return {
    diagnostics,
    missingReactHooks,
    missingLucideIcons,
    missingNextLink,
    missingNextImage,
    repairedSource,
  };
}
