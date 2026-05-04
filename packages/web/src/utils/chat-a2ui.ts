import type {
  A2uiComponent,
  A2uiMsg,
  A2uiPayloadItem,
  ChatMessage,
  ConversationPhaseId,
  SetupGenerationEvent,
} from '../types';

const PHASE_COMPONENT_NAME = 'ConversationPhase';
const PHASE_SURFACE_ID = 'phase-indicator';
const SURFACE_SCOPE_SEPARATOR = '::';
const STEPWISE_SETUP_SURFACE_SUFFIX = 'setup-progress';
const SHARED_SURFACE_PREFIX = 'shared:';

const PHASE_ALIASES = {
  discover: 'discover',
  plan: 'design',
  design: 'design',
  build: 'generate',
  generate: 'generate',
  review: 'review',
  validate: 'review',
  handoff: 'handoff',
  deploy: 'deploy',
} as const satisfies Record<string, ConversationPhaseId>;

const EXTENSION_LANGUAGES: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  py: 'python',
  yaml: 'yaml',
  yml: 'yaml',
  json: 'json',
  md: 'markdown',
  css: 'css',
  html: 'html',
  sh: 'shell',
  bash: 'shell',
  dockerfile: 'dockerfile',
  bicep: 'bicep',
  go: 'go',
};

const FILE_NAME_LANGUAGES: Record<string, string> = {
  Dockerfile: 'dockerfile',
  '.dockerignore': 'ignore',
  '.gitignore': 'ignore',
  '.env': 'dotenv',
  '.env.template': 'dotenv',
};

export const GENERATION_PROGRESS_TITLE = 'Project Setup';

export const CONVERSATION_PHASE_ORDER = [
  'discover',
  'design',
  'generate',
  'review',
  'handoff',
  'deploy',
] as const satisfies readonly ConversationPhaseId[];

export const CONVERSATION_PHASE_LABELS: Record<ConversationPhaseId, string> = {
  discover: 'Discover',
  design: 'Design',
  generate: 'Generate',
  review: 'Review',
  handoff: 'Handoff',
  deploy: 'Deploy',
};

export interface GeneratedChatFile {
  path: string;
  content: string;
  language?: string;
}

export interface PrepareChatA2uiOptions {
  currentPhase?: string | null;
  resolveArtifactContent?: (artifactPath: string) => string | null | undefined;
}

export interface PreparedChatA2ui {
  storedMessages: A2uiPayloadItem[];
  renderableMessages: A2uiMsg[];
  files: GeneratedChatFile[];
  phase: ConversationPhaseId | null;
}

interface StepwiseSetupStepState {
  id: string;
  label: string;
  sequence: number;
  status: 'pending' | 'running' | 'complete' | 'error' | 'skipped';
  detail?: string;
}

export interface StepwiseSetupState {
  steps: StepwiseSetupStepState[];
  statusText: string;
  errorCode?: string;
  errorMessage?: string;
  recoverableError?: boolean;
}

export interface PreparedStepwiseSetup {
  renderableMessages: A2uiMsg[];
  files: GeneratedChatFile[];
  phase: 'generate';
  statusText: string;
  state: StepwiseSetupState;
}

export function createStepwiseSetupState(): StepwiseSetupState {
  return {
    steps: [],
    statusText: 'Preparing project setup…',
  };
}

export function getStepwiseSetupSurfaceId(turnId: string): string {
  return `${turnId}${SURFACE_SCOPE_SEPARATOR}${STEPWISE_SETUP_SURFACE_SUFFIX}`;
}

export function getSetupEventKey(event: SetupGenerationEvent): string {
  switch (event.type) {
    case 'step_start':
      return `step_start:${event.stepId}:${event.sequence}`;
    case 'file_generated':
      return `file_generated:${event.stepId}:${event.path}:${event.sha256}`;
    case 'step_complete':
      return `step_complete:${event.stepId}:${event.filesCount}:${event.totalBytes}`;
    case 'step_error':
      return `step_error:${event.stepId}:${event.code}:${event.message}`;
    default:
      return JSON.stringify(event);
  }
}

export function redactSetupEvent(event: SetupGenerationEvent): SetupGenerationEvent {
  if (event.type !== 'file_generated') {
    return event;
  }

  const { content: _content, ...metadataOnly } = event;
  return metadataOnly;
}

export function applyStepwiseSetupEvent(
  state: StepwiseSetupState,
  event: SetupGenerationEvent,
): StepwiseSetupState {
  const steps = state.steps.map((step) => ({ ...step }));

  switch (event.type) {
    case 'step_start': {
      const step = upsertStep(steps, event.stepId, {
        label: event.label,
        sequence: event.sequence,
      });
      step.status = 'running';
      step.detail = 'Generating…';

      return {
        steps: sortStepwiseSetupSteps(steps),
        statusText: `Generating ${step.label}…`,
      };
    }

    case 'file_generated': {
      const step = upsertStep(steps, event.stepId);
      if (step.status === 'running' && !step.detail) {
        step.detail = 'Generating…';
      }
      const basename = event.path.split('/').pop() ?? event.path;
      const nextState: StepwiseSetupState = {
        steps: sortStepwiseSetupSteps(steps),
        statusText: `${basename} added to the workspace.`,
      };

      if (state.errorMessage) {
        nextState.errorCode = state.errorCode;
        nextState.errorMessage = state.errorMessage;
        nextState.recoverableError = state.recoverableError;
      }

      return nextState;
    }

    case 'step_complete': {
      const step = upsertStep(steps, event.stepId);
      step.status = 'complete';
      step.detail = formatStepCompletionDetail(event.filesCount, event.totalBytes);

      return {
        steps: sortStepwiseSetupSteps(steps),
        statusText: buildStepCompletionStatus(step.label, event.filesCount),
      };
    }

    case 'step_error': {
      const step = upsertStep(steps, event.stepId);
      step.status = 'error';
      step.detail = event.message;

      return {
        steps: sortStepwiseSetupSteps(steps),
        statusText: buildStepErrorStatus(step.label, event.message),
        errorCode: event.code,
        errorMessage: event.message,
        recoverableError: event.recoverable,
      };
    }
  }
}

export function buildStepwiseSetupMessages(
  state: StepwiseSetupState,
  turnId: string,
  options: {
    includeCreateSurface?: boolean;
    final?: boolean;
  } = {},
): A2uiMsg[] {
  if (state.steps.length === 0) {
    return [];
  }

  const surfaceId = getStepwiseSetupSurfaceId(turnId);
  const overallStatus = getStepwiseOverallStatus(state, options.final ?? false);
  const statusMessage = state.errorMessage
    ? buildStepwiseRecoveryStatus(state)
    : ((options.final ?? false) ? buildFinalStepwiseStatus(state) : state.statusText);
  const components: A2uiComponent[] = [{
    id: 'root',
    component: 'GenerationProgress',
    title: GENERATION_PROGRESS_TITLE,
    overallStatus,
    statusMessage,
    ...(state.errorMessage ? {
      errorCode: state.errorCode,
      errorMessage: state.errorMessage,
    } : {}),
    steps: state.steps.map((step) => ({
      id: step.id,
      label: step.label,
      status: step.status,
      ...(step.detail ? { detail: step.detail } : {}),
    })),
  }];

  const messages: A2uiMsg[] = [];
  if (options.includeCreateSurface ?? true) {
    messages.push({
      version: 'v0.9',
      createSurface: {
        surfaceId,
        catalogId: 'kickstart',
      },
    });
  }
  messages.push({
    version: 'v0.9',
    updateComponents: {
      surfaceId,
      components,
    },
  });
  return messages;
}

export function prepareStepwiseSetup(
  events: readonly SetupGenerationEvent[],
  turnId: string,
  options: {
    final?: boolean;
  } = {},
): PreparedStepwiseSetup {
  const files: GeneratedChatFile[] = [];
  const seenEvents = new Set<string>();
  let state = createStepwiseSetupState();

  for (const event of events) {
    const key = getSetupEventKey(event);
    if (seenEvents.has(key)) {
      continue;
    }
    seenEvents.add(key);

    state = applyStepwiseSetupEvent(state, event);
    if (event.type === 'file_generated' && typeof event.content === 'string') {
      files.push({
        path: event.path,
        content: event.content,
        language: event.language,
      });
    }
  }

  return {
    renderableMessages: buildStepwiseSetupMessages(state, turnId, {
      includeCreateSurface: true,
      final: options.final,
    }),
    files,
    phase: 'generate',
    statusText: (options.final ?? false) ? buildFinalStepwiseStatus(state) : state.statusText,
    state,
  };
}

export function normalizeConversationPhase(phase: string | null | undefined): ConversationPhaseId | null {
  if (!phase) return null;

  const normalized = phase.trim().toLowerCase();
  if (!normalized) return null;
  if (!(normalized in PHASE_ALIASES)) return null;

  return PHASE_ALIASES[normalized as keyof typeof PHASE_ALIASES];
}

export function isA2uiMessage(item: A2uiPayloadItem): item is A2uiMsg {
  return Boolean(
    'version' in item
    || 'createSurface' in item
    || 'updateComponents' in item
    || 'updateDataModel' in item
    || 'deleteSurface' in item,
  );
}

function isConversationPhaseComponent(component: unknown): component is Record<string, unknown> {
  if (!component || typeof component !== 'object') return false;
  const candidate = component as Record<string, unknown>;
  return candidate.component === PHASE_COMPONENT_NAME
    || candidate.type === PHASE_COMPONENT_NAME
    || (candidate.type === 'createSurface' && candidate.component === PHASE_COMPONENT_NAME);
}

function extractPhaseFromPhaseList(phases: unknown): ConversationPhaseId | null {
  if (!Array.isArray(phases)) return null;

  const activePhase = phases.find((phase): phase is { id?: string; status?: string } =>
    Boolean(phase)
    && typeof phase === 'object'
    && (phase as { status?: string }).status === 'active'
    && typeof (phase as { id?: string }).id === 'string',
  );

  return normalizeConversationPhase(activePhase?.id);
}

function extractPhaseFromComponent(component: unknown): ConversationPhaseId | null {
  if (!isConversationPhaseComponent(component)) return null;

  const candidate = component as Record<string, unknown>;
  if (typeof candidate.currentPhase === 'string') {
    return normalizeConversationPhase(candidate.currentPhase);
  }

  return extractPhaseFromPhaseList(candidate.phases);
}

export function extractConversationPhase(items: readonly A2uiPayloadItem[]): ConversationPhaseId | null {
  for (const item of items) {
    const directPhase = extractPhaseFromComponent(item);
    if (directPhase) return directPhase;

    if (isA2uiMessage(item) && item.updateComponents?.components) {
      for (const component of item.updateComponents.components) {
        const componentPhase = extractPhaseFromComponent(component);
        if (componentPhase) return componentPhase;
      }
    }
  }

  return null;
}

function scopeSurfaceId(surfaceId: string, turnId: string): string {
  if (surfaceId.startsWith(SHARED_SURFACE_PREFIX)) {
    return surfaceId;
  }
  const prefix = `${turnId}${SURFACE_SCOPE_SEPARATOR}`;
  return surfaceId.startsWith(prefix) ? surfaceId : `${prefix}${surfaceId}`;
}

function scopeRenderableMessage(
  item: A2uiMsg,
  turnId: string,
  components?: A2uiComponent[],
): A2uiMsg | null {
  if (item.createSurface) {
    if (item.createSurface.surfaceId === PHASE_SURFACE_ID) return null;
    return {
      ...item,
      createSurface: {
        ...item.createSurface,
        surfaceId: scopeSurfaceId(item.createSurface.surfaceId, turnId),
      },
    };
  }

  if (item.updateComponents) {
    if (item.updateComponents.surfaceId === PHASE_SURFACE_ID) return null;
    const scopedComponents = components ?? item.updateComponents.components;
    if (scopedComponents.length === 0) return null;
    return {
      ...item,
      updateComponents: {
        ...item.updateComponents,
        surfaceId: scopeSurfaceId(item.updateComponents.surfaceId, turnId),
        components: scopedComponents,
      },
    };
  }

  if (item.updateDataModel) {
    if (item.updateDataModel.surfaceId === PHASE_SURFACE_ID) return null;
    return {
      ...item,
      updateDataModel: {
        ...item.updateDataModel,
        surfaceId: scopeSurfaceId(item.updateDataModel.surfaceId, turnId),
      },
    };
  }

  if (item.deleteSurface) {
    if (item.deleteSurface.surfaceId === PHASE_SURFACE_ID) return null;
    return {
      ...item,
      deleteSurface: {
        ...item.deleteSurface,
        surfaceId: scopeSurfaceId(item.deleteSurface.surfaceId, turnId),
      },
    };
  }

  return item;
}

export function prepareChatA2ui(
  items: readonly A2uiPayloadItem[],
  turnId: string,
  options: PrepareChatA2uiOptions = {},
): PreparedChatA2ui {
  const phase = extractConversationPhase(items) ?? normalizeConversationPhase(options.currentPhase);
  const files: GeneratedChatFile[] = [];
  const storedMessages: A2uiPayloadItem[] = [];
  const renderableMessages: A2uiMsg[] = [];

  for (const item of items) {
    if (!isA2uiMessage(item)) {
      storedMessages.push(item);
      continue;
    }

    if (!item.updateComponents?.components) {
      storedMessages.push(item);
      const renderableMessage = scopeRenderableMessage(item, turnId);
      if (renderableMessage) {
        renderableMessages.push(renderableMessage);
      }
      continue;
    }

    const storedComponents = enrichComponents(
      item.updateComponents.components,
      files,
      options.resolveArtifactContent,
    );

    storedMessages.push({
      ...item,
      updateComponents: {
        ...item.updateComponents,
        components: storedComponents,
      },
    });

    const renderableMessage = scopeRenderableMessage(
      item,
      turnId,
      renderComponentsForChat(storedComponents, phase),
    );
    if (renderableMessage) {
      renderableMessages.push(renderableMessage);
    }
  }

  return { storedMessages, renderableMessages, files, phase };
}

export function prepareChatA2uiPayload(
  items: readonly A2uiPayloadItem[],
  turnId: string,
): { phase: ConversationPhaseId | null; messages: A2uiMsg[] } {
  const prepared = prepareChatA2ui(items, turnId);
  return {
    phase: prepared.phase,
    messages: prepared.renderableMessages,
  };
}

export function rebuildChatSessionState(
  messages: readonly Pick<ChatMessage, 'id' | 'a2uiMessages' | 'phase' | 'model' | 'setupEvents'>[],
  options: Omit<PrepareChatA2uiOptions, 'currentPhase'> = {},
): Omit<PreparedChatA2ui, 'storedMessages'> {
  const renderableMessages: A2uiMsg[] = [];
  const files: GeneratedChatFile[] = [];
  let phase: ConversationPhaseId | null = null;

  for (const message of messages) {
    const fallbackPhase: ConversationPhaseId | null = normalizeConversationPhase(message.phase) ?? phase;

    if (message.a2uiMessages?.length) {
      const prepared = prepareChatA2ui(message.a2uiMessages, message.id, {
        ...options,
        currentPhase: fallbackPhase,
      });

      renderableMessages.push(...prepared.renderableMessages);
      files.push(...prepared.files);
      phase = prepared.phase ?? fallbackPhase;
    }

    if (message.setupEvents?.length) {
      const preparedSetup = prepareStepwiseSetup(message.setupEvents, message.id, {
        final: Boolean(message.model),
      });
      renderableMessages.push(...preparedSetup.renderableMessages);
      files.push(...preparedSetup.files);
      phase = preparedSetup.phase;
      continue;
    }

    if (!message.a2uiMessages?.length) {
      phase = fallbackPhase;
    }
  }

  return { renderableMessages, files, phase };
}

/**
 * Ownership-resolution step used by the App when an assistant turn receives
 * A2UI surface ids. The previous behaviour kept ownership pinned to whichever
 * message first claimed a surface — when the agent reused a `shared:` surface
 * across turns (a `createSurface` is dropped as a no-op and `updateComponents`
 * mutates the existing model in place), the new turn could not claim the
 * surface and the live update would render under the *previous* assistant
 * bubble instead of the new one.
 *
 * The fix transfers ownership to the current `assistantMessageId` whenever an
 * existing surface is referenced again. The caller uses
 * `transferredFromMessageIds` to strip the surface ids from the prior message
 * bubbles so the surface only renders once, in the right place.
 *
 * Note: this helper **mutates** the provided `surfaceOwners` map in place
 * (assigning new owners and transferring existing ones). Callers that need
 * an immutable update should clone the map before passing it in.
 */
export interface ClaimSurfaceOwnershipParams {
  candidateIds: readonly string[];
  assistantMessageId: string;
  alreadyTracked: ReadonlySet<string>;
  surfaceExists: (surfaceId: string) => boolean;
  surfaceOwners: Map<string, string>;
}

export interface ClaimSurfaceOwnershipResult {
  /** Surface ids newly attributed to `assistantMessageId` this call. */
  ownedIds: string[];
  /** Maps surfaceId → prior owner messageId for transferred surfaces. */
  transferredFromMessageIds: Map<string, string>;
}

export function claimSurfaceOwnership(
  params: ClaimSurfaceOwnershipParams,
): ClaimSurfaceOwnershipResult {
  const { candidateIds, assistantMessageId, alreadyTracked, surfaceExists, surfaceOwners } = params;
  const ownedIds: string[] = [];
  const seen = new Set<string>();
  const transferredFromMessageIds = new Map<string, string>();

  for (const surfaceId of candidateIds) {
    if (!surfaceExists(surfaceId)) continue;

    const owner = surfaceOwners.get(surfaceId);
    if (!owner) {
      surfaceOwners.set(surfaceId, assistantMessageId);
    } else if (owner !== assistantMessageId) {
      // Transfer ownership: a prior assistant message owned this surface,
      // but the agent updated it in this new turn. The current turn now
      // owns the live surface; the prior bubble should drop the reference.
      transferredFromMessageIds.set(surfaceId, owner);
      surfaceOwners.set(surfaceId, assistantMessageId);
    }

    if (!alreadyTracked.has(surfaceId) && !seen.has(surfaceId)) {
      seen.add(surfaceId);
      ownedIds.push(surfaceId);
    }
  }

  return { ownedIds, transferredFromMessageIds };
}

export function getLatestConversationPhase(messages: readonly ChatMessage[]): ConversationPhaseId | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== 'assistant') continue;

    const phase = normalizeConversationPhase(message.phase)
      ?? extractConversationPhase(message.a2uiMessages ?? []);
    if (phase) return phase;

    const debugPhase = extractConversationPhase(message.debugInfo?.fullEnvelope?.a2ui ?? []);
    if (debugPhase) return debugPhase;

    if (message.setupEvents?.length) {
      return 'generate';
    }
  }

  return null;
}

function enrichComponents(
  components: A2uiComponent[],
  files: GeneratedChatFile[],
  resolveArtifactContent?: (artifactPath: string) => string | null | undefined,
): A2uiComponent[] {
  return components.map((component) => {
    if (!isFileEditorComponent(component)) {
      return component;
    }

    const normalizedEntries = extractFileEntries(component, resolveArtifactContent);
    files.push(...normalizedEntries.map(({ path, content, language }) => ({
      path,
      content,
      language,
    })));

    if ('files' in component && Array.isArray(component.files)) {
      return {
        ...component,
        files: normalizedEntries.map(({ path, content, language }) => ({
          filename: path,
          content,
          language,
        })),
      } as A2uiComponent;
    }

    const firstFile = normalizedEntries[0];
    if (!firstFile) {
      return component;
    }

    return {
      ...component,
      filename: firstFile.path,
      content: firstFile.content,
      language: firstFile.language,
    } as A2uiComponent;
  });
}

function renderComponentsForChat(
  components: A2uiComponent[],
  phase: ConversationPhaseId | null,
): A2uiComponent[] {
  return components.flatMap((component) => {
    if (isConversationPhaseComponent(component)) {
      return [];
    }

    if (isFileEditorComponent(component)) {
      return buildGeneratedFileSummary(component);
    }

    if (phase === 'generate' && isGenerationProgressComponent(component)) {
      const progressComponent = component as A2uiComponent;
      return [{ ...progressComponent, title: GENERATION_PROGRESS_TITLE }];
    }

    return [component];
  });
}

function buildGeneratedFileSummary(component: A2uiComponent): A2uiComponent[] {
  const entries = extractFileEntries(component);
  return [{
    id: component.id,
    component: 'Text',
    text: formatFileWorkspaceSummary(entries),
    variant: 'body2',
  } as A2uiComponent];
}

function upsertStep(
  steps: StepwiseSetupStepState[],
  stepId: string,
  overrides: Partial<Omit<StepwiseSetupStepState, 'id'>> = {},
): StepwiseSetupStepState {
  let step = steps.find((candidate) => candidate.id === stepId);
  if (!step) {
    step = {
      id: stepId,
      label: overrides.label ?? getSetupStepLabel(stepId),
      sequence: overrides.sequence ?? steps.length + 1,
      status: overrides.status ?? 'pending',
      ...(overrides.detail ? { detail: overrides.detail } : {}),
    };
    steps.push(step);
  } else {
    if (overrides.label) {
      step.label = overrides.label;
    }
    if (overrides.sequence !== undefined) {
      step.sequence = overrides.sequence;
    }
    if (overrides.status) {
      step.status = overrides.status;
    }
    if ('detail' in overrides) {
      step.detail = overrides.detail;
    }
  }

  return step;
}

function sortStepwiseSetupSteps(steps: StepwiseSetupStepState[]): StepwiseSetupStepState[] {
  return [...steps].sort((left, right) => {
    if (left.sequence !== right.sequence) {
      return left.sequence - right.sequence;
    }
    return left.label.localeCompare(right.label);
  });
}

function getSetupStepLabel(stepId: string): string {
  const knownLabels: Record<string, string> = {
    'app-scaffolding': 'App scaffolding',
    'dockerfile': 'Dockerfile',
    'deployment-config': 'Deployment config',
    'ci-cd': 'CI/CD',
    'service-connections': 'Service connections',
  };

  if (knownLabels[stepId]) {
    return knownLabels[stepId];
  }

  return stepId
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function formatStepCompletionDetail(filesCount: number, totalBytes: number): string {
  if (filesCount <= 0) {
    return 'Complete';
  }

  const fileLabel = filesCount === 1 ? '1 file added' : `${filesCount} files added`;
  return totalBytes > 0
    ? `${fileLabel} • ${formatByteSize(totalBytes)}`
    : fileLabel;
}

function formatByteSize(totalBytes: number): string {
  if (totalBytes < 1024) {
    return `${totalBytes} B`;
  }

  if (totalBytes < 1024 * 1024) {
    return `${(totalBytes / 1024).toFixed(1).replace(/\.0$/, '')} KB`;
  }

  return `${(totalBytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, '')} MB`;
}

function buildStepCompletionStatus(label: string, filesCount: number): string {
  if (filesCount <= 0) {
    return `${label} complete.`;
  }

  return `${label} complete — ${filesCount === 1 ? '1 file added' : `${filesCount} files added`} to the workspace.`;
}

function buildStepErrorStatus(label: string, message: string): string {
  return `${label} needs attention. ${message}`;
}

function buildStepwiseRecoveryStatus(state: StepwiseSetupState): string {
  if (!state.errorMessage) {
    return state.statusText;
  }

  return state.recoverableError
    ? 'Retry this step or stop generation. Earlier workspace files are still available.'
    : 'This step stopped. Earlier workspace files are still available.';
}

function buildFinalStepwiseStatus(state: StepwiseSetupState): string {
  if (state.errorMessage) {
    return state.statusText || state.errorMessage;
  }

  return state.steps.length > 0
    ? 'Project setup complete. Generated files are ready in the workspace.'
    : state.statusText;
}

function getStepwiseOverallStatus(
  state: StepwiseSetupState,
  final: boolean,
): 'idle' | 'running' | 'complete' | 'error' {
  if (state.errorMessage) {
    return 'error';
  }

  if (state.steps.length === 0) {
    return 'idle';
  }

  return final ? 'complete' : 'running';
}

function extractFileEntries(
  component: A2uiComponent,
  resolveArtifactContent?: (artifactPath: string) => string | null | undefined,
): Array<GeneratedChatFile & { artifactPath?: string }> {
  const rawEntries = isFileEditorComponent(component) && Array.isArray(component.files) && component.files.length > 0
    ? component.files
    : [component];

  return rawEntries
    .map((entry) => normalizeFileEntry(entry, resolveArtifactContent))
    .filter((entry): entry is GeneratedChatFile & { artifactPath?: string } => entry !== null);
}

function normalizeFileEntry(
  entry: unknown,
  resolveArtifactContent?: (artifactPath: string) => string | null | undefined,
): (GeneratedChatFile & { artifactPath?: string }) | null {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const record = entry as Record<string, unknown>;
  const artifactPath = coerceString(record.artifactPath);
  const path = coerceString(record.filename) ?? coerceString(record.path) ?? artifactPath;
  if (!path) {
    return null;
  }

  const directContent = typeof record.content === 'string' ? record.content : undefined;
  const content = directContent ?? (artifactPath ? resolveArtifactContent?.(artifactPath) : undefined) ?? '';
  const language = coerceString(record.language) ?? inferLanguageFromPath(path);

  return { path, content, language, artifactPath };
}

function inferLanguageFromPath(path: string): string | undefined {
  const filename = path.split('/').pop() ?? '';
  if (filename in FILE_NAME_LANGUAGES) {
    return FILE_NAME_LANGUAGES[filename];
  }

  const ext = filename.includes('.') ? filename.split('.').pop()?.toLowerCase() : filename.toLowerCase();
  return ext ? EXTENSION_LANGUAGES[ext] : undefined;
}

function coerceString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function formatFileWorkspaceSummary(entries: Array<GeneratedChatFile & { artifactPath?: string }>): string {
  if (entries.length === 0) {
    return '📄 Generated files are available in the workspace.';
  }

  if (entries.length === 1) {
    return `📄 ${entries[0].path} is available in the workspace.`;
  }

  return `📄 ${entries.length} generated files are available in the workspace.`;
}

function isFileEditorComponent(component: A2uiComponent): component is A2uiComponent & {
  filename?: string;
  path?: string;
  content?: string;
  language?: string;
  artifactPath?: string;
  files?: unknown[];
} {
  return component.component === 'FileEditor';
}

function isGenerationProgressComponent(component: A2uiComponent): boolean {
  return component.component === 'GenerationProgress';
}
