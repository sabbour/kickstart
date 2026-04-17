/*
 * KEEP:
 * - phase normalization and extraction from A2UI payloads
 * - turn-scoped surface ID rewriting for renderable chat messages
 * - FileEditor file extraction / summary helpers for workspace-aware chat surfaces
 * - chat-session rebuild helpers for persisted A2UI message history
 *
 * DROP:
 * - stepwise setup event state machine helpers (`buildStepwiseSetupMessages`, `prepareStepwiseSetup`, recovery status)
 * - debug-envelope scanning and other web-only debug metadata hooks
 * - direct dependencies on `packages/web/src/types` runtime models
 * - setup-event specific payload contracts that belong to later runtime steps
 */

import { A2UIMessageSchema } from '../types/a2ui.js';
import type { A2UIMessageInput } from '../types/a2ui.js';

const PHASE_COMPONENT_NAME = 'ConversationPhase';
const PHASE_SURFACE_ID = 'phase-indicator';
const SURFACE_SCOPE_SEPARATOR = '::';

const PHASE_ALIASES = {
  discover: 'discover',
  assess: 'assess',
  plan: 'design',
  design: 'design',
  build: 'generate',
  generate: 'generate',
  review: 'review',
  validate: 'review',
  handoff: 'assess',
  deploy: 'deploy',
} as const;

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

export type ConversationPhaseId = 'discover' | 'assess' | 'design' | 'generate' | 'review' | 'deploy';

export const CONVERSATION_PHASE_ORDER = [
  'discover',
  'assess',
  'design',
  'generate',
  'review',
  'deploy',
] as const satisfies readonly ConversationPhaseId[];

export const CONVERSATION_PHASE_LABELS: Record<ConversationPhaseId, string> = {
  discover: 'Discover',
  assess: 'Assess',
  design: 'Design',
  generate: 'Generate',
  review: 'Review',
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
  storedMessages: A2UIMessageInput[];
  renderableMessages: A2UIMessageInput[];
  files: GeneratedChatFile[];
  phase: ConversationPhaseId | null;
}

export interface PersistedChatTurn {
  id: string;
  phase?: string | null;
  a2uiMessages?: readonly unknown[];
}

export function normalizeConversationPhase(phase: string | null | undefined): ConversationPhaseId | null {
  if (!phase) return null;

  const normalized = phase.trim().toLowerCase();
  if (!normalized) return null;
  if (!(normalized in PHASE_ALIASES)) return null;

  return PHASE_ALIASES[normalized as keyof typeof PHASE_ALIASES];
}

export function isA2UIMessage(value: unknown): value is A2UIMessageInput {
  return A2UIMessageSchema.safeParse(value).success;
}

export function extractConversationPhase(items: readonly unknown[]): ConversationPhaseId | null {
  for (const item of items) {
    const directPhase = extractPhaseFromComponent(item);
    if (directPhase) {
      return directPhase;
    }

    if (!isA2UIMessage(item)) {
      continue;
    }

    const components = getUpdateComponents(item);
    if (!components) {
      continue;
    }

    for (const component of components) {
      const componentPhase = extractPhaseFromComponent(component);
      if (componentPhase) {
        return componentPhase;
      }
    }
  }

  return null;
}

export function prepareChatA2ui(
  items: readonly unknown[],
  turnId: string,
  options: PrepareChatA2uiOptions = {},
): PreparedChatA2ui {
  const phase = extractConversationPhase(items) ?? normalizeConversationPhase(options.currentPhase);
  const files: GeneratedChatFile[] = [];
  const storedMessages: A2UIMessageInput[] = [];
  const renderableMessages: A2UIMessageInput[] = [];

  for (const item of items) {
    if (!isA2UIMessage(item)) {
      continue;
    }

    const components = getUpdateComponents(item);
    if (!components) {
      storedMessages.push(item);
      const scopedMessage = scopeRenderableMessage(item, turnId);
      if (scopedMessage) {
        renderableMessages.push(scopedMessage);
      }
      continue;
    }

    const storedComponents = enrichComponents(components, files, options.resolveArtifactContent);
    const storedMessage = replaceUpdateComponents(item, storedComponents);
    storedMessages.push(storedMessage);

    const scopedMessage = scopeRenderableMessage(
      storedMessage,
      turnId,
      renderComponentsForChat(storedComponents, phase),
    );
    if (scopedMessage) {
      renderableMessages.push(scopedMessage);
    }
  }

  return { storedMessages, renderableMessages, files, phase };
}

export function prepareChatA2uiPayload(
  items: readonly unknown[],
  turnId: string,
): { phase: ConversationPhaseId | null; messages: A2UIMessageInput[] } {
  const prepared = prepareChatA2ui(items, turnId);
  return {
    phase: prepared.phase,
    messages: prepared.renderableMessages,
  };
}

export function rebuildChatSessionState(
  messages: readonly PersistedChatTurn[],
  options: Omit<PrepareChatA2uiOptions, 'currentPhase'> = {},
): Omit<PreparedChatA2ui, 'storedMessages'> {
  const renderableMessages: A2UIMessageInput[] = [];
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

export function getLatestConversationPhase(messages: readonly PersistedChatTurn[]): ConversationPhaseId | null {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    const phase = normalizeConversationPhase(message.phase)
      ?? extractConversationPhase(message.a2uiMessages ?? []);
    if (phase) {
      return phase;
    }
  }

  return null;
}

function getUpdateComponents(message: A2UIMessageInput): Record<string, unknown>[] | null {
  if (!('updateComponents' in message)) {
    return null;
  }

  const components = (message.updateComponents as { components?: unknown }).components;
  if (!Array.isArray(components)) {
    return null;
  }

  return components.filter(isRecord);
}

function replaceUpdateComponents(
  message: A2UIMessageInput,
  components: Record<string, unknown>[],
): A2UIMessageInput {
  if (!('updateComponents' in message)) {
    return message;
  }

  return {
    ...message,
    updateComponents: {
      ...message.updateComponents,
      components,
    },
  } as A2UIMessageInput;
}

function scopeRenderableMessage(
  message: A2UIMessageInput,
  turnId: string,
  components?: Record<string, unknown>[],
): A2UIMessageInput | null {
  if ('createSurface' in message) {
    if (message.createSurface.surfaceId === PHASE_SURFACE_ID) {
      return null;
    }

    return {
      ...message,
      createSurface: {
        ...message.createSurface,
        surfaceId: scopeSurfaceId(message.createSurface.surfaceId, turnId),
      },
    };
  }

  if ('updateComponents' in message) {
    if (message.updateComponents.surfaceId === PHASE_SURFACE_ID) {
      return null;
    }

    const scopedComponents = components ?? getUpdateComponents(message) ?? [];
    if (scopedComponents.length === 0) {
      return null;
    }

    return {
      ...message,
      updateComponents: {
        ...message.updateComponents,
        surfaceId: scopeSurfaceId(message.updateComponents.surfaceId, turnId),
        components: scopedComponents,
      },
    };
  }

  if ('updateDataModel' in message) {
    if (message.updateDataModel.surfaceId === PHASE_SURFACE_ID) {
      return null;
    }

    return {
      ...message,
      updateDataModel: {
        ...message.updateDataModel,
        surfaceId: scopeSurfaceId(message.updateDataModel.surfaceId, turnId),
      },
    };
  }

  if ('deleteSurface' in message) {
    if (message.deleteSurface.surfaceId === PHASE_SURFACE_ID) {
      return null;
    }

    return {
      ...message,
      deleteSurface: {
        ...message.deleteSurface,
        surfaceId: scopeSurfaceId(message.deleteSurface.surfaceId, turnId),
      },
    };
  }

  return message;
}

function scopeSurfaceId(surfaceId: string, turnId: string): string {
  const prefix = `${turnId}${SURFACE_SCOPE_SEPARATOR}`;
  return surfaceId.startsWith(prefix) ? surfaceId : `${prefix}${surfaceId}`;
}

function extractPhaseFromComponent(component: unknown): ConversationPhaseId | null {
  if (!isConversationPhaseComponent(component)) {
    return null;
  }

  if (typeof component.currentPhase === 'string') {
    return normalizeConversationPhase(component.currentPhase);
  }

  return extractPhaseFromPhaseList(component.phases);
}

function extractPhaseFromPhaseList(phases: unknown): ConversationPhaseId | null {
  if (!Array.isArray(phases)) {
    return null;
  }

  const activePhase = phases.find((phase): phase is { id?: string; status?: string } => (
    isRecord(phase)
    && phase.status === 'active'
    && typeof phase.id === 'string'
  ));

  return normalizeConversationPhase(activePhase?.id);
}

function isConversationPhaseComponent(component: unknown): component is Record<string, unknown> & {
  currentPhase?: string;
  phases?: unknown;
} {
  if (!isRecord(component)) {
    return false;
  }

  return component.component === PHASE_COMPONENT_NAME
    || component.type === PHASE_COMPONENT_NAME;
}

function enrichComponents(
  components: Record<string, unknown>[],
  files: GeneratedChatFile[],
  resolveArtifactContent?: (artifactPath: string) => string | null | undefined,
): Record<string, unknown>[] {
  return components.map((component) => {
    if (!isFileEditorComponent(component)) {
      return component;
    }

    const normalizedEntries = extractFileEntries(component, resolveArtifactContent);
    files.push(...normalizedEntries.map(({ path, content, language }) => ({ path, content, language })));

    if (Array.isArray(component.files)) {
      return {
        ...component,
        files: normalizedEntries.map(({ path, content, language }) => ({
          filename: path,
          content,
          language,
        })),
      };
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
    };
  });
}

function renderComponentsForChat(
  components: Record<string, unknown>[],
  phase: ConversationPhaseId | null,
): Record<string, unknown>[] {
  return components.flatMap((component) => {
    if (isConversationPhaseComponent(component)) {
      return [];
    }

    if (isFileEditorComponent(component)) {
      return buildGeneratedFileSummary(component);
    }

    if (phase === 'generate' && isGenerationProgressComponent(component)) {
      return [{
        ...component,
        title: 'Project Setup',
      }];
    }

    return [component];
  });
}

function buildGeneratedFileSummary(component: Record<string, unknown>): Record<string, unknown>[] {
  const entries = extractFileEntries(component);
  return [{
    id: component.id,
    component: 'Text',
    text: formatFileWorkspaceSummary(entries),
    variant: 'body2',
  }];
}

function extractFileEntries(
  component: Record<string, unknown>,
  resolveArtifactContent?: (artifactPath: string) => string | null | undefined,
): Array<GeneratedChatFile & { artifactPath?: string }> {
  const rawEntries = Array.isArray(component.files) && component.files.length > 0
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
  if (!isRecord(entry)) {
    return null;
  }

  const artifactPath = coerceString(entry.artifactPath);
  const path = coerceString(entry.filename) ?? coerceString(entry.path) ?? artifactPath;
  if (!path) {
    return null;
  }

  const directContent = typeof entry.content === 'string' ? entry.content : undefined;
  const content = directContent ?? (artifactPath ? resolveArtifactContent?.(artifactPath) : undefined) ?? '';
  const language = coerceString(entry.language) ?? inferLanguageFromPath(path);

  return { path, content, language, artifactPath };
}

function formatFileWorkspaceSummary(entries: Array<GeneratedChatFile & { artifactPath?: string }>): string {
  if (entries.length === 0) {
    return 'Generated files are available in the workspace.';
  }

  const fileList = entries.map((entry) => `- ${entry.path}`).join('\n');
  return `Generated files are available in the workspace:\n${fileList}`;
}

function inferLanguageFromPath(path: string): string | undefined {
  const filename = path.split('/').pop() ?? '';
  if (filename in FILE_NAME_LANGUAGES) {
    return FILE_NAME_LANGUAGES[filename];
  }

  const ext = filename.includes('.') ? filename.split('.').pop()?.toLowerCase() : filename.toLowerCase();
  return ext ? EXTENSION_LANGUAGES[ext] : undefined;
}

function isGenerationProgressComponent(component: Record<string, unknown>): boolean {
  return component.component === 'GenerationProgress' || component.type === 'GenerationProgress';
}

function isFileEditorComponent(component: Record<string, unknown>): boolean {
  return component.component === 'FileEditor' || component.type === 'FileEditor';
}

function coerceString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
