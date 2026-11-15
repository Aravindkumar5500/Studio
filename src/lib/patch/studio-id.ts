import ts from "typescript";
import { normalizePath } from "@/lib/hash";

export interface JsxElementRef {
  /** `filePath:line:col`, 1-based, pointing at the opening `<`. */
  studioId: string;
  tagName: string;
  /** Index of `<` in the source. */
  tagStart: number;
  /** Index just past `>` of the opening tag. */
  tagEnd: number;
  selfClosing: boolean;
  line: number;
  col: number;
  attributesSource: string;
}

export function isFragment(tagName: string): boolean {
  return tagName === "Fragment" || tagName === "React.Fragment" || tagName === "";
}

/**
 * Scans a .tsx/.jsx source for real JSX opening tags using the TypeScript Compiler AST.
 * This guarantees generics like `new Set<string>()`, `useState<Lead[]>([])`,
 * and `Array<number>` are NEVER mistaken for JSX elements.
 */
export function scanJsxElements(filePath: string, source: string): JsxElementRef[] {
  const normPath = normalizePath(filePath);
  const sourceFile = ts.createSourceFile(
    normPath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  const out: JsxElementRef[] = [];

  function walk(node: ts.Node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tagName = node.tagName.getText(sourceFile);
      if (!isFragment(tagName)) {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(
          node.getStart(sourceFile),
        );
        const studioId = `${normPath}:${line + 1}:${character + 1}`;
        const selfClosing = ts.isJsxSelfClosingElement(node);
        const tagStart = node.getStart(sourceFile);
        const tagEnd = node.getEnd();
        const attributesSource = node.attributes.getText(sourceFile);

        out.push({
          studioId,
          tagName,
          tagStart,
          tagEnd,
          selfClosing,
          line: line + 1,
          col: character + 1,
          attributesSource,
        });
      }
    }
    ts.forEachChild(node, walk);
  }

  walk(sourceFile);
  return out;
}

/**
 * Ensures every real JSX opening tag in the file carries an accurate
 * `data-studio-id="filePath:line:col"`. Uses the TypeScript AST to guarantee
 * TypeScript generics are never touched and valid code is always emitted.
 */
export function stampStudioIds(filePath: string, source: string): string {
  const normPath = normalizePath(filePath);
  let current = source;

  for (let pass = 0; pass < 4; pass++) {
    const sourceFile = ts.createSourceFile(
      normPath,
      current,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );

    interface Target {
      studioId: string;
      attrEnd: number;
      existingAttr: { start: number; end: number; val: string } | null;
    }

    const targets: Target[] = [];

    function walk(node: ts.Node) {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tagName = node.tagName.getText(sourceFile);
        if (!isFragment(tagName)) {
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(
            node.getStart(sourceFile),
          );
          const studioId = `${normPath}:${line + 1}:${character + 1}`;

          let existingAttr: Target["existingAttr"] = null;
          for (const prop of node.attributes.properties) {
            if (ts.isJsxAttribute(prop) && prop.name.getText(sourceFile) === "data-studio-id") {
              existingAttr = {
                start: prop.getStart(sourceFile),
                end: prop.getEnd(),
                val: prop.initializer ? prop.initializer.getText(sourceFile) : "",
              };
              break;
            }
          }

          targets.push({
            studioId,
            attrEnd: node.attributes.getEnd(),
            existingAttr,
          });
        }
      }
      ts.forEachChild(node, walk);
    }

    walk(sourceFile);

    // Sort descending by offset so replacements don't shift earlier positions
    targets.sort(
      (a, b) =>
        (b.existingAttr ? b.existingAttr.start : b.attrEnd) -
        (a.existingAttr ? a.existingAttr.start : a.attrEnd),
    );

    let changed = false;
    for (const t of targets) {
      if (t.existingAttr) {
        if (t.existingAttr.val === `"${t.studioId}"`) continue;
        changed = true;
        current =
          current.slice(0, t.existingAttr.start) +
          `data-studio-id="${t.studioId}"` +
          current.slice(t.existingAttr.end);
      } else {
        changed = true;
        current =
          current.slice(0, t.attrEnd) +
          ` data-studio-id="${t.studioId}"` +
          current.slice(t.attrEnd);
      }
    }

    if (!changed) break;
  }

  // Syntax diagnostic check after stamping
  const checkFile = ts.createSourceFile(
    normPath,
    current,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  const parseDiagnostics = (checkFile as { parseDiagnostics?: ts.Diagnostic[] }).parseDiagnostics;
  if (parseDiagnostics && parseDiagnostics.length > 0) {
    console.warn(`[Studio AST] Syntax diagnostic error after stamping ${filePath}, reverting to source.`);
    return source;
  }

  return current;
}

export function findElementByStudioId(
  filePath: string,
  source: string,
  studioId: string,
): JsxElementRef | null {
  const normPath = normalizePath(filePath);
  const elements = scanJsxElements(normPath, source);
  const direct = elements.find(
    (el) =>
      el.studioId === studioId ||
      el.studioId.endsWith(`:${studioId.split(":").slice(-2).join(":")}`),
  );
  if (direct) return direct;

  // Fall back to attribute literally present in source
  const attrIndex = source.indexOf(`data-studio-id="${studioId}"`);
  if (attrIndex !== -1) {
    const found = elements.find((el) => el.tagStart <= attrIndex && attrIndex < el.tagEnd);
    if (found) return found;
  }

  // Fall back to matching line number
  const parts = studioId.split(":");
  if (parts.length >= 3) {
    const line = parseInt(parts[parts.length - 2], 10);
    const byLine = elements.find((el) => el.line === line);
    if (byLine) return byLine;
  }

  return null;
}
