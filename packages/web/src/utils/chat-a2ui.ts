import type {
  A2uiComponent,
  A2uiMsg,
  A2uiPayloadItem,
  ChatMessage,
  ConversationPhaseId,
  FileGeneratedEvent,
  GenerateStreamEvent,
  GenerationStepErrorCode,
} from '../types';

const PHASE_COMPONENT_NAME = 'ConversationPhase';
const PHASE_SURFACE_ID = 'phase-indicator';
const SURFACE_SCOPE_SEPARATOR = '::';

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

export const GENERATE_PROGRESS_TITLE = 'Project Setup';
export const GENERATE_PROGRESS_SURFACE_ID = 'generate-progress';

const GENERATE_PROGRESS_COMPONENT_ID = 'generate-progress-card';

const GENERATE_STEP_LABELS: Record<string, string> = {
  'app-scaffolding': 'App scaffolding',
  dockerfile: 'Dockerfile',
  'deployment-config': 'Deployment config',
  'ci-cd': 'CI/CD',
  'service-connections': 'Service connections',
};

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

export interface GenerateProgressStep {
  id: string;
  label: string;
  sequence: number;
  status: 'pending' | 'running' | 'complete' | 'error' | 'skipped';
  detail?: string;
}

export interface GenerateProgressState {
  steps: GenerateProgressStep[];
  overallStatus: 'running' | 'complete' | 'error';
  statusMessage?: string;
  errorCode?: GenerationStepErrorCode;
  errorMessage?: string;
}

export function applyGenerateStreamEvent(
  state: GenerateProgressState | null,
  event: GenerateStreamEvent,
  options: { includeCreateSurface?: boolean } = {},
): { state: GenerateProgressState; messages: A2uiPayloadItem[] } {
  const nextState = reduceGenerateStreamEvent(state, event);
  return {
    state: nextState,
    messages: buildGenerateProgressMessages(nextState, options.includeCreateSurface ?? false, event),
  };
}

export function finalizeGenerateProgressState(state: GenerateProgressState): GenerateProgressState {
  if (state.overallStatus !== 'running') {
    return state;
  }

  return {
    ...state,
    overallStatus: 'complete',
    statusMessage: 'Setup files are ready in the workspace.',
    errorCode: undefined,
    errorMessage: undefined,
  };
}

export function interruptGenerateProgressState(
  state: GenerateProgressState,
  message: string,
): GenerateProgressState {
  const targetStep = [...state.steps]
    .sort(compareGenerateSteps)
    .find((step) => step.status === 'running')
    ?? [...state.steps].sort(compareGenerateSteps).at(-1);

  const nextSteps = targetStep
    ? upsertGenerateStep(state.steps, {
        ...targetStep,
        status: 'error',
        detail: message,
      })
    : state.steps;

  return {
    ...state,
    steps: nextSteps,
    overallStatus: 'error',
    statusMessage: message,
    errorCode: 'connection_interrupted',
    errorMessage: message,
  };
}

function reduceGenerateStreamEvent(
  state: GenerateProgressState | null,
  event: GenerateStreamEvent,
): GenerateProgressState {
  const current = state ?? {
    steps: [],
    overallStatus: 'running' as const,
  };

  switch (event.type) {
    case 'step_start': {
      const nextStep = {
        id: event.stepId,
        label: normalizeGenerateStepLabel(event.stepId, event.label),
        sequence: event.sequence,
        status: 'running' as const,
        detail: undefined,
      };

      return {
        steps: upsertGenerateStep(current.steps, nextStep),
        overallStatus: 'running',
        statusMessage: `Generating ${nextStep.label}…`,
        errorCode: undefined,
        errorMessage: undefined,
      };
    }

    case 'file_generated': {
      const step = findGenerateStep(current.steps, event.stepId);
      const detail = `${event.path} added to workspace.`;

      return {
        ...current,
        steps: upsertGenerateStep(current.steps, {
          id: event.stepId,
          label: step?.label ?? normalizeGenerateStepLabel(event.stepId),
          sequence: step?.sequence ?? current.steps.length,
          status: 'running',
          detail,
        }),
        overallStatus: 'running',
        statusMessage: detail,
      };
    }

    case 'step_complete': {
      const step = findGenerateStep(current.steps, event.stepId);

      return {
        ...current,
        steps: upsertGenerateStep(current.steps, {
          id: event.stepId,
          label: step?.label ?? normalizeGenerateStepLabel(event.stepId),
          sequence: step?.sequence ?? current.steps.length,
          status: 'complete',
          detail: formatStepCompleteDetail(event.filesCount, event.totalBytes),
        }),
        overallStatus: 'running',
        statusMessage: `${step?.label ?? normalizeGenerateStepLabel(event.stepId)} complete.`,
      };
    }

    case 'step_error': {
      const step = findGenerateStep(current.steps, event.stepId);
      const recoveryHint = event.recoverable ? ' Retry this step or stop generation.' : '';

      return {
        ...current,
        steps: upsertGenerateStep(current.steps, {
          id: event.stepId,
          label: step?.label ?? normalizeGenerateStepLabel(event.stepId),
          sequence: step?.sequence ?? current.steps.length,
          status: 'error',
          detail: event.message,
        }),
        overallStatus: 'error',
        statusMessage: `${event.message}${recoveryHint}`,
        errorCode: event.code,
        errorMessage: event.message,
      };
    }
  }
}

export function buildGenerateProgressMessages(
  state: GenerateProgressState,
  includeCreateSurface: boolean,
  event?: GenerateStreamEvent,
): A2uiPayloadItem[] {
  const messages: A2uiPayloadItem[] = [];

  if (includeCreateSurface) {
    messages.push({
      version: 'v0.9',
      createSurface: {
        surfaceId: GENERATE_PROGRESS_SURFACE_ID,
        catalogId: 'kickstart',
      },
    });
  }

  const components: A2uiComponent[] = [buildGenerateProgressComponent(state)];
  if (event?.type === 'file_generated') {
    components.push(buildGeneratedFileComponent(event));
  }

  messages.push({
    version: 'v0.9',
    updateComponents: {
      surfaceId: GENERATE_PROGRESS_SURFACE_ID,
      components,
    },
  });

  return messages;
}

function buildGenerateProgressComponent(state: GenerateProgressState): A2uiComponent {
  return {
    id: GENERATE_PROGRESS_COMPONENT_ID,
    component: 'DeploymentProgress',
    title: GENERATE_PROGRESS_TITLE,
    overallStatus: state.overallStatus,
    statusMessage: state.statusMessage,
    errorCode: state.errorCode,
    errorMessage: state.errorMessage,
    steps: [...state.steps]
      .sort(compareGenerateSteps)
      .map(({ id, label, status, detail }) => ({
        id,
        label,
        status,
        ...(detail ? { detail } : {}),
      })),
  };
}

function buildGeneratedFileComponent(event: FileGeneratedEvent): A2uiComponent {
  return {
    id: `generated-file-${sanitizeGenerateComponentId(`${event.stepId}-${event.path}`)}`,
    component: 'FileEditor',
    filename: event.path,
    path: event.path,
    language: event.language,
    content: event.content,
  };
}

function sanitizeGenerateComponentId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-');
}

function findGenerateStep(
  steps: readonly GenerateProgressStep[],
  stepId: string,
): GenerateProgressStep | undefined {
  return steps.find((step) => step.id === stepId);
}

function upsertGenerateStep(
  steps: readonly GenerateProgressStep[],
  nextStep: GenerateProgressStep,
): GenerateProgressStep[] {
  const nextSteps = [...steps];
  const existingIndex = nextSteps.findIndex((step) => step.id === nextStep.id);

  if (existingIndex === -1) {
    nextSteps.push(nextStep);
  } else {
    nextSteps[existingIndex] = {
      ...nextSteps[existingIndex],
      ...nextStep,
    };
  }

  return nextSteps.sort(compareGenerateSteps);
}

function compareGenerateSteps(a: GenerateProgressStep, b: GenerateProgressStep): number {
  return a.sequence - b.sequence || a.label.localeCompare(b.label);
}

function normalizeGenerateStepLabel(stepId: string, label?: string): string {
  return label?.trim() || GENERATE_STEP_LABELS[stepId] || humanizeGenerateStepId(stepId);
}

function humanizeGenerateStepId(stepId: string): string {
  return stepId
    .split(/[-_]/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatStepCompleteDetail(filesCount: number, totalBytes: number): string {
  const fileLabel = filesCount === 1 ? '1 file' : `${filesCount} files`;
  return `${fileLabel} validated • ${formatByteSize(totalBytes)}`;
}

function formatByteSize(totalBytes: number): string {
  if (totalBytes < 1024) {
    return `${totalBytes} bytes`;
  }

  const kib = totalBytes / 1024;
  if (kib < 1024) {
    return `${kib.toFixed(1).replace(/\.0$/, '')} KiB`;
  }

  const mib = kib / 1024;
  return `${mib.toFixed(1).replace(/\.0$/, '')} MiB`;
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
  messages: readonly Pick<ChatMessage, 'id' | 'a2uiMessages' | 'phase'>[],
  options: Omit<PrepareChatA2uiOptions, 'currentPhase'> = {},
): Omit<PreparedChatA2ui, 'storedMessages'> {
  const renderableMessages: A2uiMsg[] = [];
  const files: GeneratedChatFile[] = [];
  let phase: ConversationPhaseId | null = null;

  for (const message of messages) {
    const fallbackPhase: ConversationPhaseId | null = normalizeConversationPhase(message.phase) ?? phase;
    if (!message.a2uiMessages?.length) {
      phase = fallbackPhase;
      continue;
    }

    const prepared = prepareChatA2ui(message.a2uiMessages, message.id, {
      ...options,
      currentPhase: fallbackPhase,
    });

    renderableMessages.push(...prepared.renderableMessages);
    files.push(...prepared.files);
    phase = prepared.phase ?? fallbackPhase;
  }

  return { renderableMessages, files, phase };
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
      return phase === 'generate' ? [] : buildGeneratedFileSummary(component);
    }

    if (phase === 'generate' && isDeploymentProgressComponent(component)) {
      const progressComponent = component as A2uiComponent;
      return [{ ...progressComponent, title: GENERATE_PROGRESS_TITLE }];
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

function isDeploymentProgressComponent(component: A2uiComponent): boolean {
  return component.component === 'DeploymentProgress';
}
