import ts from "typescript";
import type { SourceLanguage } from "@/types/firestore";
import { normalizePath } from "@/lib/hash";

const EXT_LANGUAGE: Record<string, SourceLanguage> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "jsx",
  css: "css",
  json: "json",
  md: "markdown",
  mdx: "markdown",
  html: "html",
};

export function detectLanguage(filePath: string): SourceLanguage {
  const ext = normalizePath(filePath).split(".").pop()?.toLowerCase() ?? "";
  return EXT_LANGUAGE[ext] ?? "plaintext";
}

/**
 * Extracts the public surface of a module: every `export` signature line,
 * trimmed to a single line. These signatures — never whole file bodies — are
 * what the token slicer feeds to the model as context.
 */
export function extractExportSignatures(content: string): string[] {
  const out: string[] = [];
  const patterns: RegExp[] = [
    /^\s*export\s+(?:declare\s+)?(?:default\s+)?(?:async\s+)?function\s+[A-Za-z0-9_$]+\s*(?:<[^>]*>)?\s*\([^)]*\)\s*(?::\s*[^{;]+)?/gm,
    /^\s*export\s+(?:declare\s+)?interface\s+[A-Za-z0-9_$]+(?:<[^>]*>)?/gm,
    /^\s*export\s+(?:declare\s+)?type\s+[A-Za-z0-9_$]+(?:<[^>]*>)?\s*=\s*[^;\n]{0,160}/gm,
    /^\s*export\s+(?:declare\s+)?(?:const|let|var)\s+[A-Za-z0-9_$]+\s*(?::\s*[^=\n]{0,120})?/gm,
    /^\s*export\s+(?:declare\s+)?(?:abstract\s+)?class\s+[A-Za-z0-9_$]+(?:<[^>]*>)?(?:\s+extends\s+[A-Za-z0-9_$.]+)?/gm,
    /^\s*export\s+enum\s+[A-Za-z0-9_$]+/gm,
    /^\s*export\s*\{[^}]*\}(?:\s*from\s*['"][^'"]+['"])?/gm,
    /^\s*export\s+default\s+(?!function)[A-Za-z0-9_$]+/gm,
  ];
  for (const re of patterns) {
    for (const match of content.matchAll(re)) {
      const line = match[0].replace(/\s+/g, " ").trim();
      if (line && !out.includes(line)) out.push(line);
    }
  }
  return out;
}

/**
 * Validates that a generated file satisfies the exports required by downstream DAG tasks.
 * Uses TypeScript Compiler API to avoid regex misses on multiline function declarations,
 * generic parameters, or default exports.
 */
export function verifyExportContract(
  content: string,
  filePath: string,
  expectedSymbols: string[],
): { ok: boolean; missing: string[] } {
  if (!expectedSymbols || expectedSymbols.length === 0) {
    return { ok: true, missing: [] };
  }

  const isLayout = filePath.endsWith("layout.tsx") || filePath.endsWith("layout.jsx");
  const isPage = filePath.endsWith("page.tsx") || filePath.endsWith("page.jsx");

  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  const named = new Set<string>();
  let hasDefault = false;
  let defaultName = "";

  function checkModifiers(node: ts.Node) {
    const modifiers = ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined;
    if (!modifiers) return null;
    let isExport = false;
    let isDefault = false;
    for (const mod of modifiers) {
      if (mod.kind === ts.SyntaxKind.ExportKeyword) isExport = true;
      if (mod.kind === ts.SyntaxKind.DefaultKeyword) isDefault = true;
    }
    return { isExport, isDefault };
  }

  for (const stmt of sourceFile.statements) {
    const mods = checkModifiers(stmt);
    if (mods && mods.isDefault) {
      hasDefault = true;
      if ("name" in stmt && stmt.name && ts.isIdentifier(stmt.name as ts.Node)) {
        defaultName = (stmt.name as ts.Identifier).text;
      }
    } else if (mods && mods.isExport) {
      if ("name" in stmt && stmt.name && ts.isIdentifier(stmt.name as ts.Node)) {
        named.add((stmt.name as ts.Identifier).text);
      }
      if (ts.isVariableStatement(stmt)) {
        for (const decl of stmt.declarationList.declarations) {
          if (decl.name && ts.isIdentifier(decl.name)) {
            named.add(decl.name.text);
          }
        }
      }
    }

    if (ts.isExportAssignment(stmt)) {
      hasDefault = true;
      if (ts.isIdentifier(stmt.expression)) {
        defaultName = stmt.expression.text;
      }
    }
    if (ts.isExportDeclaration(stmt)) {
      if (stmt.exportClause && ts.isNamedExports(stmt.exportClause)) {
        for (const el of stmt.exportClause.elements) {
          named.add(el.name.text);
        }
      }
    }
  }

  // Any default export in layout.tsx or page.tsx satisfies default export requirements
  if ((isLayout || isPage) && hasDefault) {
    return { ok: true, missing: [] };
  }

  const missing: string[] = [];
  for (const sym of expectedSymbols) {
    const clean = sym.trim();
    const isDefaultReq = /\bdefault\b/i.test(clean);
    if (isDefaultReq) {
      if (!hasDefault) missing.push(sym);
      continue;
    }

    const match = clean.match(
      /(?:export\s+(?:(?:async\s+)?function|const|let|var|class|interface|type|enum)\s+)?([A-Za-z0-9_$]+)/,
    );
    const id = match ? match[1] : clean.replace(/[^A-Za-z0-9_$]/g, "");
    if (!id || id === "function" || id === "const" || id === "default") continue;

    if (!named.has(id) && !(hasDefault && defaultName === id)) {
      missing.push(sym);
    }
  }

  // If multiple symbols were requested in one task, but the file exports the component matching its file name
  if (missing.length > 0 && named.size > 0) {
    const fileBase = filePath.split("/").pop()?.replace(/\.(tsx|ts|jsx|js)$/, "") || "";
    if (named.has(fileBase) || (hasDefault && defaultName === fileBase)) {
      return { ok: true, missing: [] };
    }
  }

  return { ok: missing.length === 0, missing };
}

/** Module specifiers this file depends on (static imports + re-exports). */
export function extractImports(content: string): string[] {
  const out = new Set<string>();
  const patterns = [
    /import\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /export\s+(?:\*|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/g,
    /require\(\s*['"]([^'"]+)['"]\s*\)/g,
    /import\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    for (const m of content.matchAll(re)) out.add(m[1]);
  }
  return Array.from(out);
}

/**
 * Resolves a relative or alias import specifier against the VFS file list.
 * Returns the concrete file path, or null for bare package specifiers.
 */
export function resolveImport(
  fromPath: string,
  specifier: string,
  allPaths: string[],
): string | null {
  let base: string;
  if (specifier.startsWith("@/")) {
    base = `src/${specifier.slice(2)}`;
  } else if (specifier.startsWith(".")) {
    const dir = normalizePath(fromPath).split("/").slice(0, -1);
    const parts = specifier.split("/");
    for (const part of parts) {
      if (part === "." || part === "") continue;
      if (part === "..") dir.pop();
      else dir.push(part);
    }
    base = dir.join("/");
  } else {
    return null;
  }
  const candidates = [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    `${base}.jsx`,
    `${base}.js`,
    `${base}/index.tsx`,
    `${base}/index.ts`,
  ];
  const set = new Set(allPaths.map(normalizePath));
  for (const c of candidates) if (set.has(normalizePath(c))) return normalizePath(c);
  return null;
}

export const FILE_GROUPS = ["Pages", "Components", "Theme & Config"] as const;
export type FileGroup = (typeof FILE_GROUPS)[number];

/** Buckets a path into the three Explorer groups from the spec. */
export function groupForPath(filePath: string): FileGroup {
  const p = normalizePath(filePath);
  // Styling and configuration first: src/app/globals.css is config, not a page.
  if (/\.(css|json|mjs|cjs)$/.test(p)) return "Theme & Config";
  if (/(^|\/)(tailwind|next|postcss|tsconfig)[.-]|\/(theme|tokens)[./]|\.config\./i.test(p)) {
    return "Theme & Config";
  }
  if (/^(src\/)?(app|pages)\//.test(p) && /\/(page|layout|route|template|loading|error)\.[jt]sx?$/.test(p)) {
    return "Pages";
  }
  if (/^(src\/)?(app|pages)\//.test(p)) return "Pages";
  return "Components";
}
