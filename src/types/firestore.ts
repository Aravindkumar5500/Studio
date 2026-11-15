/**
 * Canonical Firestore document shapes for Studio.
 * Every collection in the spec is represented here.
 */

export type ISODate = string;

export type WorkflowMode = "guided" | "autonomous";
export type ViewMode = "preview" | "code" | "dag" | "prd";
export type ViewportPreset = "desktop" | "tablet" | "mobile";

export type ProjectStatus =
  | "draft"
  | "planning"
  | "generating"
  | "ready"
  | "error";

export type TaskStatus =
  | "pending"
  | "awaiting_approval"
  | "running"
  | "validating"
  | "repairing"
  | "succeeded"
  | "failed"
  | "skipped";

export type AgentRole =
  | "product"
  | "architect"
  | "design"
  | "frontend"
  | "backend"
  | "database"
  | "integration"
  | "security"
  | "qa";

export type ProviderId = "gemini" | "groq";

/** users/{uid} */
export interface UserDoc {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  plan: "free" | "pro" | "team";
  createdAt: ISODate;
  updatedAt: ISODate;
}

/** projects/{projectId} */
export interface ProjectDoc {
  id: string;
  ownerId: string;
  name: string;
  slug: string;
  description: string;
  status: ProjectStatus;
  workflowMode: WorkflowMode;
  currentVersionId: string | null;
  framework: "nextjs";
  entryFilePath: string;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export type MemberRole = "owner" | "editor" | "viewer";

/** project_members/{projectId}_{uid} */
export interface ProjectMemberDoc {
  id: string;
  projectId: string;
  uid: string;
  role: MemberRole;
  invitedBy: string;
  createdAt: ISODate;
}

/** requirements/{projectId} — the PRD produced by the Product Agent. */
export interface RequirementsDoc {
  id: string;
  projectId: string;
  productName: string;
  oneLiner: string;
  targetUsers: string[];
  problemStatement: string;
  features: RequirementFeature[];
  userStories: UserStory[];
  nonFunctional: string[];
  outOfScope: string[];
  approvedBy: string | null;
  approvedAt: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export interface RequirementFeature {
  id: string;
  title: string;
  description: string;
  priority: "p0" | "p1" | "p2";
  acceptanceCriteria: string[];
}

export interface UserStory {
  id: string;
  asA: string;
  iWant: string;
  soThat: string;
  featureId: string;
}

/** design_systems/{projectId} */
export interface DesignSystemDoc {
  id: string;
  projectId: string;
  name: string;
  colors: Record<string, string>;
  typography: {
    fontSans: string;
    fontMono: string;
    scale: Record<string, string>;
  };
  spacing: Record<string, string>;
  radius: Record<string, string>;
  shadows: Record<string, string>;
  componentConventions: string[];
  createdAt: ISODate;
  updatedAt: ISODate;
}

/**
 * source_files/{projectId}_{pathHash}
 * CRITICAL: one document per file. Never a whole project in one doc.
 */
export interface SourceFileDoc {
  id: string;
  projectId: string;
  filePath: string;
  language: SourceLanguage;
  content: string;
  sha256: string;
  byteSize: number;
  exportSignatures: string[];
  imports: string[];
  lastModifiedBy: string;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export type SourceLanguage =
  | "typescript"
  | "tsx"
  | "javascript"
  | "jsx"
  | "css"
  | "json"
  | "markdown"
  | "html"
  | "plaintext";

/** generation_tasks/{taskId} — a node in the build DAG. */
export interface GenerationTaskDoc {
  id: string;
  projectId: string;
  title: string;
  description: string;
  agentRole: AgentRole;
  provider: ProviderId;
  targetFilePath: string;
  requiredContextFiles: string[];
  dependsOn: string[];
  /** Exact named exports downstream files will import from this file. */
  exportedSymbols: string[];
  /** Topological layer: 0 = tokens/types, 3 = root page. */
  order: number;
  status: TaskStatus;
  attempts: number;
  error: string | null;
  tokensIn: number;
  tokensOut: number;
  startedAt: ISODate | null;
  finishedAt: ISODate | null;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export type ChatRole = "user" | "assistant" | "system";

/** conversations/{projectId}/messages/{messageId} */
export interface ConversationMessageDoc {
  id: string;
  projectId: string;
  role: ChatRole;
  content: string;
  statusPills: string[];
  patchedFiles: string[];
  versionId: string | null;
  createdAt: ISODate;
}

/** project_versions/{versionId} — immutable sha256 manifest checkpoint. */
export interface ProjectVersionDoc {
  id: string;
  projectId: string;
  label: string;
  parentVersionId: string | null;
  manifest: VersionManifestEntry[];
  createdBy: string;
  createdAt: ISODate;
}

export interface VersionManifestEntry {
  filePath: string;
  sha256: string;
  byteSize: number;
}

/** build_runs/{runId} */
export interface BuildRunDoc {
  id: string;
  projectId: string;
  versionId: string;
  status: "queued" | "running" | "passed" | "failed";
  logs: string[];
  startedAt: ISODate;
  finishedAt: ISODate | null;
}

/** test_runs/{runId} */
export interface TestRunDoc {
  id: string;
  projectId: string;
  versionId: string;
  status: "queued" | "running" | "passed" | "failed";
  passed: number;
  failed: number;
  report: string;
  startedAt: ISODate;
  finishedAt: ISODate | null;
}

/** approvals/{approvalId} — Guided Mode gates. */
export interface ApprovalDoc {
  id: string;
  projectId: string;
  stage: "prd" | "architecture" | "design_system" | "task_batch";
  payloadRef: string;
  summary: string;
  status: "pending" | "approved" | "rejected";
  decidedBy: string | null;
  decidedAt: ISODate | null;
  createdAt: ISODate;
}

/** deployments/{deploymentId} */
export interface DeploymentDoc {
  id: string;
  projectId: string;
  versionId: string;
  target: "vercel" | "github";
  url: string | null;
  repoFullName: string | null;
  status: "queued" | "building" | "ready" | "error";
  logs: string[];
  createdBy: string;
  createdAt: ISODate;
  updatedAt: ISODate;
}

export const COLLECTIONS = {
  users: "users",
  projects: "projects",
  projectMembers: "project_members",
  requirements: "requirements",
  designSystems: "design_systems",
  sourceFiles: "source_files",
  generationTasks: "generation_tasks",
  conversations: "conversations",
  projectVersions: "project_versions",
  buildRuns: "build_runs",
  testRuns: "test_runs",
  approvals: "approvals",
  deployments: "deployments",
} as const;

/** Hard limit per source file document (Firestore doc max is 1 MiB). */
export const MAX_FILE_BYTES = 250 * 1024;
