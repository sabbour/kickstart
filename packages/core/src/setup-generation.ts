export const SETUP_GENERATION_STEP_ORDER = [
  "app-scaffolding",
  "dockerfile",
  "deployment-config",
  "ci-cd",
  "service-connections",
] as const;

export type SetupGenerationStepId =
  typeof SETUP_GENERATION_STEP_ORDER[number];

export const SETUP_GENERATION_STEP_LABELS: Record<
  SetupGenerationStepId,
  string
> = {
  "app-scaffolding": "App scaffolding",
  dockerfile: "Dockerfile",
  "deployment-config": "Deployment config",
  "ci-cd": "CI/CD",
  "service-connections": "Service connections",
};

export const SETUP_GENERATION_FILE_LANGUAGE_ALLOWLIST = [
  "typescript",
  "javascript",
  "python",
  "yaml",
  "json",
  "dockerfile",
  "bicep",
  "go",
  "shell",
  "html",
  "css",
  "markdown",
  "ignore",
  "dotenv",
  "toml",
  "plaintext",
] as const;

export type SetupGenerationFileLanguage =
  typeof SETUP_GENERATION_FILE_LANGUAGE_ALLOWLIST[number];

export type SetupGenerationStepStatus =
  | "pending"
  | "running"
  | "complete"
  | "error"
  | "skipped";

export type SetupGenerationRunStatus =
  | "idle"
  | "running"
  | "paused"
  | "complete"
  | "failed";

export type SetupGenerationControlAction =
  | "retry-current-step"
  | "stop-generation";

export type SetupGenerationErrorCode =
  | "codex_timeout"
  | "codex_error"
  | "validation_failed"
  | "quota_exceeded"
  | "connection_interrupted";

export const SETUP_GENERATION_QUOTAS = {
  maxFilesPerStep: 4,
  maxBytesPerFile: 64 * 1024,
  maxBytesPerStep: 160 * 1024,
  maxFilesPerSession: 20,
  maxBytesPerSession: 512 * 1024,
} as const;

export interface SetupGenerationStepState {
  id: SetupGenerationStepId;
  label: string;
  required: boolean;
  status: SetupGenerationStepStatus;
}

export interface SetupGeneratedFileManifest {
  stepId: SetupGenerationStepId;
  path: string;
  language: string;
  byteLength: number;
  sha256: string;
}

export interface SetupGenerationStepError {
  stepId: SetupGenerationStepId;
  code: SetupGenerationErrorCode;
  message: string;
  recoverable: boolean;
  occurredAt: string;
}

export interface SetupGenerationRunState {
  runId: string;
  phase: "generate";
  currentStepIndex: number;
  steps: SetupGenerationStepState[];
  status: SetupGenerationRunStatus;
  generatedFiles: SetupGeneratedFileManifest[];
  totalBytes: number;
  updatedAt: string;
  lastError?: SetupGenerationStepError;
}

export interface SetupGenerationSnapshot {
  run: SetupGenerationRunState;
}

export interface SetupGenerationStepStartEvent {
  type: "step_start";
  stepId: SetupGenerationStepId;
  label: string;
  sequence: number;
}

export interface SetupGenerationFileGeneratedEvent {
  type: "file_generated";
  stepId: SetupGenerationStepId;
  path: string;
  language: string;
  content: string;
  byteLength: number;
  sha256: string;
}

export interface SetupGenerationStepCompleteEvent {
  type: "step_complete";
  stepId: SetupGenerationStepId;
  filesCount: number;
  totalBytes: number;
}

export interface SetupGenerationStepErrorEvent {
  type: "step_error";
  stepId: SetupGenerationStepId;
  code: SetupGenerationErrorCode;
  message: string;
  recoverable: boolean;
}

export type SetupGenerationEvent =
  | SetupGenerationStepStartEvent
  | SetupGenerationFileGeneratedEvent
  | SetupGenerationStepCompleteEvent
  | SetupGenerationStepErrorEvent;
