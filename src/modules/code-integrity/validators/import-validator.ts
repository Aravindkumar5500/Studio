import ts from "typescript";
import type { CodeDiagnostic } from "../domain/types";

export const REACT_HOOKS = new Set([
  "useState",
  "useEffect",
  "useMemo",
  "useCallback",
  "useRef",
  "useContext",
  "useReducer",
  "useId",
  "useTransition",
  "useDeferredValue",
  "useLayoutEffect",
  "useImperativeHandle",
  "useDebugValue",
]);

export const REACT_TYPES = new Set([
  "ReactNode",
  "ReactElement",
  "FC",
  "ComponentProps",
  "CSSProperties",
  "HTMLAttributes",
  "ButtonHTMLAttributes",
  "InputHTMLAttributes",
  "FormEvent",
  "ChangeEvent",
  "MouseEvent",
]);

export const COMMON_LUCIDE_ICONS = new Set([
  "Search",
  "ArrowRight",
  "ArrowLeft",
  "ArrowUp",
  "ArrowDown",
  "Sparkles",
  "Check",
  "CheckCircle",
  "CheckCircle2",
  "X",
  "XCircle",
  "ChevronDown",
  "ChevronUp",
  "ChevronLeft",
  "ChevronRight",
  "Calendar",
  "Clock",
  "User",
  "Users",
  "Mail",
  "Phone",
  "Building",
  "MapPin",
  "Plus",
  "Minus",
  "Trash",
  "Trash2",
  "Filter",
  "Sliders",
  "SlidersHorizontal",
  "Star",
  "Heart",
  "Share2",
  "ExternalLink",
  "Eye",
  "EyeOff",
  "Lock",
  "Unlock",
  "Bell",
  "Menu",
  "MoreHorizontal",
  "MoreVertical",
  "RefreshCw",
  "Download",
  "Upload",
  "Copy",
  "Edit",
  "Edit2",
  "Edit3",
  "Layers",
  "LayoutDashboard",
  "Settings",
  "DollarSign",
  "TrendingUp",
  "TrendingDown",
  "BarChart",
  "BarChart2",
  "BarChart3",
  "PieChart",
  "ShoppingBag",
  "ShoppingCart",
  "Package",
  "Tag",
  "Globe",
  "Zap",
  "Shield",
  "ShieldCheck",
  "AlertCircle",
  "AlertTriangle",
  "Info",
  "HelpCircle",
]);

export interface ImportValidationOutcome {
  diagnostics: CodeDiagnostic[];
  missingReactHooks: string[];
  missingLucideIcons: string[];
  missingNextLink: boolean;
  missingNextImage: boolean;
  repairedSource: string;
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

  const sourceFile = ts.createSourceFile(
    filePath,
    source,
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

  const missingLucideIcons: string[] = [];
  for (const [tag, node] of referencedJsxTags) {
    if (
      COMMON_LUCIDE_ICONS.has(tag) &&
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
  let repairedSource = source;

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
    .replace(/(from\s+["'])src\/([^"']+)\1/g, "$1@/$2")
    // Map bare "components/...", "data/...", "lib/...", "theme/..." to "@/..."
    .replace(/(from\s+["'])(components|data|lib|theme)\/([^"']+)\1/g, "$1@/$2/$3")
    // Strip trailing .tsx/.jsx/.ts/.js from local/alias imports
    .replace(/(from\s+["'](?:@\/|\.\.?\/)[^"']+?)\.(tsx|jsx|ts|js)(["'])/g, "$1$3");

  return {
    diagnostics,
    missingReactHooks,
    missingLucideIcons,
    missingNextLink,
    missingNextImage,
    repairedSource,
  };
}
