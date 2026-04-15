import type { A2uiComponent, A2uiMsg, A2uiPayloadItem, ChatMessage, ConversationPhaseId } from '../types';

const PHASE_COMPONENT_NAME = 'ConversationPhase';
const PHASE_SURFACE_ID = 'phase-indicator';
const SURFACE_SCOPE_SEPARATOR = '::';

const LEGACY_PHASE_ALIASES: Record<string, ConversationPhaseId> = {
  plan: 'design',
  build: 'generate',
  validate: 'review',
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

function isA2uiMessage(item: A2uiPayloadItem): item is A2uiMsg {
  return Boolean(
    (item as A2uiMsg).createSurface
    || (item as A2uiMsg).updateComponents
    || (item as A2uiMsg).updateDataModel
    || (item as A2uiMsg).deleteSurface,
  );
}

function isConversationPhaseComponent(component: unknown): component is Record<string, unknown> {
  if (!component || typeof component !== 'object') return false;
  const candidate = component as Record<string, unknown>;
  return candidate.component === PHASE_COMPONENT_NAME
    || candidate.type === PHASE_COMPONENT_NAME
    || (candidate.type === 'createSurface' && candidate.component === PHASE_COMPONENT_NAME);
}

function extractPhaseFromPhaseList(phases: unknown): string | null {
  if (!Array.isArray(phases)) return null;

  const activePhase = phases.find((phase): phase is { id?: string; status?: string } =>
    Boolean(phase)
    && typeof phase === 'object'
    && (phase as { status?: string }).status === 'active'
    && typeof (phase as { id?: string }).id === 'string',
  );

  return normalizeConversationPhase(activePhase?.id);
}

function extractPhaseFromComponent(component: unknown): string | null {
  if (!isConversationPhaseComponent(component)) return null;

  const candidate = component as Record<string, unknown>;
  if (typeof candidate.currentPhase === 'string') {
    return normalizeConversationPhase(candidate.currentPhase);
  }

  return extractPhaseFromPhaseList(candidate.phases);
}

function scopeSurfaceId(surfaceId: string, turnId: string): string {
  const prefix = `${turnId}${SURFACE_SCOPE_SEPARATOR}`;
  return surfaceId.startsWith(prefix) ? surfaceId : `${prefix}${surfaceId}`;
}

function filterRenderableComponents(components: A2uiComponent[]): A2uiComponent[] {
  return components.filter(component => !isConversationPhaseComponent(component));
}

export function normalizeConversationPhase(phase: string | null | undefined): string | null {
  if (!phase) return null;

  const normalized = phase.trim().toLowerCase();
  if (!normalized) return null;

  return LEGACY_PHASE_ALIASES[normalized] ?? normalized;
}

export function extractConversationPhase(items: readonly A2uiPayloadItem[]): string | null {
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

export function scopeRenderableA2uiMessages(
  items: readonly A2uiPayloadItem[],
  turnId: string,
): A2uiMsg[] {
  return items.flatMap((item) => {
    if (!isA2uiMessage(item)) return [];

    if (item.createSurface) {
      if (item.createSurface.surfaceId === PHASE_SURFACE_ID) return [];
      return [{
        ...item,
        createSurface: {
          ...item.createSurface,
          surfaceId: scopeSurfaceId(item.createSurface.surfaceId, turnId),
        },
      }];
    }

    if (item.updateComponents) {
      if (item.updateComponents.surfaceId === PHASE_SURFACE_ID) return [];

      const components = filterRenderableComponents(item.updateComponents.components);
      if (components.length === 0) return [];

      return [{
        ...item,
        updateComponents: {
          ...item.updateComponents,
          surfaceId: scopeSurfaceId(item.updateComponents.surfaceId, turnId),
          components,
        },
      }];
    }

    if (item.updateDataModel) {
      if (item.updateDataModel.surfaceId === PHASE_SURFACE_ID) return [];
      return [{
        ...item,
        updateDataModel: {
          ...item.updateDataModel,
          surfaceId: scopeSurfaceId(item.updateDataModel.surfaceId, turnId),
        },
      }];
    }

    if (item.deleteSurface) {
      if (item.deleteSurface.surfaceId === PHASE_SURFACE_ID) return [];
      return [{
        ...item,
        deleteSurface: {
          ...item.deleteSurface,
          surfaceId: scopeSurfaceId(item.deleteSurface.surfaceId, turnId),
        },
      }];
    }

    return [item];
  });
}

export function prepareChatA2uiPayload(
  items: readonly A2uiPayloadItem[],
  turnId: string,
): {
  phase: string | null;
  messages: A2uiMsg[];
} {
  return {
    phase: extractConversationPhase(items),
    messages: scopeRenderableA2uiMessages(items, turnId),
  };
}

export function getLatestConversationPhase(messages: readonly ChatMessage[]): string | null {
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
