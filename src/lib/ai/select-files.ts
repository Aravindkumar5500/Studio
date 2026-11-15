import { estimateTokens } from "./token-slicer";

/**
 * Budget for the file bodies shown to the chat patcher. Groq's free tier caps
 * a request at 8k tokens per minute including the completion, so the default
 * leaves room for the system prompt and the reply. Raise it with
 * CHAT_CONTEXT_TOKENS on a paid tier.
 */
export const MAX_CONTEXT_TOKENS = Number(process.env.CHAT_CONTEXT_TOKENS ?? 3200);

/**
 * Ranks files by relevance to the request (active file first, then filename
 * mentions, then size) and stops once the token budget is spent.
 */
export function selectRelevantFiles(
  files: { filePath: string; content: string }[],
  activeFilePath: string | null,
  message: string,
): { filePath: string; content: string }[] {
  const lowered = message.toLowerCase();
  const scored = files.map((file) => {
    const name = file.filePath.split("/").pop()?.replace(/\.[^.]+$/, "").toLowerCase() ?? "";
    let score = 0;
    if (file.filePath === activeFilePath) score += 100;
    if (name && lowered.includes(name)) score += 60;
    if (/page\.(tsx|jsx)$/.test(file.filePath)) score += 20;
    if (file.filePath.startsWith("src/components/")) score += 10;
    if (file.filePath.endsWith(".css") || file.filePath.endsWith(".json")) score -= 20;
    return { file, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const out: { filePath: string; content: string }[] = [];
  let budget = MAX_CONTEXT_TOKENS;

  // The file the user is looking at is always included, even when it alone
  // exceeds the budget — editing it blind is worse than a large request.
  const active = files.find((file) => file.filePath === activeFilePath);
  if (active) {
    out.push(active);
    budget -= estimateTokens(active.content);
  }

  for (const { file } of scored) {
    if (file.filePath === active?.filePath) continue;
    const cost = estimateTokens(file.content);
    if (cost > budget) continue;
    budget -= cost;
    out.push(file);
  }
  return out;
}
