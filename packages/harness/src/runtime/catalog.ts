import type { A2UICatalog } from '../types/session.js';
import type { ComponentContribution } from '../types/component.js';
import type { UserActionContribution } from '../types/user-action.js';

export interface CatalogSnapshot extends A2UICatalog {
  components: readonly string[];
  userActions: readonly string[];
}

export function buildCatalogSnapshot(
  components: readonly ComponentContribution[],
  userActions: readonly UserActionContribution[],
  id = 'kickstart',
): CatalogSnapshot {
  return {
    id,
    components: components.map((component) => component.name),
    userActions: userActions.map((action) => action.name),
  };
}

export function negotiateCatalog(
  advertisedCatalogIds: readonly string[] | undefined,
  snapshot: CatalogSnapshot,
): CatalogSnapshot {
  if (!advertisedCatalogIds || advertisedCatalogIds.length === 0) {
    return snapshot;
  }

  if (advertisedCatalogIds.includes(snapshot.id)) {
    return snapshot;
  }

  return {
    ...snapshot,
    id: advertisedCatalogIds[0],
  };
}
