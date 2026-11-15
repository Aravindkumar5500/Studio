import type { z } from "zod";
import type { AgentRole, ProviderId } from "@/types/firestore";

/**
 * One Studio agent: a role prompt, the Zod schema its output must satisfy, and
 * the provider that runs it. Every agent in `src/lib/ai/agents` is declared
 * this way so the orchestrator can treat them uniformly.
 */
export interface AgentDefinition<TSchema extends z.ZodTypeAny, TInput> {
  id: string;
  title: string;
  role: AgentRole;
  provider: ProviderId;
  schema: TSchema;
  system: string;
  temperature: number;
  maxOutputTokens: number;
  buildUserPrompt: (input: TInput) => string;
}

export function defineAgent<TSchema extends z.ZodTypeAny, TInput>(
  definition: AgentDefinition<TSchema, TInput>,
): AgentDefinition<TSchema, TInput> {
  return definition;
}

/**
 * Shared contract prepended to every agent prompt. Kept in one place so the
 * stack, the output discipline and the inspector tagging rule cannot drift
 * between agents.
 */
export const STUDIO_BASE_CONTRACT = `You are an agent inside Studio, an AI full-stack application builder.

TARGET STACK: Next.js 14 App Router, React 18, TypeScript (strict), Tailwind CSS.

AVAILABLE EXTERNAL PACKAGES:
- Icons: lucide-react, @tabler/icons-react, @phosphor-icons/react
- Motion & Animation: framer-motion (e.g. motion.div, motion.button, AnimatePresence)
- Utility: clsx, tailwind-merge
- Realistic Images: High-resolution Unsplash URLs (e.g. https://images.unsplash.com/photo-...?auto=format&fit=crop&w=800) for hero backgrounds, cards, products, and avatars.

OUTPUT DISCIPLINE:
- Reply with a single valid JSON object matching the schema you are given.
- No markdown fences, no commentary, no prose outside the JSON.
- Never emit placeholders, "...", TODO comments, or dead code paths.

CODE DISCIPLINE:
- Import only from the available external packages listed above, or files explicitly listed as available context.
- You receive the exported SIGNATURES of context files, never their bodies. Never invent an export.
- Keep every generated file under 180 lines; ask the architect for a split rather than exceeding it.`;

/** The inspector tagging rule, shared by every agent that emits JSX. */
export const STUDIO_JSX_TAGGING_RULE = `VISUAL INSPECTOR AST TAGGING:
Write standard, clean TSX JSX elements. Do NOT emit data-studio-id attributes manually; Studio's compiler AST automatically attaches accurate line:col coordinates at build time. Never insert data-studio-id into TypeScript generics (e.g. Set<T>, Array<T>, useState<T>).`;

/** Interactivity rule for anything user-facing. */
export const STUDIO_INTERACTIVITY_RULE = `INTERACTIVITY (MANDATORY):
Every control you render must work. Wire tabs, modals, filters, pickers, forms and
calculators with useState/useMemo and realistic seeded initial state, so the file is
immediately explorable in the browser preview on first load. Never emit a dead button.`;
