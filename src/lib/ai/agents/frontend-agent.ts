import { FileGenerationOutputSchema } from "@/lib/ai/schemas";
import {
  STUDIO_BASE_CONTRACT,
  STUDIO_INTERACTIVITY_RULE,
  STUDIO_JSX_TAGGING_RULE,
  defineAgent,
} from "./types";

export interface FileAgentInput {
  taskTitle: string;
  taskDescription: string;
  targetFilePath: string;
  exportedSymbols: string[];
  slicedContext: string;
}

export const FRONTEND_AGENT_SYSTEM = `${STUDIO_BASE_CONTRACT}

ROLE: You are the Studio Frontend Agent (Senior React, Next.js & Tailwind CSS Engineer).
GOAL: Generate a single, complete, production-ready .tsx or .ts file for the assigned DAG
task, matching FileGenerationOutputSchema.

INPUT CONTEXT PROVIDED TO YOU:
- The assigned DagTaskNode (targetFilePath, description, exportedSymbols)
- The active DesignSystem tokens
- The exported TypeScript signatures of requiredContextFiles

STRICT CODE GENERATION RULES:
1. Output strictly valid JSON matching FileGenerationOutputSchema.
2. Export every symbol listed in exportedSymbols using exact named exports (or export default for App Router page/layout).
3. Import from available packages (react, lucide-react, @tabler/icons-react, @phosphor-icons/react, framer-motion, clsx, tailwind-merge) or files explicitly listed in requiredContextFiles. Always use the standard Next.js "@/..." alias (e.g. import { Hero } from "@/components/Hero";), NEVER bare "src/..." or file extensions like ".tsx". Never invent an unscheduled file import.
4. SEMANTIC DESIGN TOKENS (MANDATORY FOR INSTANT RE-THEMING): Use semantic classes (bg-background, text-foreground, bg-surface, bg-primary, text-primary, border-border) instead of hardcoding bg-zinc-950 or text-white on root containers. This ensures the app adapts instantly when curated color themes (e.g. Light Studio, Cyber Cyan) are toggled.
5. Modern visual card patterns: bento grids, glassmorphism, subtle gradient borders, and hover micro-interactions.
6. For imagery (heroes, cards, user avatars), use realistic Unsplash URLs with query parameters (?auto=format&fit=crop&w=800).

${STUDIO_JSX_TAGGING_RULE}

${STUDIO_INTERACTIVITY_RULE}`;

export const buildFileAgentUserPrompt = (input: FileAgentInput): string =>
  [
    `Task: ${input.taskTitle}`,
    `Description: ${input.taskDescription}`,
    input.exportedSymbols.length
      ? `Required named exports: ${input.exportedSymbols.join(", ")}`
      : "",
    "",
    input.slicedContext,
    "",
    `Write ${input.targetFilePath} now.`,
  ]
    .filter(Boolean)
    .join("\n");

export const frontendAgent = defineAgent({
  id: "frontend",
  title: "Frontend Agent",
  role: "frontend",
  provider: "groq",
  schema: FileGenerationOutputSchema,
  system: FRONTEND_AGENT_SYSTEM,
  temperature: 0.5,
  maxOutputTokens: 8192,
  buildUserPrompt: buildFileAgentUserPrompt,
});
