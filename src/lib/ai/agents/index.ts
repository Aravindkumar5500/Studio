import type { AgentRole } from "@/types/firestore";
import { productAgent } from "./product-agent";
import { architectAgent } from "./architect-agent";
import { uiuxAgent } from "./uiux-agent";
import { frontendAgent } from "./frontend-agent";
import { backendAgent } from "./backend-agent";
import { databaseAgent } from "./database-agent";
import { integrationAgent } from "./integration-agent";
import { qaAgent } from "./qa-agent";
import { securityAgent } from "./security-agent";
import { chatPatchAgent } from "./chat-patch-agent";

export * from "./types";
export { productAgent } from "./product-agent";
export { architectAgent } from "./architect-agent";
export { uiuxAgent } from "./uiux-agent";
export { frontendAgent, buildFileAgentUserPrompt } from "./frontend-agent";
export type { FileAgentInput } from "./frontend-agent";
export { backendAgent } from "./backend-agent";
export { databaseAgent } from "./database-agent";
export { integrationAgent } from "./integration-agent";
export { qaAgent } from "./qa-agent";
export { securityAgent } from "./security-agent";
export { chatPatchAgent } from "./chat-patch-agent";

/**
 * Agents that produce exactly one source file for a DAG node. The orchestrator
 * picks one of these per task from the node's agentRole.
 */
export const FILE_AGENTS = {
  frontend: frontendAgent,
  design: frontendAgent,
  backend: backendAgent,
} as const;

export type FileAgentRole = keyof typeof FILE_AGENTS;

export function isFileAgentRole(role: AgentRole): role is FileAgentRole {
  return role in FILE_AGENTS;
}

/** Roles that produce something other than a single file get routed explicitly. */
export const SPECIALIST_AGENTS = {
  product: productAgent,
  architect: architectAgent,
  database: databaseAgent,
  integration: integrationAgent,
  qa: qaAgent,
  security: securityAgent,
} as const;

/** The provider each role runs on, kept in sync with the agent definitions. */
export const ROLE_PROVIDER: Record<AgentRole, "gemini" | "groq"> = {
  product: productAgent.provider,
  architect: architectAgent.provider,
  design: uiuxAgent.provider,
  frontend: frontendAgent.provider,
  backend: backendAgent.provider,
  database: databaseAgent.provider,
  integration: integrationAgent.provider,
  qa: qaAgent.provider,
  security: securityAgent.provider,
};
