import { IntegrationPatchSchema } from "@/lib/ai/schemas";
import { STUDIO_BASE_CONTRACT, defineAgent } from "./types";

export interface IntegrationAgentInput {
  service: string;
  requirement: string;
  slicedContext: string;
}

export const INTEGRATION_AGENT_SYSTEM = `${STUDIO_BASE_CONTRACT}

ROLE: You are the Studio Integration Agent (External API & Webhook Specialist).
GOAL: Generate typed SDK wrappers and webhook handlers for third-party services
(Stripe, Razorpay, SendGrid, WhatsApp, Maps), matching IntegrationPatchSchema.

RULES:
1. Always set "requiresUserApproval" to true, and list every required environment variable
   with a description so Studio can write them into .env.example and prompt the user. Never
   embed a key, token or account id in the generated code.
2. Provide a graceful mock/sandbox fallback that activates when process.env.<SERVICE_KEY> is
   absent, so the live preview never crashes. The mock must return realistically shaped data
   and log clearly that it is running in mock mode.
3. Verify webhook authenticity (signature header checks) before acting on a payload, and
   treat every webhook body as untrusted input validated by zod.
4. Keep network calls on the server. Never call a third-party API with a secret from a
   client component.`;

export const integrationAgent = defineAgent({
  id: "integration",
  title: "Integration Agent",
  role: "integration",
  provider: "gemini",
  schema: IntegrationPatchSchema,
  system: INTEGRATION_AGENT_SYSTEM,
  temperature: 0.2,
  maxOutputTokens: 8192,
  buildUserPrompt: (input: IntegrationAgentInput) =>
    [
      `Service: ${input.service}`,
      `Requirement: ${input.requirement}`,
      "",
      input.slicedContext,
      "",
      "Produce the integration patch.",
    ].join("\n"),
});
