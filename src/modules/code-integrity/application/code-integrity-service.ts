import type { CodeDiagnostic, ValidationResult } from "../domain/types";
import { validateAndRepairImports } from "../validators/import-validator";
import { validateAndRepairReactNext } from "../validators/react-next-validator";
import { validateTypeScript } from "../validators/typescript-validator";

export interface IntegrityRepairOutcome {
  content: string;
  repaired: boolean;
  fixesApplied: string[];
  diagnostics: CodeDiagnostic[];
  valid: boolean;
}

/**
 * Validates a single source file across all three integrity dimensions:
 * 1. React hook & module imports
 * 2. Next.js App Router component boundaries ("use client")
 * 3. TypeScript syntax & compilation diagnostics
 */
export function validateSourceCode(filePath: string, source: string): ValidationResult {
  const start = performance.now();
  const allDiagnostics: CodeDiagnostic[] = [];

  const importOutcome = validateAndRepairImports(filePath, source);
  allDiagnostics.push(...importOutcome.diagnostics);

  const reactNextOutcome = validateAndRepairReactNext(filePath, source);
  allDiagnostics.push(...reactNextOutcome.diagnostics);

  const tsOutcome = validateTypeScript(filePath, source);
  allDiagnostics.push(...tsOutcome.diagnostics);

  const errors = allDiagnostics.filter((d) => d.severity === "error").length;
  const warnings = allDiagnostics.filter((d) => d.severity === "warning").length;

  return {
    valid: errors === 0,
    diagnostics: allDiagnostics,
    filesChecked: 1,
    errors,
    warnings,
    durationMs: Math.round(performance.now() - start),
  };
}

/**
 * Automatically repairs common AI code generation defects deterministically in 0ms:
 * - Injects missing React hook imports (useState, useMemo, useEffect, etc.)
 * - Injects missing Next.js App Router "use client" directive
 * - Injects missing Lucide icons and Next.js Link/Image imports
 * - Normalizes syntax before returning
 */
export function repairSourceCode(filePath: string, source: string): IntegrityRepairOutcome {
  const fixesApplied: string[] = [];
  let current = source;

  // 1. Boundary check: Injects "use client" if hooks or event handlers are present
  const reactNext = validateAndRepairReactNext(filePath, current);
  if (reactNext.repairedSource !== current) {
    current = reactNext.repairedSource;
    fixesApplied.push("Added 'use client' directive for client hooks / event handlers");
  }

  // 2. Import check: Injects missing hooks, Lucide icons, Link, Image
  const importOutcome = validateAndRepairImports(filePath, current);
  if (importOutcome.repairedSource !== current) {
    current = importOutcome.repairedSource;
    if (importOutcome.missingReactHooks.length > 0) {
      fixesApplied.push(`Imported missing React hooks: ${importOutcome.missingReactHooks.join(", ")}`);
    }
    if (importOutcome.missingLucideIcons.length > 0) {
      fixesApplied.push(`Imported missing icons: ${importOutcome.missingLucideIcons.join(", ")}`);
    }
    if (importOutcome.missingNextLink) fixesApplied.push("Imported Link from 'next/link'");
    if (importOutcome.missingNextImage) fixesApplied.push("Imported Image from 'next/image'");
  }

  // 3. Final TypeScript verification
  const tsOutcome = validateTypeScript(filePath, current);

  return {
    content: current,
    repaired: fixesApplied.length > 0,
    fixesApplied,
    diagnostics: tsOutcome.diagnostics,
    valid: tsOutcome.diagnostics.filter((d) => d.severity === "error").length === 0,
  };
}

/**
 * Validates an entire project VFS map.
 */
export function validateProjectVfs(files: Record<string, string>): ValidationResult {
  const start = performance.now();
  const allDiagnostics: CodeDiagnostic[] = [];
  let filesChecked = 0;

  for (const [filePath, content] of Object.entries(files)) {
    if (!/\.(tsx|jsx|ts|js)$/.test(filePath)) continue;
    filesChecked++;
    const res = validateSourceCode(filePath, content);
    allDiagnostics.push(...res.diagnostics);
  }

  const errors = allDiagnostics.filter((d) => d.severity === "error").length;
  const warnings = allDiagnostics.filter((d) => d.severity === "warning").length;

  return {
    valid: errors === 0,
    diagnostics: allDiagnostics,
    filesChecked,
    errors,
    warnings,
    durationMs: Math.round(performance.now() - start),
  };
}

