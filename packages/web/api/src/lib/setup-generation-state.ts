import { SETUP_GENERATION_STEP_ORDER } from "@kickstart/harness";
import type {
  SetupGenerationRunState,
  SetupGenerationSnapshot,
  SetupGenerationStepId,
  SetupGenerationStepState,
} from "@kickstart/harness";

export function isValidSetupGenerationSnapshot(
  value: unknown,
): value is SetupGenerationSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const snapshot = value as { run?: unknown };
  if (!snapshot.run || typeof snapshot.run !== "object" || Array.isArray(snapshot.run)) {
    return false;
  }

  const run = snapshot.run as Partial<SetupGenerationRunState>;
  if (run.phase !== "generate") return false;
  if (typeof run.runId !== "string" || run.runId.length === 0) return false;
  if (
    typeof run.currentStepIndex !== "number"
    || !Number.isInteger(run.currentStepIndex)
    || run.currentStepIndex < 0
  ) {
    return false;
  }
  if (!Array.isArray(run.steps) || !Array.isArray(run.generatedFiles)) return false;
  if (typeof run.totalBytes !== "number" || !Number.isFinite(run.totalBytes) || run.totalBytes < 0) {
    return false;
  }
  if (typeof run.updatedAt !== "string" || run.updatedAt.length === 0) return false;
  if (!isRunStatus(run.status)) return false;

  return run.steps.every((step) => isValidSetupGenerationStepState(step))
    && run.generatedFiles.every((file) => isValidGeneratedFileManifest(file));
}

export function restoreSetupGenerationRunState(
  snapshot: SetupGenerationSnapshot,
): SetupGenerationRunState {
  return cloneSetupGenerationRun(snapshot.run);
}

export function cloneSetupGenerationRun(
  run: SetupGenerationRunState,
): SetupGenerationRunState {
  return {
    ...run,
    steps: run.steps.map((step) => ({ ...step })),
    generatedFiles: run.generatedFiles.map((file) => ({ ...file })),
    ...(run.lastError ? { lastError: { ...run.lastError } } : {}),
  };
}

function isRunStatus(value: unknown): value is SetupGenerationRunState["status"] {
  return value === "idle"
    || value === "running"
    || value === "paused"
    || value === "complete"
    || value === "failed";
}

function isStepStatus(value: unknown): value is SetupGenerationStepState["status"] {
  return value === "pending"
    || value === "running"
    || value === "complete"
    || value === "error"
    || value === "skipped";
}

function isValidSetupGenerationStepState(
  value: unknown,
): value is SetupGenerationStepState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const step = value as Partial<SetupGenerationStepState>;
  return typeof step.id === "string"
    && typeof step.label === "string"
    && typeof step.required === "boolean"
    && isStepStatus(step.status)
    && SETUP_GENERATION_STEP_ORDER.includes(step.id as SetupGenerationStepId);
}

function isValidGeneratedFileManifest(
  value: unknown,
): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const file = value as Record<string, unknown>;
  return typeof file.stepId === "string"
    && SETUP_GENERATION_STEP_ORDER.includes(file.stepId as SetupGenerationStepId)
    && typeof file.path === "string"
    && typeof file.language === "string"
    && typeof file.byteLength === "number"
    && Number.isFinite(file.byteLength)
    && file.byteLength >= 0
    && typeof file.sha256 === "string";
}
