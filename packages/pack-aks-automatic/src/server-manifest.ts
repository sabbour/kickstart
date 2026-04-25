/**
 * Server-safe pack manifest for `aksAutomaticPack` — no JSX imports.
 *
 * Mirrors `pack-core/src/server-manifest.ts`: tools, user actions, and
 * guardrails are imported directly because they are plain TypeScript with
 * no React dependency. Component contributions are listed by name with
 * placeholder schemas so the server can expose the catalog over
 * `/api/packs` without pulling Fluent UI or React into the Azure Functions
 * bundle.
 *
 * TODO: Extract component schemas from the `.tsx` files into shared
 * non-JSX modules so the server can serve accurate JSON schemas.
 */

import { z } from 'zod';
import type { Pack, ComponentContribution } from '@aks-kickstart/harness';
import { resolveAssetURL } from '@aks-kickstart/harness/runtime/asset-url';

// Tools (no JSX)
import { validateManifestsTool } from './tools/validate-manifests.js';
import { validateSafeguardsTool } from './tools/validate-safeguards.js';
import { buildArchitectureDiagramTool } from './tools/build-architecture-diagram.js';

// User actions (no JSX)
import { aksDeployUserAction } from './user-actions/deploy.js';

// Guardrails (no JSX)
import { noPrivilegedContainersGuardrail } from './guardrails/no-privileged-containers.js';
import { requireResourceLimitsGuardrail } from './guardrails/require-resource-limits.js';
import { noHostpathVolumesGuardrail } from './guardrails/no-hostpath-volumes.js';
import { noLatestTagGuardrail } from './guardrails/no-latest-tag.js';

// ---------------------------------------------------------------------------
// Component contributions (server-safe, no React renderer)
// ---------------------------------------------------------------------------

const AKS_COMPONENT_NAMES = [
  'ArchitectureDiagram',
  'AksClusterCard',
  'SafeguardViolations',
  'DeploymentProgress',
];

const serverComponents: ComponentContribution[] = AKS_COMPONENT_NAMES.map((name) => ({
  name: `aks/${name}`,
  propertySchema: z.unknown(),
  renderer: null,
}));

// ---------------------------------------------------------------------------
// Server-safe aksAutomaticPack
// ---------------------------------------------------------------------------

export const aksAutomaticPackServer: Pack = {
  name: 'aks',
  version: '0.1.0',
  dependsOn: ['core', 'azure'],

  agentsDir: resolveAssetURL(import.meta.url, './agents/', './pack-assets/aks/agents/'),
  skillsDir: resolveAssetURL(import.meta.url, './skills/', './pack-assets/aks/skills/'),

  tools: [
    validateManifestsTool,
    validateSafeguardsTool,
    buildArchitectureDiagramTool,
  ],

  userActions: [
    aksDeployUserAction,
  ],

  components: serverComponents,

  guardrails: [
    noPrivilegedContainersGuardrail,
    requireResourceLimitsGuardrail,
    noHostpathVolumesGuardrail,
    noLatestTagGuardrail,
  ],
};
