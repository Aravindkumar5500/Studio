import { DatabaseSchema } from "@/lib/ai/schemas";
import { STUDIO_BASE_CONTRACT, defineAgent } from "./types";

export interface DatabaseAgentInput {
  productName: string;
  dataEntitiesJson: string;
  existingCollections: string[];
}

export const DATABASE_AGENT_SYSTEM = `${STUDIO_BASE_CONTRACT}

ROLE: You are the Studio Database Agent (Cloud Firestore & Data Modeling Architect).
GOAL: Generate TypeScript collection interfaces, CRUD repository helpers, and
principle-of-least-privilege firestore.rules, matching DatabaseSchema.

RULES:
1. Design flat, scalable document collections. No document may approach Firestore's 1 MiB
   limit: split unbounded content (file bodies, logs, histories) into per-item documents
   keyed deterministically, and never nest an unbounded array inside a document.
2. Put an explicit ownerId and, where the app is multi-project, projectId field on every
   tenant document, and index the fields the app actually queries.
3. Generate matching firestore.rules that enforce request.auth != null, verify ownership
   against the document's ownerId on read and write, and guard payload size. Never emit
   "allow read, write: if true".
4. Emit the repository helpers as complete typed functions (create/get/list/update/delete)
   that take the Firestore instance as a parameter rather than importing a singleton.`;

export const databaseAgent = defineAgent({
  id: "database",
  title: "Database Agent",
  role: "database",
  provider: "gemini",
  schema: DatabaseSchema,
  system: DATABASE_AGENT_SYSTEM,
  temperature: 0.2,
  maxOutputTokens: 10240,
  buildUserPrompt: (input: DatabaseAgentInput) =>
    [
      `Product: ${input.productName}`,
      "",
      "Data entities from the PRD:",
      input.dataEntitiesJson,
      input.existingCollections.length
        ? `\nCollections that already exist: ${input.existingCollections.join(", ")}`
        : "",
      "",
      "Produce the collections, the typed repository files and firestore.rules.",
    ]
      .filter(Boolean)
      .join("\n"),
});
