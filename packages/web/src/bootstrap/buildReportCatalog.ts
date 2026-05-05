/**
 * buildReportCatalog — builds a fully-populated A2UI catalog for SSR and
 * report rendering. Includes fluentOverrides + all pack client components
 * (same as what main.tsx registers at startup).
 *
 * Memoized — the catalog is created once and reused across renders.
 */

import type { ReactComponentImplementation } from '../vendor/a2ui/react/adapter';
import { Catalog } from '../vendor/a2ui/web_core/index';
import { BASIC_FUNCTIONS } from '../vendor/a2ui/web_core/basic_catalog/index';
import { ClientComponentRegistry, KICKSTART_CATALOG_ID } from '../contexts/A2UIRegistryContext';
import { fluentOverrides } from '../catalog/fluent-components/index';
import { registerPackComponents } from './registerPackComponents';

let _catalog: Catalog<ReactComponentImplementation> | null = null;

export function buildReportCatalog(): Catalog<ReactComponentImplementation> {
  if (_catalog) return _catalog;
  const registry = new ClientComponentRegistry();
  for (const impl of fluentOverrides) {
    registry.register(impl);
  }
  registerPackComponents(registry);
  registry.seal();
  _catalog = registry.buildCatalog();
  return _catalog;
}
