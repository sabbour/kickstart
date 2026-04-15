import { createHash, randomUUID } from "node:crypto";
import { posix as pathPosix } from "node:path";
import type { A2UIMessage, ChatMessage } from "@kickstart/core";
import {
  Phase,
  SETUP_GENERATION_FILE_LANGUAGE_ALLOWLIST,
  SETUP_GENERATION_QUOTAS,
  SETUP_GENERATION_STEP_LABELS,
  SETUP_GENERATION_STEP_ORDER,
} from "@kickstart/core";
import type {
  SetupGenerationControlAction,
  SetupGenerationErrorCode,
  SetupGenerationEvent,
  SetupGenerationFileLanguage,
  SetupGenerationRunState,
  SetupGenerationSnapshot,
  SetupGenerationStepId,
  SetupGenerationStepState,
} from "@kickstart/core";
import { sumChatUsage } from "./usage-tracking.js";
import type { ChatUsage } from "./usage-tracking.js";
import { codexCompletion } from "./openai-client.js";
import {
  cloneSetupGenerationRun,
  isValidSetupGenerationSnapshot,
  restoreSetupGenerationRunState,
} from "./setup-generation-state.js";
import {
  extractArtifactMetadata,
  upsertArtifact,
} from "./session-store.js";
import type { ApiSession } from "./session-store.js";

const STEPWISE_GENERATION_FLAG = "STEPWISE_GENERATION_V1";
const PATH_ALLOWLIST_RE = /^[A-Za-z0-9._/-]+$/;
const DRIVE_LETTER_RE = /^[A-Za-z]:/;
const MAX_TRANSCRIPT_CHARS = 6_000;
const MAX_ARTIFACT_SUMMARY_CHARS = 2_000;
const MAX_CODEX_RESPONSE_CHARS = 32_000;
const FILE_CONTENT_FENCE_RE = /^```[\s\S]*```$/;
const MULTI_FILE_WRAPPER_PATTERNS = [
  /^#+\s*file:\s+/im,
  /^---\s*file:\s+/im,
  /^\s*\/\/\s*file:\s+/im,
  /^\s*filename:\s+/im,
];
const SECRET_LEAK_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{20,}/i,
  /DefaultEndpointsProtocol=.*;AccountName=.*;AccountKey=.*;/i,
  /SharedAccessSignature=/i,
  /x-ms-client-principal/i,
  /AZURE_OPENAI_API_KEY\s*=/i,
  /GITHUB_TOKEN\s*=/i,
  /CONNECTION_STRING\s*=/i,
  /Traceback \(most recent call last\):/i,
  /BEGIN SYSTEM PROMPT|END SYSTEM PROMPT|<tool_output>|<\|im_start\|>/i,
];

const STEP_SPECIFIC_PROMPTS: Record<SetupGenerationStepId, string> = {
  "app-scaffolding": [
    "Generate the application starter files only.",
    "Create a working project skeleton that matches the runtime inferred from the transcript.",
    "Include the dependency manifest, a main entry point, a health endpoint, and a concise README when space allows.",
    "Do not generate Docker, infrastructure, or CI files in this step.",
  ].join("\n"),
  dockerfile: [
    "Generate only the containerization files for this project.",
    "Prefer Dockerfile and .dockerignore when useful.",
    "Use multi-stage builds, non-root execution, and pinned base images.",
    "Do not generate application source files, infrastructure, or CI files in this step.",
  ].join("\n"),
  "deployment-config": [
    "Generate only deployment and infrastructure configuration files.",
    "Prefer production-ready AKS Automatic defaults, managed identity/workload identity, and least-privilege service wiring.",
    "Stay within 2-4 files total and keep cross-file names consistent.",
    "Do not generate CI or application source files in this step.",
  ].join("\n"),
  "ci-cd": [
    "Generate only CI/CD automation files for build, test, image publish, and deploy.",
    "Prefer GitHub Actions with workload identity / OIDC placeholders instead of static secrets.",
    "Do not generate application, Docker, or infrastructure files in this step.",
  ].join("\n"),
  "service-connections": [
    "Generate only the files needed to wire backing services into the app runtime.",
    "Prefer env templates, typed config modules, or concise connection docs over ad-hoc notes.",
    "Do not emit secrets, real tokens, stack traces, or diagnostic dumps.",
  ].join("\n"),
};

const LANGUAGE_BY_EXTENSION: Record<string, SetupGenerationFileLanguage> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  py: "python",
  yaml: "yaml",
  yml: "yaml",
  json: "json",
  dockerfile: "dockerfile",
  bicep: "bicep",
  go: "go",
  sh: "shell",
  bash: "shell",
  html: "html",
  css: "css",
  md: "markdown",
  dockerignore: "ignore",
  gitignore: "ignore",
  env: "dotenv",
  toml: "toml",
};

export interface SetupGenerationExecutionResult {
  message: string;
  currentPhase: Phase;
  usage?: ChatUsage;
  events: SetupGenerationEvent[];
  a2uiMessages: Array<A2UIMessage | object>;
  snapshot: SetupGenerationSnapshot;
}

export function isSetupGenerationFailure(
  value: unknown,
): value is SetupGenerationFailure {
  return value instanceof SetupGenerationFailure;
}

interface StepGenerationCandidate {
  path: string;
  language?: string;
  content: string;
}

interface ValidatedGeneratedFile {
  path: string;
  language: string;
  content: string;
  byteLength: number;
  sha256: string;
}

interface StepGenerationResult {
  files: ValidatedGeneratedFile[];
  usage?: ChatUsage;
}

interface SetupGenerationExecutionHooks {
  emitA2ui?: (messages: Array<A2UIMessage | object>) => Promise<void> | void;
  emitEvent?: (event: SetupGenerationEvent) => Promise<void> | void;
}

interface StepwisePlan {
  includeAppScaffolding: boolean;
  includeServiceConnections: boolean;
}

export class SetupGenerationFailure extends Error {
  code: SetupGenerationErrorCode;
  recoverable: boolean;

  constructor(
    code: SetupGenerationErrorCode,
    message: string,
    options: { recoverable: boolean },
  ) {
    super(message);
    this.name = "SetupGenerationFailure";
    this.code = code;
    this.recoverable = options.recoverable;
  }
}

export function isStepwiseGenerationEnabled(): boolean {
  return process.env[STEPWISE_GENERATION_FLAG] === "true";
}

export function isSetupGenerationControlAction(
  value: string | undefined,
): value is SetupGenerationControlAction {
  return value === "retry-current-step" || value === "stop-generation";
}

export function shouldUseStepwiseGeneration(
  session: Pick<ApiSession, "routingPhaseTrusted" | "setupGenerationTrusted">,
  phase: Phase,
): boolean {
  if (!isStepwiseGenerationEnabled()) return false;
  if (phase !== Phase.Generate) return false;
  return session.routingPhaseTrusted || session.setupGenerationTrusted;
}

export function createSetupGenerationRunState(
  session: Pick<ApiSession, "state">,
): SetupGenerationRunState {
  const plan = inferStepwisePlan(session.state.messages);
  const steps: SetupGenerationStepState[] = SETUP_GENERATION_STEP_ORDER.map((id) => {
    const required = id === "app-scaffolding"
      ? plan.includeAppScaffolding
      : id === "service-connections"
        ? plan.includeServiceConnections
        : true;

    return {
      id,
      label: SETUP_GENERATION_STEP_LABELS[id],
      required,
      status: required ? "pending" : "skipped",
    };
  });

  return {
    runId: randomUUID(),
    phase: "generate",
    currentStepIndex: findNextRunnableStepIndex(steps),
    steps,
    status: "idle",
    generatedFiles: [],
    totalBytes: 0,
    updatedAt: new Date().toISOString(),
  };
}

export function getSetupGenerationSnapshot(
  session: Pick<ApiSession, "setupGenerationRun">,
): SetupGenerationSnapshot | undefined {
  if (!session.setupGenerationRun) return undefined;
  return {
    run: cloneSetupGenerationRun(session.setupGenerationRun),
  };
}

export function buildSetupGenerationProgressA2UI(
  run: SetupGenerationRunState,
  options: {
    surfaceId: string;
    includeCreateSurface?: boolean;
    statusMessage: string;
    errorCode?: string;
    errorMessage?: string;
  },
): A2UIMessage[] {
  const steps = run.steps.map((step) => ({
    id: step.id,
    label: step.label,
    status: step.status,
  }));

  const progressComponent = {
    id: "setup-progress",
    component: "DeploymentProgress",
    title: "Project Setup",
    runId: run.runId,
    overallStatus: mapRunStatusToOverallStatus(run.status),
    statusMessage: options.statusMessage,
    ...(options.errorCode ? { errorCode: options.errorCode } : {}),
    ...(options.errorMessage ? { errorMessage: options.errorMessage } : {}),
    lastUpdated: run.updatedAt,
    steps,
  };

  const messages: A2UIMessage[] = [];
  if (options.includeCreateSurface) {
    messages.push({
      version: "v0.9",
      createSurface: {
        surfaceId: options.surfaceId,
        catalogId: "kickstart",
      },
    });
  }
  messages.push({
    version: "v0.9",
    updateComponents: {
      surfaceId: options.surfaceId,
      components: [progressComponent],
    },
  });
  return messages;
}

export async function executeSetupGeneration(
  session: ApiSession,
  options: {
    controlAction?: SetupGenerationControlAction;
    surfaceId: string;
    hooks?: SetupGenerationExecutionHooks;
  },
): Promise<SetupGenerationExecutionResult> {
  const hooks = options.hooks ?? {};
  const a2uiMessages: Array<A2UIMessage | object> = [];
  const events: SetupGenerationEvent[] = [];
  let accumulatedUsage: ChatUsage | undefined;

  const emitA2ui = async (messages: Array<A2UIMessage | object>) => {
    if (messages.length === 0) return;
    a2uiMessages.push(...messages);
    await hooks.emitA2ui?.(messages);
  };

  const emitEvent = async (event: SetupGenerationEvent) => {
    events.push(event);
    await hooks.emitEvent?.(event);
  };

  const strictCodexDeployment = getStrictCodexDeploymentName();
  if (!strictCodexDeployment) {
    throw new SetupGenerationFailure(
      "codex_error",
      "Setup generation is unavailable until AZURE_OPENAI_CODEX_DEPLOYMENT is configured.",
      { recoverable: false },
    );
  }

  if (!session.setupGenerationRun) {
    session.setupGenerationRun = createSetupGenerationRunState(session);
    session.setupGenerationTrusted = true;
  }

  const run = session.setupGenerationRun;
  run.updatedAt = new Date().toISOString();

  if (options.controlAction === "stop-generation") {
    run.status = "paused";
    run.updatedAt = new Date().toISOString();
    const stopMessage = "Setup generation stopped. Files from completed steps remain in the workspace.";
    const stopA2ui = buildSetupGenerationProgressA2UI(run, {
      surfaceId: options.surfaceId,
      includeCreateSurface: true,
      statusMessage: stopMessage,
    });
    await emitA2ui(stopA2ui);
    return {
      message: stopMessage,
      currentPhase: Phase.Generate,
      events,
      a2uiMessages,
      snapshot: { run: cloneSetupGenerationRun(run) },
    };
  }

  if (run.status === "paused" && run.lastError && options.controlAction !== "retry-current-step") {
    throw new SetupGenerationFailure(
      run.lastError.code,
      "Setup generation is paused. Retry the current step or stop generation.",
      { recoverable: run.lastError.recoverable },
    );
  }

  if (options.controlAction === "retry-current-step") {
    const currentStep = run.steps[run.currentStepIndex];
    if (!currentStep || currentStep.status !== "error") {
      throw new SetupGenerationFailure(
        "validation_failed",
        "There is no failed setup step to retry.",
        { recoverable: false },
      );
    }
    currentStep.status = "pending";
    delete run.lastError;
    run.status = "idle";
    run.updatedAt = new Date().toISOString();
  }

  await emitA2ui([
    ...buildSetupGenerationProgressA2UI(run, {
      surfaceId: options.surfaceId,
      includeCreateSurface: true,
      statusMessage: "Preparing setup generation.",
    }),
  ]);

  while (true) {
    const nextIndex = findNextExecutableStepIndex(run);
    run.updatedAt = new Date().toISOString();

    if (nextIndex < 0) {
      run.status = "complete";
      run.currentStepIndex = Math.max(run.steps.length - 1, 0);
      run.updatedAt = new Date().toISOString();
      const completeMessage = "Setup files are ready in the workspace. Next up: review the plan and deployment defaults.";
      await emitA2ui(buildSetupGenerationProgressA2UI(run, {
        surfaceId: options.surfaceId,
        statusMessage: completeMessage,
      }));
      return {
        message: completeMessage,
        currentPhase: Phase.Review,
        usage: accumulatedUsage,
        events,
        a2uiMessages,
        snapshot: { run: cloneSetupGenerationRun(run) },
      };
    }

    run.currentStepIndex = nextIndex;

    const step = run.steps[nextIndex]!;
    step.status = "running";
    run.status = "running";
    run.updatedAt = new Date().toISOString();

    const startEvent = createStepStartEvent(run, step, nextIndex);
    await emitEvent(startEvent);
    await emitA2ui(buildSetupGenerationProgressA2UI(run, {
      surfaceId: options.surfaceId,
      statusMessage: `Running ${step.label.toLowerCase()}...`,
    }));

    try {
      const stepResult = await generateStepFiles(
        session,
        run,
        step.id,
        strictCodexDeployment,
      );
      accumulatedUsage = sumChatUsage(accumulatedUsage, stepResult.usage);

      for (const file of stepResult.files) {
        const fileEvent = createFileGeneratedEvent(step.id, file);
        await emitEvent(fileEvent);
        const artifact = extractArtifactMetadata(file.path, file.language, file.content);
        upsertArtifact(session.generatedArtifacts, artifact);
        run.generatedFiles.push({
          stepId: step.id,
          path: file.path,
          language: file.language,
          byteLength: file.byteLength,
          sha256: file.sha256,
        });
        run.totalBytes += file.byteLength;
      }

      step.status = "complete";
      delete run.lastError;
      run.updatedAt = new Date().toISOString();

      await emitEvent({
        type: "step_complete",
        stepId: step.id,
        filesCount: stepResult.files.length,
        totalBytes: stepResult.files.reduce((sum, file) => sum + file.byteLength, 0),
      });
      await emitA2ui(buildSetupGenerationProgressA2UI(run, {
        surfaceId: options.surfaceId,
        statusMessage: `${step.label} complete.`,
      }));
    } catch (error) {
      const failure = normalizeSetupGenerationFailure(error);
      step.status = "error";
      run.status = "paused";
      run.lastError = {
        stepId: step.id,
        code: failure.code,
        message: failure.message,
        recoverable: failure.recoverable,
        occurredAt: new Date().toISOString(),
      };
      run.updatedAt = run.lastError.occurredAt;

      await emitEvent({
        type: "step_error",
        stepId: step.id,
        code: failure.code,
        message: failure.message,
        recoverable: failure.recoverable,
      });
      await emitA2ui(buildSetupGenerationProgressA2UI(run, {
        surfaceId: options.surfaceId,
        statusMessage: `${step.label} failed. Retry the current step or stop generation.`,
        errorCode: failure.code,
        errorMessage: failure.message,
      }));

      return {
        message: `${step.label} failed. Retry the current step or stop generation.`,
        currentPhase: Phase.Generate,
        usage: accumulatedUsage,
        events,
        a2uiMessages,
        snapshot: { run: cloneSetupGenerationRun(run) },
      };
    }
  }
}

export function serializeSetupGenerationEvent(
  event: SetupGenerationEvent,
): string {
  switch (event.type) {
    case "step_start":
      return JSON.stringify({
        stepId: event.stepId,
        label: event.label,
        sequence: event.sequence,
      });
    case "file_generated":
      return JSON.stringify({
        stepId: event.stepId,
        path: event.path,
        language: event.language,
        content: event.content,
        byteLength: event.byteLength,
        sha256: event.sha256,
      });
    case "step_complete":
      return JSON.stringify({
        stepId: event.stepId,
        filesCount: event.filesCount,
        totalBytes: event.totalBytes,
      });
    case "step_error":
      return JSON.stringify({
        stepId: event.stepId,
        code: event.code,
        message: event.message,
        recoverable: event.recoverable,
      });
  }
}

function createStepStartEvent(
  run: SetupGenerationRunState,
  step: SetupGenerationStepState,
  index: number,
): SetupGenerationEvent {
  return {
    type: "step_start",
    stepId: step.id,
    label: step.label,
    sequence: computeStepSequence(run, index),
  };
}

function createFileGeneratedEvent(
  stepId: SetupGenerationStepId,
  file: ValidatedGeneratedFile,
): SetupGenerationEvent {
  return {
    type: "file_generated",
    stepId,
    path: file.path,
    language: file.language,
    content: file.content,
    byteLength: file.byteLength,
    sha256: file.sha256,
  };
}

async function generateStepFiles(
  session: ApiSession,
  run: SetupGenerationRunState,
  stepId: SetupGenerationStepId,
  strictCodexDeployment: string,
): Promise<StepGenerationResult> {
  const prompt = buildStepPrompt(session, run, stepId);
  const firstAttempt = await callCodexCompletionWithRetry(
    [{ role: "user", content: prompt.userContent } satisfies ChatMessage],
    {
      instructions: prompt.instructions,
      maxOutputTokens: 12_000,
      deployment: strictCodexDeployment,
    },
  );

  let usage = firstAttempt.usage;
  let parsed = parseStepGenerationResponse(firstAttempt.content);

  if (!parsed) {
    const repaired = await callCodexCompletionWithRetry(
      [{ role: "user", content: buildRepairPrompt(firstAttempt.content) } satisfies ChatMessage],
      {
        instructions: [
          "Repair the previous setup-generation output into valid JSON only.",
          'Return exactly {"files":[{"path":"...","language":"...","content":"..."}]} with no markdown fences or commentary.',
          "Preserve file contents exactly when possible.",
        ].join("\n"),
        maxOutputTokens: 12_000,
        deployment: strictCodexDeployment,
      },
    );
    usage = sumChatUsage(usage, repaired.usage);
    parsed = parseStepGenerationResponse(repaired.content);
  }

  if (!parsed) {
    throw new SetupGenerationFailure(
      "codex_error",
      "The generation model returned an invalid file batch. Retry the current step.",
      { recoverable: true },
    );
  }

  return {
    files: validateGeneratedFiles(parsed.files, run, stepId),
    usage,
  };
}

function buildStepPrompt(
  session: ApiSession,
  run: SetupGenerationRunState,
  stepId: SetupGenerationStepId,
): { instructions: string; userContent: string } {
  const transcript = buildTranscriptSummary(session.state.messages);
  const artifacts = buildArtifactSummary(session.generatedArtifacts);
  const step = run.steps.find((candidate) => candidate.id === stepId);
  const knownAppDefinition = Object.keys(session.state.appDefinition).length > 0
    ? JSON.stringify(session.state.appDefinition, null, 2)
    : "{}";

  return {
    instructions: [
      "You are Kickstart's setup generation backend.",
      "The server already chose the current step. Never invent, rename, skip, or reorder setup steps.",
      'Return ONLY valid JSON in this exact shape: {"files":[{"path":"relative/path","language":"typescript","content":"file body"}]}.',
      `Current step: ${step?.label ?? SETUP_GENERATION_STEP_LABELS[stepId]} (${stepId}).`,
      `Emit between 1 and ${SETUP_GENERATION_QUOTAS.maxFilesPerStep} files for this step only.`,
      "All paths must be relative repo paths. No leading slash. No parent traversal.",
      "Do not include markdown fences, commentary, tool outputs, prompts, diagnostics, secrets, or stack traces.",
      "Keep names consistent with previously generated files.",
      STEP_SPECIFIC_PROMPTS[stepId],
    ].join("\n"),
    userContent: [
      "Project context (latest transcript excerpt):",
      transcript || "No transcript available.",
      "",
      "Known app definition JSON:",
      knownAppDefinition,
      "",
      "Generated artifacts so far:",
      artifacts || "None yet.",
    ].join("\n"),
  };
}

function buildRepairPrompt(rawContent: string): string {
  const trimmed = rawContent.slice(0, MAX_CODEX_RESPONSE_CHARS);
  return [
    "The previous setup-generation output was invalid JSON.",
    "Repair it into valid JSON only.",
    'Required shape: {"files":[{"path":"relative/path","language":"typescript","content":"file body"}]}',
    "Do not wrap the JSON in markdown fences.",
    "Previous output:",
    trimmed,
  ].join("\n");
}

function parseStepGenerationResponse(
  rawContent: string,
): { files: StepGenerationCandidate[] } | undefined {
  const trimmed = rawContent.trim();
  if (!trimmed) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return undefined;
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return undefined;
  }

  const record = parsed as { files?: unknown };
  if (!Array.isArray(record.files)) {
    return undefined;
  }

  const files = record.files
    .map((file): StepGenerationCandidate | null => {
      if (!file || typeof file !== "object" || Array.isArray(file)) {
        return null;
      }
      const candidate = file as Record<string, unknown>;
      return {
        path: typeof candidate.path === "string" ? candidate.path : "",
        language: typeof candidate.language === "string" ? candidate.language : undefined,
        content: typeof candidate.content === "string" ? candidate.content : "",
      };
    })
    .filter((file): file is StepGenerationCandidate => file !== null);

  return files.length > 0 ? { files } : undefined;
}

function validateGeneratedFiles(
  files: StepGenerationCandidate[],
  run: SetupGenerationRunState,
  stepId: SetupGenerationStepId,
): ValidatedGeneratedFile[] {
  if (files.length > SETUP_GENERATION_QUOTAS.maxFilesPerStep) {
    throw new SetupGenerationFailure(
      "quota_exceeded",
      `This setup step exceeded the maximum of ${SETUP_GENERATION_QUOTAS.maxFilesPerStep} files.`,
      { recoverable: false },
    );
  }

  if (run.generatedFiles.length + files.length > SETUP_GENERATION_QUOTAS.maxFilesPerSession) {
    throw new SetupGenerationFailure(
      "quota_exceeded",
      `This session exceeded the maximum of ${SETUP_GENERATION_QUOTAS.maxFilesPerSession} generated files.`,
      { recoverable: false },
    );
  }

  const existingPaths = new Set(run.generatedFiles.map((file) => file.path));
  const seenPaths = new Set<string>();
  const validated: ValidatedGeneratedFile[] = [];
  let stepBytes = 0;

  for (const file of files) {
    if (!file.path || !file.content) {
      throw new SetupGenerationFailure(
        "validation_failed",
        `The ${SETUP_GENERATION_STEP_LABELS[stepId]} step returned an incomplete file entry.`,
        { recoverable: false },
      );
    }

    const path = normalizeGeneratedPath(file.path);
    if (seenPaths.has(path) || existingPaths.has(path)) {
      throw new SetupGenerationFailure(
        "validation_failed",
        `The ${SETUP_GENERATION_STEP_LABELS[stepId]} step returned a duplicate file path.`,
        { recoverable: false },
      );
    }
    seenPaths.add(path);

    validateFileContent(file.content, stepId);

    const byteLength = new TextEncoder().encode(file.content).length;
    if (byteLength > SETUP_GENERATION_QUOTAS.maxBytesPerFile) {
      throw new SetupGenerationFailure(
        "quota_exceeded",
        `Generated file ${path} exceeded the ${SETUP_GENERATION_QUOTAS.maxBytesPerFile} byte limit.`,
        { recoverable: false },
      );
    }

    stepBytes += byteLength;
    if (stepBytes > SETUP_GENERATION_QUOTAS.maxBytesPerStep) {
      throw new SetupGenerationFailure(
        "quota_exceeded",
        `The ${SETUP_GENERATION_STEP_LABELS[stepId]} step exceeded the total byte limit.`,
        { recoverable: false },
      );
    }
    if (run.totalBytes + stepBytes > SETUP_GENERATION_QUOTAS.maxBytesPerSession) {
      throw new SetupGenerationFailure(
        "quota_exceeded",
        `This session exceeded the ${SETUP_GENERATION_QUOTAS.maxBytesPerSession} byte limit for generated files.`,
        { recoverable: false },
      );
    }

    validated.push({
      path,
      language: normalizeGeneratedLanguage(file.language, path),
      content: file.content,
      byteLength,
      sha256: createHash("sha256").update(file.content, "utf8").digest("hex"),
    });
  }

  return validated;
}

function normalizeGeneratedPath(rawPath: string): string {
  const trimmed = rawPath.trim();
  if (!trimmed || trimmed.includes("\0") || DRIVE_LETTER_RE.test(trimmed)) {
    throw new SetupGenerationFailure(
      "validation_failed",
      "Generated files must use safe relative paths.",
      { recoverable: false },
    );
  }

  const normalized = pathPosix.normalize(trimmed);
  if (
    normalized === "."
    || normalized.startsWith("../")
    || normalized.includes("/../")
    || normalized.startsWith("/")
    || normalized.length > 180
    || normalized.split("/").length > 8
    || !PATH_ALLOWLIST_RE.test(normalized)
  ) {
    throw new SetupGenerationFailure(
      "validation_failed",
      "Generated files must use safe relative paths.",
      { recoverable: false },
    );
  }

  return normalized;
}

function validateFileContent(
  content: string,
  stepId: SetupGenerationStepId,
): void {
  if (content.includes("\0") || FILE_CONTENT_FENCE_RE.test(content.trim())) {
    throw new SetupGenerationFailure(
      "validation_failed",
      `The ${SETUP_GENERATION_STEP_LABELS[stepId]} step returned unsupported file content.`,
      { recoverable: false },
    );
  }

  if (MULTI_FILE_WRAPPER_PATTERNS.some((pattern) => pattern.test(content))) {
    throw new SetupGenerationFailure(
      "validation_failed",
      `The ${SETUP_GENERATION_STEP_LABELS[stepId]} step returned a multi-file wrapper instead of a single file body.`,
      { recoverable: false },
    );
  }

  if (SECRET_LEAK_PATTERNS.some((pattern) => pattern.test(content))) {
    throw new SetupGenerationFailure(
      "validation_failed",
      `The ${SETUP_GENERATION_STEP_LABELS[stepId]} step returned sensitive or diagnostic output.`,
      { recoverable: false },
    );
  }
}

function normalizeGeneratedLanguage(
  rawLanguage: string | undefined,
  path: string,
): string {
  if (
    rawLanguage
    && SETUP_GENERATION_FILE_LANGUAGE_ALLOWLIST.includes(
      rawLanguage as SetupGenerationFileLanguage,
    )
  ) {
    return rawLanguage;
  }

  const filename = path.split("/").pop() ?? path;
  if (filename === "Dockerfile") return "dockerfile";
  if (filename === ".dockerignore" || filename === ".gitignore") return "ignore";
  if (filename === ".env" || filename === ".env.template") return "dotenv";

  const ext = filename.includes(".")
    ? filename.split(".").pop()?.toLowerCase() ?? ""
    : filename.toLowerCase();
  return LANGUAGE_BY_EXTENSION[ext] ?? "plaintext";
}

function inferStepwisePlan(
  messages: readonly { role?: string; content: string }[],
): StepwisePlan {
  const transcript = messages
    .filter((message) => message.role !== "system")
    .map((message) => message.content.toLowerCase())
    .join("\n");

  const includeAppScaffolding = /starting fresh|from scratch|no existing code/.test(transcript);
  const includeServiceConnections = /\b(postgres|mysql|mongodb|cosmos|redis|database|cache|queue|service bus|search|vector|key vault|openai)\b/.test(transcript);

  return {
    includeAppScaffolding,
    includeServiceConnections,
  };
}

function buildTranscriptSummary(
  messages: readonly { role?: string; content: string }[],
): string {
  const transcript = messages
    .filter((message) => message.role !== "system")
    .slice(-12)
    .map((message) => `${message.role ?? "user"}: ${message.content.trim()}`)
    .join("\n\n");
  return transcript.slice(-MAX_TRANSCRIPT_CHARS);
}

function buildArtifactSummary(
  artifacts: readonly { filename: string; bicepResources: string[]; k8sResources: string[] }[],
): string {
  if (artifacts.length === 0) return "";

  const lines = [
    `Files generated so far: ${artifacts.map((artifact) => artifact.filename).join(", ")}`,
  ];
  const bicepResources = artifacts.flatMap((artifact) => artifact.bicepResources);
  if (bicepResources.length > 0) {
    lines.push(`Azure resources declared: ${bicepResources.join(", ")}`);
  }
  const k8sResources = artifacts.flatMap((artifact) => artifact.k8sResources);
  if (k8sResources.length > 0) {
    lines.push(`Kubernetes resources declared: ${k8sResources.join(", ")}`);
  }
  return lines.join("\n").slice(0, MAX_ARTIFACT_SUMMARY_CHARS);
}

async function callCodexCompletionWithRetry(
  input: ChatMessage[],
  options: Parameters<typeof codexCompletion>[1],
) {
  try {
    return await codexCompletion(input, options);
  } catch (firstError) {
    if (!shouldRetryCodexError(firstError)) {
      throw firstError;
    }
    return codexCompletion(input, options);
  }
}

function getStrictCodexDeploymentName(): string | undefined {
  const deployment = process.env.AZURE_OPENAI_CODEX_DEPLOYMENT?.trim();
  return deployment ? deployment : undefined;
}

function findNextRunnableStepIndex(
  steps: readonly SetupGenerationStepState[],
): number {
  return steps.findIndex((step) => step.status === "pending" || step.status === "error");
}

function findNextExecutableStepIndex(
  run: SetupGenerationRunState,
): number {
  for (let index = 0; index < run.steps.length; index += 1) {
    const step = run.steps[index];
    if (step?.status === "pending" || step?.status === "error") {
      return index;
    }
  }
  return -1;
}

function computeStepSequence(
  run: SetupGenerationRunState,
  currentIndex: number,
): number {
  const activeSteps = run.steps.filter((step) => step.required);
  const currentId = run.steps[currentIndex]?.id;
  const activeIndex = activeSteps.findIndex((step) => step.id === currentId);
  return activeIndex >= 0 ? activeIndex + 1 : currentIndex + 1;
}

function mapRunStatusToOverallStatus(
  status: SetupGenerationRunState["status"],
): "idle" | "running" | "complete" | "error" {
  switch (status) {
    case "complete":
      return "complete";
    case "running":
      return "running";
    case "paused":
    case "failed":
      return "error";
    default:
      return "idle";
  }
}

function normalizeSetupGenerationFailure(error: unknown): SetupGenerationFailure {
  if (error instanceof SetupGenerationFailure) {
    return error;
  }

  const detail = error instanceof Error ? error.message : String(error);
  if (/timeout/i.test(detail)) {
    return new SetupGenerationFailure(
      "codex_timeout",
      "The generation model timed out. Retry the current step.",
      { recoverable: true },
    );
  }

  return new SetupGenerationFailure(
    "codex_error",
    "The generation model failed before it could finish this step. Retry the current step.",
    { recoverable: true },
  );
}

function shouldRetryCodexError(error: unknown): boolean {
  const detail = error instanceof Error ? error.message : String(error);
  return /timeout|timed out|network|502|503|504/i.test(detail);
}
