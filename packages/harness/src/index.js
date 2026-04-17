// TODO(Step 2): Replace these stubs with real harness types.
// This file temporarily satisfies legacy @kickstart/core imports during Step 1 migration.
// Phase was an enum in v1 — stub as a const object for runtime compatibility
export const Phase = {
    Discover: 'discover',
    Assess: 'assess',
    Design: 'design',
    Generate: 'generate',
    Review: 'review',
    Deploy: 'deploy',
};
export class InMemoryArtifactStore {
}
export const KNOWN_COMPONENT_TYPES = [];
export const SETUP_GENERATION_STEP_ORDER = [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerKit(_kit) { }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const azureKit = {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const githubKit = {};
// Runtime function stubs — replaced by harness runtime in Step 5
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function buildSystemPrompt(_opts) { return ''; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveSkills(_phase, _skills) { return []; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function resolveConversationSkills(_ctx) { return []; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function processResponse(_text) { return {}; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPhaseDefinition(_phase) { return { label: '' }; }
export function getPhaseOrder() { return Object.values(Phase); }
export function isPhase(value) {
    return Object.values(Phase).includes(value);
}
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const defaultKitRegistry = { getAll: () => [] };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const defaultRegistry = {
    toOpenAIFormat: () => [],
    get: (_name) => undefined,
};
// PricingConnector stub — replaced by pack-azure in Step 7
export class PricingConnector {
    constructor(..._args) { }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async getPricing(_opts) { return {}; }
}
//# sourceMappingURL=index.js.map