export type DiagnosticSeverity = "error" | "warning" | "info";
export type DiagnosticSource = "typescript" | "ast" | "build" | "runtime";

export interface CodeDiagnostic {
  id: string;
  code: string;
  severity: DiagnosticSeverity;
  filePath: string;
  line: number;
  column: number;
  message: string;
  source: DiagnosticSource;
  suggestedFix?: string;
}

export interface ValidationResult {
  valid: boolean;
  diagnostics: CodeDiagnostic[];
  filesChecked: number;
  errors: number;
  warnings: number;
  durationMs: number;
}

export interface RuntimeDiagnostic {
  id: string;
  projectId: string;
  runId?: string;
  filePath?: string;
  line?: number;
  column?: number;
  message: string;
  stack?: string;
  severity: "error" | "warning";
  timestamp: string;
}

export type PreviewStatus =
  | "not_started"
  | "starting"
  | "ready"
  | "runtime_error"
  | "build_error"
  | "stopped";

export interface FilePatch {
  filePath: string;
  operation: "replace" | "create" | "delete";
  expectedHash?: string;
  content?: string;
  searchBlock?: string;
  replaceBlock?: string;
}

export interface RepairResult {
  success: boolean;
  summary: string;
  patches: FilePatch[];
  reasoning: string;
  confidence: number;
}

export type EnhancedTaskStatus =
  | "pending"
  | "running"
  | "generated"
  | "validating"
  | "repairing"
  | "validated"
  | "failed"
  | "blocked";

