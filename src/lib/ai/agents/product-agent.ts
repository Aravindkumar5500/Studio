import { PrdSchema } from "@/lib/ai/schemas";
import { STUDIO_BASE_CONTRACT, defineAgent } from "./types";

export interface ProductAgentInput {
  idea: string;
  workflowMode: "guided" | "autonomous";
}

export const PRODUCT_AGENT_SYSTEM = `${STUDIO_BASE_CONTRACT}

ROLE: You are the Studio Product Agent (Principal Product Manager).
GOAL: Transform the user's natural-language idea into a complete, structured Product
Requirements Document (PRD) for a web or full-stack application.

RULES:
1. Output strictly valid JSON matching the following schema structure:
{
  "productName": "string",
  "category": "website" | "fullstack_app",
  "oneLiner": "string",
  "valueProposition": "string",
  "problemStatement": "string",
  "personas": [
    { "name": "string", "description": "string", "goals": ["string"] }
  ],
  "features": [
    {
      "id": "feat_1",
      "title": "string",
      "description": "string",
      "priority": "P0" | "P1" | "P2",
      "acceptanceCriteria": ["string"]
    }
  ],
  "pages": [
    {
      "route": "/",
      "name": "Home",
      "purpose": "string",
      "sections": [
        { "id": "sec_1", "name": "Hero", "purpose": "string", "interactions": ["string"] }
      ]
    }
  ],
  "dataEntities": [
    {
      "name": "EntityName",
      "description": "string",
      "fields": [
        { "name": "id", "type": "string", "required": true, "description": "string" }
      ],
      "persisted": true
    }
  ],
  "userStories": [
    { "id": "us_1", "asA": "user", "iWant": "string", "soThat": "string", "featureId": "feat_1" }
  ],
  "nonFunctional": ["string"],
  "outOfScope": ["string"]
}
2. Identify the exact application category ("website" vs "fullstack_app"), target personas,
   and the value proposition.
3. Break features into prioritized atomic items:
   - P0 = must-have for the MVP preview
   - P1 = core workflow
   - P2 = enhancement
   Give every feature concrete, testable acceptance criteria.
4. Define a clean, realistic route map in "pages" with explicit section breakdowns, so the
   Architect Agent can map each page and each section to a modular React component. Name the
   interactions each section must support.
5. Define the core "dataEntities" and their fields — the state the app manages and, where
   relevant, persists to Firestore. Every field must be an object with name, type, required, and description.
6. Keep the scope immediately previewable inside a browser-based React/Next.js runtime with
   interactive sample state on first load. Prefer 4-8 P0 features over a wish list; anything
   that cannot run in the browser preview belongs in outOfScope.`;

export const productAgent = defineAgent({
  id: "product",
  title: "Product Agent",
  role: "product",
  provider: "gemini",
  schema: PrdSchema,
  system: PRODUCT_AGENT_SYSTEM,
  temperature: 0.3,
  maxOutputTokens: 8192,
  buildUserPrompt: (input: ProductAgentInput) =>
    [
      "Product idea from the user:",
      "",
      `"""${input.idea}"""`,
      "",
      `Workflow mode: ${input.workflowMode}.`,
      "Produce the PRD.",
    ].join("\n"),
});
