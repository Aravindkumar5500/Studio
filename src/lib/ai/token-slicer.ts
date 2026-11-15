import type { DesignSystem } from "./schemas";

/**
 * Token-Budget Context Slicer.
 *
 * Studio never puts a whole codebase in a prompt. For a task that writes
 * `targetFilePath`, the model receives only:
 *   1. the DesignSystem tokens, and
 *   2. the exported TypeScript signatures of the direct requiredContextFiles.
 */

export interface ContextFileSignature {
  filePath: string;
  exportSignatures: string[];
}

export interface SliceOptions {
  /** Hard ceiling on the rendered context, in estimated tokens. */
  maxTokens?: number;
  /** Signature lines kept per context file before truncation. */
  maxSignaturesPerFile?: number;
}

const DEFAULTS: Required<SliceOptions> = {
  maxTokens: 3500,
  maxSignaturesPerFile: 24,
};

/** Cheap, provider-agnostic token estimate (~4 chars per token). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function renderDesignTokens(design: DesignSystem): string {
  const lines: string[] = [`# Design System: ${design.name}`];
  lines.push("## Colors");
  for (const [k, v] of Object.entries(design.colors)) lines.push(`- ${k}: ${v}`);
  lines.push("## Typography");
  lines.push(`- fontSans: ${design.typography.fontSans}`);
  lines.push(`- fontMono: ${design.typography.fontMono}`);
  for (const [k, v] of Object.entries(design.typography.scale)) lines.push(`- text-${k}: ${v}`);
  lines.push("## Spacing");
  for (const [k, v] of Object.entries(design.spacing)) lines.push(`- ${k}: ${v}`);
  lines.push("## Radius");
  for (const [k, v] of Object.entries(design.radius)) lines.push(`- ${k}: ${v}`);
  if (design.componentConventions.length) {
    lines.push("## Conventions");
    for (const c of design.componentConventions) lines.push(`- ${c}`);
  }
  return lines.join("\n");
}

export function renderContextSignatures(
  files: ContextFileSignature[],
  maxPerFile: number,
): string {
  if (!files.length) return "# Context: none (this is a leaf file).";
  const blocks = files.map((file) => {
    const sigs = file.exportSignatures.slice(0, maxPerFile);
    const omitted = file.exportSignatures.length - sigs.length;
    const body = sigs.length
      ? sigs.map((s) => `  ${s};`).join("\n")
      : "  // no exported symbols";
    const tail = omitted > 0 ? `\n  // …${omitted} more export(s) omitted` : "";
    return `// ${file.filePath}\ndeclare module "${file.filePath}" {\n${body}${tail}\n}`;
  });
  return `# Available context (signatures only — file bodies are NOT provided)\n\n${blocks.join("\n\n")}`;
}

export interface SlicedContext {
  text: string;
  estimatedTokens: number;
  includedFiles: string[];
  droppedFiles: string[];
}

/**
 * Builds the context block for a generation task, dropping the least relevant
 * context files (those listed last) until the budget is met.
 */
export function sliceContext(
  targetFilePath: string,
  design: DesignSystem,
  contextFiles: ContextFileSignature[],
  options: SliceOptions = {},
): SlicedContext {
  const { maxTokens, maxSignaturesPerFile } = { ...DEFAULTS, ...options };
  const designBlock = renderDesignTokens(design);
  const included = [...contextFiles];
  const dropped: string[] = [];

  const render = () =>
    [
      designBlock,
      "",
      renderContextSignatures(included, maxSignaturesPerFile),
      "",
      `# Target file\n${targetFilePath}`,
    ].join("\n");

  let text = render();
  while (estimateTokens(text) > maxTokens && included.length > 0) {
    const removed = included.pop()!;
    dropped.push(removed.filePath);
    text = render();
  }

  return {
    text,
    estimatedTokens: estimateTokens(text),
    includedFiles: included.map((f) => f.filePath),
    droppedFiles: dropped,
  };
}

/**
 * Picks the direct dependencies of a target file from an import graph.
 * Only first-degree neighbours are ever included.
 */
export function directContextFiles(
  targetFilePath: string,
  importGraph: Record<string, string[]>,
  signatures: Record<string, string[]>,
): ContextFileSignature[] {
  const direct = importGraph[targetFilePath] ?? [];
  return direct
    .filter((p) => p !== targetFilePath && signatures[p])
    .map((p) => ({ filePath: p, exportSignatures: signatures[p] ?? [] }));
}
