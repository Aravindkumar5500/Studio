import { z } from "zod";

/**
 * Every AI call in Studio is validated against one of these schemas.
 * No raw model text is ever trusted.
 */

export const AgentRoleSchema = z.enum([
  "product",
  "architect",
  "design",
  "frontend",
  "backend",
  "database",
  "integration",
  "security",
  "qa",
]);

export const ProviderIdSchema = z.enum(["gemini", "groq"]);

export const SourceLanguageSchema = z.enum([
  "typescript",
  "tsx",
  "javascript",
  "jsx",
  "css",
  "json",
  "markdown",
  "html",
  "plaintext",
]);

/* ---------------------------------- PRD ---------------------------------- */

export const FeaturePrioritySchema = z.enum(["P0", "P1", "P2"]);

export const PrdFeatureSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  priority: FeaturePrioritySchema,
  acceptanceCriteria: z.array(z.string().min(1)).min(1),
});

export const PersonaSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  goals: z.array(z.string()).default([]),
});

export const PageSectionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  purpose: z.string().min(1),
  /** Interactive behaviour this section must ship with, not a static mock. */
  interactions: z.array(z.string()).default([]),
});

export const PageSpecSchema = z.object({
  route: z.string().min(1),
  name: z.string().min(1),
  purpose: z.string().min(1),
  sections: z.array(PageSectionSchema).min(1),
});

export const EntityFieldSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  required: z.boolean().default(true),
  description: z.string().default(""),
});

export const DataEntitySchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  fields: z.array(EntityFieldSchema).min(1),
  persisted: z.boolean().default(true),
});

export const UserStorySchema = z.object({
  id: z.string().min(1),
  asA: z.string().min(1),
  iWant: z.string().min(1),
  soThat: z.string().min(1),
  featureId: z.string().min(1),
});

export const PrdSchema = z.object({
  productName: z.string().min(1),
  category: z.enum(["website", "fullstack_app"]),
  oneLiner: z.string().min(1),
  valueProposition: z.string().min(1),
  problemStatement: z.string().min(1),
  personas: z.array(PersonaSchema).min(1),
  features: z.array(PrdFeatureSchema).min(1),
  pages: z.array(PageSpecSchema).min(1),
  dataEntities: z.array(DataEntitySchema).default([]),
  userStories: z.array(UserStorySchema).default([]),
  nonFunctional: z.array(z.string()).default([]),
  outOfScope: z.array(z.string()).default([]),
});
export type Prd = z.infer<typeof PrdSchema>;
export type PrdFeature = z.infer<typeof PrdFeatureSchema>;
export type PageSpec = z.infer<typeof PageSpecSchema>;

/* ----------------------------- Design system ----------------------------- */

export const DesignSystemSchema = z.object({
  name: z.string().default("Studio Design System"),
  colors: z.record(z.string(), z.string()).default({
    primary: "#10b981",
    surface: "#18181b",
    border: "#27272a",
    background: "#09090b",
    foreground: "#fafafa",
  }),
  typography: z
    .object({
      fontSans: z.string().default("Inter, system-ui, sans-serif"),
      fontMono: z.string().default("JetBrains Mono, monospace"),
      scale: z.record(z.string(), z.string()).default({ base: "1rem" }),
    })
    .default({
      fontSans: "Inter, system-ui, sans-serif",
      fontMono: "JetBrains Mono, monospace",
      scale: { base: "1rem" },
    }),
  spacing: z.record(z.string(), z.string()).default({ "4": "1rem" }),
  radius: z.record(z.string(), z.string()).default({ md: "0.5rem" }),
  shadows: z.record(z.string(), z.string()).default({ sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)" }),
  componentConventions: z.array(z.string()).default([]),
});
export type DesignSystem = z.infer<typeof DesignSystemSchema>;

/* -------------------------------- Task DAG -------------------------------- */

export const DagTaskNodeSchema = z.object({
  taskId: z.string().min(1),
  title: z.string().default("Build component"),
  description: z.string().default(""),
  agentRole: AgentRoleSchema.default("frontend"),
  provider: ProviderIdSchema.default("groq"),
  /** 0 = leaf (tokens/types) … 3 = root page. Used for topological ordering. */
  order: z.number().int().min(0).max(9).default(0),
  targetFilePath: z.string().min(1),
  dependencies: z.array(z.string()).default([]),
  requiredContextFiles: z.array(z.string()).default([]),
  exportedSymbols: z.array(z.string()).default([]),
});
export type DagTaskNode = z.infer<typeof DagTaskNodeSchema>;

export const ArchitecturePlanSchema = z.object({
  summary: z.string().default("Architecture Build Plan"),
  fileTree: z.array(z.string()).default([]),
  routes: z
    .array(
      z.object({
        path: z.string().min(1),
        filePath: z.string().min(1),
        purpose: z.string().min(1),
      }),
    )
    .default([]),
  tasks: z.array(DagTaskNodeSchema).min(1),
});
export type ArchitecturePlan = z.infer<typeof ArchitecturePlanSchema>;

/** Rejects cycles and dangling dependency ids before anything executes. */
export function validateDag(tasks: DagTaskNode[]): { ok: true } | { ok: false; error: string } {
  const byId = new Map(tasks.map((task) => [task.taskId, task]));
  for (const task of tasks) {
    for (const dep of task.dependencies) {
      if (!byId.has(dep)) {
        return { ok: false, error: `Task "${task.taskId}" depends on unknown task "${dep}".` };
      }
    }
  }
  const state = new Map<string, "visiting" | "done">();
  const walk = (id: string, trail: string[]): string | null => {
    const mark = state.get(id);
    if (mark === "done") return null;
    if (mark === "visiting") return [...trail, id].join(" -> ");
    state.set(id, "visiting");
    for (const dep of byId.get(id)?.dependencies ?? []) {
      const cycle = walk(dep, [...trail, id]);
      if (cycle) return cycle;
    }
    state.set(id, "done");
    return null;
  };
  for (const task of tasks) {
    const cycle = walk(task.taskId, []);
    if (cycle) return { ok: false, error: `Circular dependency: ${cycle}` };
  }
  return { ok: true };
}

/* ----------------------------- File generation ---------------------------- */

export const GeneratedFileSchema = z.object({
  filePath: z.string().min(1),
  language: SourceLanguageSchema,
  content: z.string().min(1),
  exportSignatures: z.array(z.string()).default([]),
  imports: z.array(z.string()).default([]),
  notes: z.string().default(""),
});
export type GeneratedFile = z.infer<typeof GeneratedFileSchema>;

/** What every file-producing agent (frontend, backend, database) returns. */
export const FileGenerationOutputSchema = z.object({
  file: GeneratedFileSchema,
  /** Named exports actually declared, checked against the task's contract. */
  exportedSymbols: z.array(z.string()).default([]),
  followUpNotes: z.array(z.string()).default([]),
});
export type FileGenerationOutput = z.infer<typeof FileGenerationOutputSchema>;

export const GeneratedFileBatchSchema = z.object({
  files: z.array(GeneratedFileSchema).min(1),
});

/* -------------------------------- Patching -------------------------------- */

export const PatchBlockSchema = z.object({
  searchBlock: z.string().min(1),
  replaceBlock: z.string(),
});

export const FilePatchOperationSchema = z.object({
  targetFilePath: z.string().min(1),
  patches: z.array(PatchBlockSchema).min(1),
  rationale: z.string().default(""),
});
export type FilePatchOperation = z.infer<typeof FilePatchOperationSchema>;

export const ChatPatchResponseSchema = z
  .object({
    reply: z.string().min(1),
    operations: z.array(FilePatchOperationSchema).default([]),
    newFiles: z.array(GeneratedFileSchema).default([]),
  })
  .refine((value) => value.operations.length > 0 || value.newFiles.length > 0, {
    message:
      "Return at least one entry in \"operations\" (search/replace edits) or \"newFiles\". A reply with no edits is not a valid response.",
  });
export type ChatPatchResponse = z.infer<typeof ChatPatchResponseSchema>;

/* ------------------------------- AST patching ------------------------------ */

export const AstPatchRequestSchema = z.object({
  projectId: z.string().min(1),
  studioId: z.string().regex(/^.+:\d+:\d+$/, "studioId must be filePath:line:col"),
  mutation: z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("setText"), value: z.string() }),
    z.object({
      kind: z.literal("setClassToken"),
      group: z.string().min(1),
      value: z.string(),
    }),
    z.object({ kind: z.literal("addClass"), value: z.string().min(1) }),
    z.object({ kind: z.literal("removeClass"), value: z.string().min(1) }),
  ]),
});
export type AstPatchRequest = z.infer<typeof AstPatchRequestSchema>;

export const AstPatchResponseSchema = z.object({
  filePath: z.string(),
  content: z.string(),
  sha256: z.string(),
  changed: z.boolean(),
});

/* ------------------------------ Database agent ----------------------------- */

export const FirestoreCollectionSchema = z.object({
  name: z.string().min(1),
  documentIdStrategy: z.string().min(1),
  description: z.string().min(1),
  fields: z.array(EntityFieldSchema).min(1),
  /** Required for tenant isolation in the generated rules. */
  ownerField: z.string().default("ownerId"),
  indexes: z.array(z.string()).default([]),
});

export const DatabaseSchema = z.object({
  collections: z.array(FirestoreCollectionSchema).min(1),
  /** `types/db.ts`, repository helpers, and firestore.rules. */
  files: z.array(GeneratedFileSchema).min(1),
  rules: z.string().min(1),
  notes: z.array(z.string()).default([]),
});
export type DatabaseDesign = z.infer<typeof DatabaseSchema>;

/* ---------------------------- Integration agent ---------------------------- */

export const IntegrationPatchSchema = z.object({
  service: z.string().min(1),
  /** Third-party credentials always need a human in the loop. */
  requiresUserApproval: z.literal(true),
  envVars: z
    .array(
      z.object({
        name: z.string().min(1),
        description: z.string().min(1),
        required: z.boolean().default(true),
      }),
    )
    .min(1),
  files: z.array(GeneratedFileSchema).min(1),
  /** Keeps the Sandpack preview alive before credentials exist. */
  mockFallbackDescription: z.string().min(1),
  envExample: z.string().min(1),
});
export type IntegrationPatch = z.infer<typeof IntegrationPatchSchema>;

/* ------------------------------ Security agent ----------------------------- */

export const SecuritySeveritySchema = z.enum(["critical", "high", "medium", "low"]);

export const SecurityFindingSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  severity: SecuritySeveritySchema,
  filePath: z.string().min(1),
  line: z.number().int().min(0).default(0),
  category: z.enum([
    "eval",
    "xss",
    "exposed_secret",
    "missing_auth",
    "permissive_rules",
    "injection",
    "other",
  ]),
  evidence: z.string().min(1),
  impact: z.string().min(1),
  /** Mandatory for critical/high findings; see refine below. */
  remediation: FilePatchOperationSchema.nullable().default(null),
});

export const SecurityAuditSchema = z
  .object({
    summary: z.string().min(1),
    findings: z.array(SecurityFindingSchema).default([]),
    passed: z.boolean(),
  })
  .refine(
    (audit) =>
      audit.findings
        .filter((f) => f.severity === "critical" || f.severity === "high")
        .every((f) => f.remediation !== null),
    { message: "Every critical or high finding must carry a remediation patch." },
  );
export type SecurityAudit = z.infer<typeof SecurityAuditSchema>;

/* --------------------------------- QA agent -------------------------------- */

export const BuildDiagnosticSchema = z.object({
  filePath: z.string().min(1),
  line: z.number().int().min(0).default(0),
  column: z.number().int().min(0).default(0),
  message: z.string().min(1),
  source: z.enum(["typescript", "sandpack", "eslint", "runtime"]).default("typescript"),
});
export type BuildDiagnostic = z.infer<typeof BuildDiagnosticSchema>;

export const QaFixSchema = z.object({
  diagnosis: z.string().min(1),
  /** Empty when the agent judges the error unfixable without more context. */
  operations: z.array(FilePatchOperationSchema).default([]),
  confidence: z.enum(["high", "medium", "low"]),
});
export type QaFix = z.infer<typeof QaFixSchema>;

/* -------------------------------- API bodies ------------------------------- */

export const PlanRequestSchema = z.object({
  projectId: z.string().min(1),
  prompt: z.string().min(3),
  workflowMode: z.enum(["guided", "autonomous"]).default("guided"),
});

export const ExecuteTaskRequestSchema = z.object({
  projectId: z.string().min(1),
  task: DagTaskNodeSchema,
  designSystem: DesignSystemSchema,
  contextFiles: z
    .array(
      z.object({
        filePath: z.string(),
        exportSignatures: z.array(z.string()).default([]),
      }),
    )
    .default([]),
});

export const ChatPatchRequestSchema = z.object({
  projectId: z.string().min(1),
  message: z.string().min(1),
  activeFilePath: z.string().nullable().default(null),
  files: z
    .array(z.object({ filePath: z.string(), content: z.string() }))
    .default([]),
});

export const QaFixRequestSchema = z.object({
  projectId: z.string().min(1),
  diagnostics: z.array(BuildDiagnosticSchema).min(1),
  files: z.array(z.object({ filePath: z.string(), content: z.string() })).min(1),
});

export const SecurityAuditRequestSchema = z.object({
  projectId: z.string().min(1),
  files: z.array(z.object({ filePath: z.string(), content: z.string() })).min(1),
  firestoreRules: z.string().default(""),
});

export const GithubExportRequestSchema = z.object({
  projectId: z.string().min(1),
  repoName: z.string().min(1).regex(/^[A-Za-z0-9._-]+$/),
  owner: z.string().min(1),
  isPrivate: z.boolean().default(true),
  commitMessage: z.string().default("chore: export from Studio"),
  token: z.string().min(1),
  files: z.array(z.object({ filePath: z.string(), content: z.string() })).min(1),
});

export const VercelDeployRequestSchema = z.object({
  projectId: z.string().min(1),
  projectName: z.string().min(1).regex(/^[a-z0-9-]+$/),
  token: z.string().min(1),
  teamId: z.string().optional(),
  target: z.enum(["production", "preview"]).default("production"),
  files: z.array(z.object({ filePath: z.string(), content: z.string() })).min(1),
});
