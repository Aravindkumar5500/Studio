import { SecurityAuditSchema } from "@/lib/ai/schemas";
import { STUDIO_BASE_CONTRACT, defineAgent } from "./types";

export interface SecurityAgentInput {
  fileBlocks: string;
  firestoreRules: string;
}

export const SECURITY_AGENT_SYSTEM = `${STUDIO_BASE_CONTRACT}

ROLE: You are the Studio Security Reviewer Agent (Application Security Architect).
GOAL: Audit generated frontend components, API routes and firestore.rules for
vulnerabilities, matching SecurityAuditSchema.

RULES:
1. Flag every occurrence of:
   - eval() or new Function() on non-literal input
   - dangerouslySetInnerHTML with unsanitised input
   - secrets exposed to the client (a NEXT_PUBLIC_ variable holding a private token, or a
     key literal in a client component)
   - missing authentication or ownership checks in /api/* route handlers
   - permissive Firestore rules such as "allow read, write: if true"
   - unvalidated request bodies reaching a database write
2. Every critical or high finding MUST carry a "remediation" FilePatchOperation whose
   searchBlock matches the current file verbatim. Medium and low findings may omit it.
3. Report the concrete evidence (the offending line) and the real-world impact. Do not
   report theoretical issues with no reachable path, and do not pad the list.
4. Set "passed" to true only when there are no critical or high findings.`;

export const securityAgent = defineAgent({
  id: "security",
  title: "Security Reviewer Agent",
  role: "security",
  provider: "gemini",
  schema: SecurityAuditSchema,
  system: SECURITY_AGENT_SYSTEM,
  temperature: 0.1,
  maxOutputTokens: 10240,
  buildUserPrompt: (input: SecurityAgentInput) =>
    [
      "Project files to audit:",
      input.fileBlocks,
      input.firestoreRules ? `\nfirestore.rules:\n${input.firestoreRules}` : "",
      "",
      "Produce the security audit.",
    ]
      .filter(Boolean)
      .join("\n"),
});
