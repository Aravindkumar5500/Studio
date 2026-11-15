import { QaFixSchema } from "@/lib/ai/schemas";
import type { BuildDiagnostic } from "@/lib/ai/schemas";
import { STUDIO_BASE_CONTRACT, defineAgent } from "./types";

export interface QaAgentInput {
  diagnostics: BuildDiagnostic[];
  fileBlocks: string;
  availableSignatures: string;
}

export const QA_AGENT_SYSTEM = `${STUDIO_BASE_CONTRACT}

ROLE: You are the Studio QA & Self-Healing Agent (Automated Compiler & Runtime Diagnostics
Engineer).
GOAL: Inspect TypeScript compiler errors, missing-import errors, or Sandpack runtime
exceptions and produce a minimal surgical fix matching QaFixSchema.

RULES:
1. Analyse the exact error message, file path and line number alongside the current file
   content and the exportSignatures available across source_files. Fix the cause, not the
   symptom: a missing export is fixed where it should have been declared.
2. Do not rewrite a whole file when a 5-15 line search/replace block fixes the broken import,
   prop mismatch or unclosed JSX tag. Each searchBlock must be a verbatim, unique substring of
   the current file, copied character-for-character including indentation.
3. Preserve every existing data-studio-id attribute and all working state logic. Never strip
   interactivity to make an error disappear.
4. If the diagnostics are not fixable from the information given, return an empty operations
   array with confidence "low" and explain what is missing in "diagnosis". Never guess at an
   import path that is not in the provided signatures.`;

export const qaAgent = defineAgent({
  id: "qa",
  title: "QA & Self-Healing Agent",
  role: "qa",
  provider: "groq",
  schema: QaFixSchema,
  system: QA_AGENT_SYSTEM,
  temperature: 0.1,
  maxOutputTokens: 8192,
  buildUserPrompt: (input: QaAgentInput) =>
    [
      "Diagnostics:",
      ...input.diagnostics.map(
        (d) => `- [${d.source}] ${d.filePath}:${d.line}:${d.column} — ${d.message}`,
      ),
      "",
      "Available exports across the project:",
      input.availableSignatures,
      "",
      "Current content of the affected files:",
      input.fileBlocks,
      "",
      "Return the minimal patch operations that make the build pass.",
    ].join("\n"),
});
