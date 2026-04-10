/**
 * @module @kickstart/core/kits
 *
 * IntegrationKit system — composable bundles of tools, connectors, prompts,
 * and component registrations.
 *
 * Quick start:
 *   import { registerKit, azureKit, githubKit } from '@kickstart/core';
 *   registerKit(azureKit);
 *   registerKit(githubKit);
 */

export type { IntegrationKit, ComponentRegistration, KitAuthRequirement } from './types.js';
export { IntegrationKitRegistry, defaultKitRegistry, registerKit } from './registry.js';
export { azureKit } from './azure-kit.js';
export { githubKit } from './github-kit.js';
