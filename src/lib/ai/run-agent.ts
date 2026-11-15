import "server-only";
import type { z } from "zod";
import { generateJson, type GenerateJsonResult } from "./provider";
import type { AgentDefinition } from "./agents/types";

/**
 * Runs one agent: its own system prompt, schema, provider and sampling
 * settings. Every model call in Studio goes through here, so schema validation
 * and retry behaviour are uniform across all ten agents.
 */
export async function runAgent<TSchema extends z.ZodTypeAny, TInput>(
  agent: AgentDefinition<TSchema, TInput>,
  input: TInput,
): Promise<GenerateJsonResult<z.infer<TSchema>>> {
  return generateJson({
    provider: agent.provider,
    schema: agent.schema,
    systemPrompt: agent.system,
    userPrompt: agent.buildUserPrompt(input),
    temperature: agent.temperature,
    maxOutputTokens: agent.maxOutputTokens,
  });
}
