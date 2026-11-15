import ts from "typescript";
import type { CodeDiagnostic } from "../domain/types";

export interface TypeScriptValidationOutcome {
  diagnostics: CodeDiagnostic[];
  hasSyntaxErrors: boolean;
  transpiledJs?: string;
}

/**
 * Validates TypeScript/TSX syntax and diagnostics using the TypeScript Compiler API.
 */
export function validateTypeScript(filePath: string, source: string): TypeScriptValidationOutcome {
  const isTsOrJs = /\.(tsx|jsx|ts|js)$/.test(filePath);
  if (!isTsOrJs) {
    return { diagnostics: [], hasSyntaxErrors: false };
  }

  const scriptKind = filePath.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : filePath.endsWith(".jsx")
    ? ts.ScriptKind.JSX
    : filePath.endsWith(".ts")
    ? ts.ScriptKind.TS
    : ts.ScriptKind.JS;

  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );

  const diagnostics: CodeDiagnostic[] = [];
  const parseDiagnostics = (sourceFile as { parseDiagnostics?: ts.Diagnostic[] }).parseDiagnostics;

  if (parseDiagnostics && parseDiagnostics.length > 0) {
    for (const diag of parseDiagnostics) {
      const pos = diag.start ?? 0;
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
      const message = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
      diagnostics.push({
        id: `diag_${filePath}_ts_${diag.code}_${line}_${character}`,
        code: `TS${diag.code}`,
        severity: "error",
        filePath,
        line: line + 1,
        column: character + 1,
        message,
        source: "typescript",
      });
    }
  }

  // Check transpilability
  let transpiledJs: string | undefined;
  try {
    const result = ts.transpileModule(source, {
      compilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.ESNext,
      },
      fileName: filePath,
      reportDiagnostics: true,
    });

    if (result.diagnostics && result.diagnostics.length > 0) {
      for (const diag of result.diagnostics) {
        const message = ts.flattenDiagnosticMessageText(diag.messageText, "\n");
        // Avoid duplicate parse error diagnostics
        if (!diagnostics.some((d) => d.message === message)) {
          diagnostics.push({
            id: `diag_${filePath}_transpile_${diag.code}`,
            code: `TS${diag.code}`,
            severity: "error",
            filePath,
            line: 1,
            column: 1,
            message,
            source: "typescript",
          });
        }
      }
    }
    transpiledJs = result.outputText;
  } catch (err) {
    diagnostics.push({
      id: `diag_${filePath}_transpile_exception`,
      code: "TS_TRANSPILE_EXCEPTION",
      severity: "error",
      filePath,
      line: 1,
      column: 1,
      message: err instanceof Error ? err.message : String(err),
      source: "typescript",
    });
  }

  return {
    diagnostics,
    hasSyntaxErrors: diagnostics.length > 0,
    transpiledJs,
  };
}

