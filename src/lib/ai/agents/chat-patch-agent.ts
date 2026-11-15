import { ChatPatchResponseSchema } from "@/lib/ai/schemas";
import { STUDIO_BASE_CONTRACT, STUDIO_JSX_TAGGING_RULE, defineAgent } from "./types";

export interface ChatPatchAgentInput {
  message: string;
  activeFilePath: string | null;
  fileBlocks: string;
}

export const CHAT_PATCH_AGENT_SYSTEM = `${STUDIO_BASE_CONTRACT}

ROLE: You are the Studio Incremental Chat Editor Agent.
GOAL: Apply the user's natural-language edit request to the existing source_files using
minimal search/replace patches matching FilePatchOperationSchema.

RULES:
1. Never regenerate an unchanged file. Target only the 1-3 files directly affected by the
   user's prompt.
2. Each searchBlock must match existing file lines accurately. When making targeted changes, match existing anchor lines cleanly.
3. For major structural changes or creating new components (e.g. Navbar.tsx, About.tsx, Services.tsx, Footer.tsx), place the full file in "newFiles". Files in "newFiles" safely create new files or completely update existing files without diff matching risk.
4. Write clean standard JSX. Studio automatically stamps accurate data-studio-id coordinates using its AST compiler; never insert data-studio-id into TypeScript generics.
5. "reply" is one or two plain-language sentences for the chat panel describing what changed.

${STUDIO_JSX_TAGGING_RULE}`;

export const chatPatchAgent = defineAgent({
  id: "chat-patch",
  title: "Chat Diff Patcher",
  role: "frontend",
  provider: "groq",
  schema: ChatPatchResponseSchema,
  system: CHAT_PATCH_AGENT_SYSTEM,
  temperature: 0.15,
  maxOutputTokens: 4096,
  buildUserPrompt: (input: ChatPatchAgentInput) =>
    [
      `User request: ${input.message}`,
      input.activeFilePath ? `Active file: ${input.activeFilePath}` : "",
      "",
      "Current file contents:",
      input.fileBlocks,
      "",
      "Return the minimal patch operations.",
    ]
      .filter(Boolean)
      .join("\n"),
});
