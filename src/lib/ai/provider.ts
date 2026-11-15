import "server-only";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { AgentRole, ProviderId } from "@/types/firestore";

/**
 * Unified provider adapter.
 *
 *   gemini — heavy planning (product, architect, backend, database, security)
 *   groq   — ultra-fast generation (design, frontend, surgical chat patches)
 *
 * Every call returns data validated against a Zod schema. Invalid JSON is
 * retried with the validation error fed back to the model.
 */

/**
 * Model ids are overridable per deployment, because which models a Gemini key
 * can reach varies by account. Verify with:
 *   GET https://generativelanguage.googleapis.com/v1beta/models?key=...
 */
const envModel = (name: string, fallback: string): string => {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
};

export const GEMINI_MODEL = envModel("GEMINI_MODEL", "gemini-3.1-flash-lite");
export const GROQ_MODEL = envModel("GROQ_MODEL", "llama-3.3-70b-versatile");

/**
 * Heavy planning and server-side reasoning runs on Gemini; UI generation and
 * surgical patching runs on Groq. The per-agent definitions are the source of
 * truth — see src/lib/ai/agents.
 */
const PLANNING_ROLES: AgentRole[] = [
  "product",
  "architect",
  "backend",
  "database",
  "integration",
  "security",
];

export function providerForRole(role: AgentRole): ProviderId {
  return PLANNING_ROLES.includes(role) ? "gemini" : "groq";
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly provider: ProviderId,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export class SchemaValidationError extends Error {
  constructor(
    message: string,
    readonly issues: z.ZodIssue[],
    readonly raw: string,
  ) {
    super(message);
    this.name = "SchemaValidationError";
  }
}

export interface GenerateJsonOptions<T extends z.ZodTypeAny> {
  provider: ProviderId;
  schema: T;
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  maxOutputTokens?: number;
  maxAttempts?: number;
  signal?: AbortSignal;
}

export interface GenerateJsonResult<T> {
  data: T;
  provider: ProviderId;
  model: string;
  attempts: number;
  rawText: string;
  usage: { inputTokens: number; outputTokens: number };
}

function requireEnv(name: string, provider: ProviderId): string {
  const value = process.env[name];
  if (!value) {
    throw new ProviderError(
      `${name} is not set. Add it to .env.local to use the ${provider} provider.`,
      provider,
    );
  }
  return value;
}

/** Strips code fences and prose, returning the outermost JSON value. */
export function extractJson(raw: string): string {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const firstObj = text.indexOf("{");
  const firstArr = text.indexOf("[");
  const start =
    firstObj === -1 ? firstArr : firstArr === -1 ? firstObj : Math.min(firstObj, firstArr);
  if (start === -1) return text;
  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return text.slice(start);
}

/** Overloaded-model responses are transient; back off and retry. */
const TRANSIENT = /503|UNAVAILABLE|high demand|overloaded|429|RESOURCE_EXHAUSTED/i;

/** Groq reports "Please try again in 14.385s" — obey it rather than guessing. */
function suggestedDelayMs(detail: string): number | null {
  const match = /try again in ([\d.]+)s/i.exec(detail);
  return match ? Math.ceil(Number(match[1]) * 1000) + 250 : null;
}

async function withRetry<T>(
  label: string,
  provider: ProviderId,
  fn: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const detail = error instanceof Error ? error.message : String(error);
      if (!TRANSIENT.test(detail) || attempt === attempts) break;
      const wait = suggestedDelayMs(detail) ?? 800 * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, Math.min(wait, 30_000)));
    }
  }
  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  throw new ProviderError(`${label}: ${detail}`, provider, lastError);
}

async function callGemini(
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
  maxOutputTokens: number,
  schema?: z.ZodTypeAny,
): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number } }> {
  if (!process.env.GEMINI_API_KEY && process.env.GROQ_API_KEY) {
    console.warn(`[Studio AI] GEMINI_API_KEY is not configured. Falling back to Groq (${GROQ_MODEL})...`);
    return await callGroq(systemPrompt, userPrompt, temperature, maxOutputTokens, schema);
  }

  const apiKey = requireEnv("GEMINI_API_KEY", "gemini");
  const client = new GoogleGenerativeAI(apiKey);

  const candidateModels = [GEMINI_MODEL, "gemini-3.1-flash-lite"].filter(
    (m, i, arr) => arr.indexOf(m) === i,
  );

  let lastError: unknown;
  for (const modelId of candidateModels) {
    try {
      const model = client.getGenerativeModel({
        model: modelId,
        systemInstruction: systemPrompt,
        generationConfig: {
          temperature,
          maxOutputTokens,
          responseMimeType: "application/json",
        },
      });
      const result = await withRetry(
        `Gemini (${modelId})`,
        "gemini",
        () => model.generateContent(userPrompt),
        2,
      );
      const usage = result.response.usageMetadata;
      return {
        text: result.response.text(),
        usage: {
          inputTokens: usage?.promptTokenCount ?? 0,
          outputTokens: usage?.candidatesTokenCount ?? 0,
        },
      };
    } catch (err) {
      lastError = err;
      const detail = err instanceof Error ? err.message : String(err);
      if (!/503|UNAVAILABLE|high demand|overloaded|404|not found|429|quota/i.test(detail)) {
        break;
      }
    }
  }

  // If Gemini failed (503 high demand, 429 quota, etc.) and Groq is available, fall back to Groq with schema
  if (process.env.GROQ_API_KEY) {
    try {
      console.warn(
        `[Studio AI] Gemini failed (${lastError instanceof Error ? lastError.message : String(lastError)}). Falling back to Groq (${GROQ_MODEL})...`,
      );
      return await callGroq(systemPrompt, userPrompt, temperature, maxOutputTokens, schema);
    } catch {
      // ignore and throw original Gemini error below
    }
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  if (/no longer available|not found|not supported|404/i.test(detail)) {
    throw new ProviderError(
      `Gemini model "${GEMINI_MODEL}" is not available to this API key. Set GEMINI_MODEL in .env.local to one your key can call.`,
      "gemini",
      lastError,
    );
  }
  throw new ProviderError(`Gemini request failed: ${detail}`, "gemini", lastError);
}

/**
 * Groq's structured-output mode enforces the schema server-side, which removes
 * the whole class of truncated / malformed JSON failures. Not every model
 * supports it, so callers fall back to plain json_object mode.
 */
function groqResponseFormat(schema?: z.ZodTypeAny): Record<string, unknown> {
  if (!schema) return { type: "json_object" };
  try {
    const jsonSchema = zodToJsonSchema(schema, {
      $refStrategy: "none",
      target: "openApi3",
    }) as Record<string, unknown>;
    return {
      type: "json_schema",
      json_schema: { name: "studio_response", schema: jsonSchema },
    };
  } catch {
    return { type: "json_object" };
  }
}

async function callGroq(
  systemPrompt: string,
  userPrompt: string,
  temperature: number,
  maxOutputTokens: number,
  schema?: z.ZodTypeAny,
): Promise<{ text: string; usage: { inputTokens: number; outputTokens: number } }> {
  const apiKey = requireEnv("GROQ_API_KEY", "groq");
  const client = new Groq({ apiKey });
  const effectiveMaxTokens = Math.min(maxOutputTokens || 4096, 4096);
  const candidateModels = [GROQ_MODEL, "llama-3.3-70b-versatile", "openai/gpt-oss-120b"].filter(
    (m, i, arr) => arr.indexOf(m) === i,
  );

  let lastError: unknown;
  for (const modelId of candidateModels) {
    let responseFormat = groqResponseFormat(schema);
    try {
      const completion = await withRetry(`Groq (${modelId})`, "groq", () =>
        client.chat.completions.create({
          model: modelId,
          temperature,
          max_tokens: effectiveMaxTokens,
          response_format: responseFormat as never,
          ...(/gpt-oss|qwen/i.test(modelId) ? { reasoning_effort: "low" as const } : {}),
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
      );
      return {
        text: completion.choices[0]?.message?.content ?? "",
        usage: {
          inputTokens: completion.usage?.prompt_tokens ?? 0,
          outputTokens: completion.usage?.completion_tokens ?? 0,
        },
      };
    } catch (error) {
      lastError = error;
      const detail = error instanceof Error ? error.message : String(error);
      // Model or account without structured-output support: retry unconstrained.
      if (/json_schema|response_format|structured/i.test(detail) && responseFormat.type === "json_schema") {
        try {
          responseFormat = { type: "json_object" };
          const retry = await withRetry(`Groq (${modelId})`, "groq", () =>
            client.chat.completions.create({
              model: modelId,
              temperature,
              max_tokens: effectiveMaxTokens,
              response_format: responseFormat as never,
              ...(/gpt-oss|qwen/i.test(modelId) ? { reasoning_effort: "low" as const } : {}),
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
              ],
            }),
          );
          return {
            text: retry.choices[0]?.message?.content ?? "",
            usage: {
              inputTokens: retry.usage?.prompt_tokens ?? 0,
              outputTokens: retry.usage?.completion_tokens ?? 0,
            },
          };
        } catch (innerErr) {
          lastError = innerErr;
        }
      }
      if (!/not found|not supported|model_not_found|rate_limit|429|decommissioned/i.test(detail)) {
        break;
      }
    }
  }

  const detail = lastError instanceof Error ? lastError.message : String(lastError);
  if (/json_validate_failed/i.test(detail)) {
    throw new ProviderError(
      `Groq model returned truncated or invalid JSON. Consider raising the token budget or using a different model via GROQ_MODEL.`,
      "groq",
      lastError,
    );
  }
  throw new ProviderError(`Groq request failed: ${detail}`, "groq", lastError);
}

/** Single entry point for every model call in Studio. */
export async function generateJson<T extends z.ZodTypeAny>(
  options: GenerateJsonOptions<T>,
): Promise<GenerateJsonResult<z.infer<T>>> {
  const {
    provider,
    schema,
    systemPrompt,
    temperature = 0.2,
    maxOutputTokens = 8192,
    maxAttempts = 3,
  } = options;

  let userPrompt = options.userPrompt;
  let lastRaw = "";
  let lastIssues: z.ZodIssue[] = [];
  let activeProvider: ProviderId = provider;

  // If gemini is requested but no key is present and Groq key is available, switch immediately
  if (activeProvider === "gemini" && !process.env.GEMINI_API_KEY && process.env.GROQ_API_KEY) {
    console.warn(`[Studio AI] GEMINI_API_KEY is not set. Automatically falling back to Groq (${GROQ_MODEL})...`);
    activeProvider = "groq";
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let callResult: { text: string; usage: { inputTokens: number; outputTokens: number } };

    try {
      if (activeProvider === "gemini") {
        callResult = await callGemini(systemPrompt, userPrompt, temperature, maxOutputTokens, schema);
      } else {
        callResult = await callGroq(systemPrompt, userPrompt, temperature, maxOutputTokens, schema);
      }
    } catch (err) {
      if (activeProvider === "gemini" && process.env.GROQ_API_KEY) {
        console.warn(
          `[Studio AI] Gemini failed (${err instanceof Error ? err.message : String(err)}). Falling back to Groq (${GROQ_MODEL})...`,
        );
        activeProvider = "groq";
        callResult = await callGroq(systemPrompt, userPrompt, temperature, maxOutputTokens, schema);
      } else {
        throw err;
      }
    }

    const { text, usage } = callResult;

    lastRaw = text;
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(extractJson(text));
    } catch {
      userPrompt = `${options.userPrompt}\n\nYour previous reply was not valid JSON. Reply with a single JSON object and nothing else.`;
      continue;
    }

    const result = schema.safeParse(parsedJson);
    if (result.success) {
      return {
        data: result.data,
        provider: activeProvider,
        model: activeProvider === "gemini" ? GEMINI_MODEL : GROQ_MODEL,
        attempts: attempt,
        rawText: text,
        usage,
      };
    }

    lastIssues = result.error.issues;
    const issueList = lastIssues
      .slice(0, 12)
      .map((i) => `- ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    userPrompt = `${options.userPrompt}\n\nYour previous reply failed schema validation:\n${issueList}\n\nReturn corrected JSON that satisfies the schema exactly.`;
  }

  throw new SchemaValidationError(
    `Model output failed schema validation after ${maxAttempts} attempts.`,
    lastIssues,
    lastRaw,
  );
}

export function isProviderConfigured(provider: ProviderId): boolean {
  return provider === "gemini"
    ? Boolean(process.env.GEMINI_API_KEY)
    : Boolean(process.env.GROQ_API_KEY);
}
