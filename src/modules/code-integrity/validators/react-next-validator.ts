import ts from "typescript";
import type { CodeDiagnostic } from "../domain/types";
import { REACT_HOOKS } from "./import-validator";

export interface ReactNextValidationOutcome {
  diagnostics: CodeDiagnostic[];
  requiresClientBoundary: boolean;
  hasClientDirective: boolean;
  repairedSource: string;
}

const CLIENT_EVENT_HANDLERS = new Set([
  "onClick",
  "onChange",
  "onSubmit",
  "onKeyDown",
  "onKeyUp",
  "onKeyPress",
  "onFocus",
  "onBlur",
  "onMouseEnter",
  "onMouseLeave",
  "onMouseDown",
  "onMouseUp",
  "onTouchStart",
  "onTouchEnd",
]);

const BROWSER_GLOBALS = new Set([
  "window",
  "document",
  "localStorage",
  "sessionStorage",
  "navigator",
]);

/**
 * Validates React & Next.js App Router component boundaries.
 * Enforces "use client" when hooks, event handlers, or browser APIs are used in App Router files.
 */
export function validateAndRepairReactNext(filePath: string, source: string): ReactNextValidationOutcome {
  const isTsx = /\.(tsx|jsx)$/.test(filePath);
  const isAppRouter = filePath.startsWith("src/app/") || filePath.startsWith("app/");

  if (!isTsx) {
    return {
      diagnostics: [],
      requiresClientBoundary: false,
      hasClientDirective: false,
      repairedSource: source,
    };
  }

  const hasClientDirective = /^\s*["']use client["'];?/m.test(source);
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );

  let usesHooks = false;
  let usesEventHandlers = false;
  let usesBrowserGlobals = false;
  let firstHookNode: ts.Node | null = null;
  let firstEventNode: ts.Node | null = null;

  function walk(node: ts.Node) {
    // Check hook usages
    if (ts.isIdentifier(node) && REACT_HOOKS.has(node.text)) {
      if (!usesHooks) {
        usesHooks = true;
        firstHookNode = node;
      }
    }

    // Check event handler props on JSX elements
    if (ts.isJsxAttribute(node)) {
      const attrName = node.name.getText(sourceFile);
      if (CLIENT_EVENT_HANDLERS.has(attrName)) {
        if (!usesEventHandlers) {
          usesEventHandlers = true;
          firstEventNode = node;
        }
      }
    }

    // Check browser globals
    if (ts.isIdentifier(node) && BROWSER_GLOBALS.has(node.text)) {
      const parent = node.parent;
      if (!ts.isPropertyAccessExpression(parent) || parent.expression === node) {
        usesBrowserGlobals = true;
      }
    }

    ts.forEachChild(node, walk);
  }
  walk(sourceFile);

  const requiresClientBoundary = usesHooks || usesEventHandlers || usesBrowserGlobals;
  const diagnostics: CodeDiagnostic[] = [];

  if (isAppRouter && requiresClientBoundary && !hasClientDirective) {
    const triggerNode = firstHookNode || firstEventNode || sourceFile;
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(
      triggerNode.getStart(sourceFile),
    );

    const triggerReason = usesHooks
      ? "React hooks (useState, useEffect, etc.)"
      : usesEventHandlers
      ? "JSX event handlers (onClick, onChange, etc.)"
      : "browser APIs (window, document, localStorage)";

    diagnostics.push({
      id: `diag_${filePath}_missing_use_client`,
      code: "MISSING_USE_CLIENT",
      severity: "error",
      filePath,
      line: line + 1,
      column: character + 1,
      message: `File uses ${triggerReason} in Next.js App Router without a 'use client' directive.`,
      source: "ast",
      suggestedFix: `"use client";\\n\\n`,
    });
  }

  let repairedSource = source;
  if (requiresClientBoundary && !hasClientDirective) {
    // Cleanly prepend "use client"; at the very top
    repairedSource = `"use client";\n\n${source.trimStart()}`;
  }

  return {
    diagnostics,
    requiresClientBoundary,
    hasClientDirective,
    repairedSource,
  };
}

