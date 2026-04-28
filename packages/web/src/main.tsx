// MUST be the first import: disables Zod v4's JIT (`new Function`) path
// before any v4 schema is constructed anywhere in the web bundle. See
// `src/lib/configure-zod.ts` for why this file imports zod/v4 via a
// vite alias that pins to the root zod instance.
import './lib/configure-zod';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { APIConnectorProvider } from './contexts/APIConnectorContext';
import { GitHubAuthProvider } from './contexts/GitHubAuthContext';
import { ArtifactProvider } from './contexts/ArtifactContext';
import { VirtualFSProvider } from './contexts/VirtualFSContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { DebugProvider } from './contexts/DebugContext';
import { A2UIRegistryProvider, clientRegistry } from './contexts/A2UIRegistryContext';
import { InMemoryArtifactStore } from '@aks-kickstart/harness';
import { fetchBrowserTelemetryConfig, initBrowserTelemetry, markBrowserTelemetryReady } from './lib/browser-appinsights';

// Browser telemetry bootstrap (issue #1042 / DP-D revision 2). Flag-gated,
// disabled by default; any init failure is swallowed so telemetry can never
// break app boot. Runs before React mounts so the first /api/converse fetch
// is already instrumented. `markBrowserTelemetryReady()` resolves the
// `window.__kickstartTelemetryReady` promise once the async bootstrap has
// settled — Playwright (and any production caller that needs to defer a
// fetch until instrumentation is live) awaits it.
void (async () => {
  try {
    const config = await fetchBrowserTelemetryConfig();
    initBrowserTelemetry(config);
  } catch {
    // Silent — telemetry is non-critical.
  } finally {
    markBrowserTelemetryReady();
  }
})();

// ---------------------------------------------------------------------------
// Phase A bootstrap ordering (DP Step 10)
//
// 1. Register all client-side component renderers (synchronous)
// 2. Seal the registry (ReadonlyMap, no post-startup mutation)
// 3. ReactDOM.createRoot(…).render(<App />) — only then mount
//
// useA2UIRegistry() throws if called before seal().
// ---------------------------------------------------------------------------

// Step 1a: basic A2UI catalog components (Fluent UI v9 overrides)
import { fluentOverrides } from './catalog/fluent-components/index';
for (const impl of fluentOverrides) {
  clientRegistry.register(impl);
}

// Step 1b: Kickstart rich components (domain-neutral) — lazy-loaded so each
// component's module is only fetched when the first instance of that type is
// rendered. Vite code-splits each dynamic import into its own chunk, reducing
// the initial bundle delivered to the browser. See createLazyRegistration.tsx.
import { createLazyRegistration } from './catalog/createLazyRegistration';

const richComponents = [
  createLazyRegistration('AuthCard', () => import('./catalog/components/AuthCard')),
  createLazyRegistration('AzureAction', () => import('./catalog/components/AzureAction')),
  createLazyRegistration('AzureLoginCard', () => import('./catalog/components/AzureLoginCard')),
  createLazyRegistration('AzureResourceForm', () => import('./catalog/components/AzureResourceForm')),
  createLazyRegistration('AzureResourcePicker', () => import('./catalog/components/AzureResourcePicker')),
  createLazyRegistration('CodeBlock', () => import('./catalog/components/CodeBlock')),
  createLazyRegistration('CostEstimate', () => import('./catalog/components/CostEstimate')),
  createLazyRegistration('DecisionCard', () => import('./catalog/components/DecisionCard')),
  createLazyRegistration('FileEditor', () => import('./catalog/components/FileEditor')),
  createLazyRegistration('FormGroup', () => import('./catalog/components/FormGroup')),
  createLazyRegistration('GenerationProgress', () => import('./catalog/components/GenerationProgress')),
  createLazyRegistration('GitHubAction', () => import('./catalog/components/GitHubAction')),
  createLazyRegistration('GitHubCommit', () => import('./catalog/components/GitHubCommit')),
  createLazyRegistration('GitHubLoginCard', () => import('./catalog/components/GitHubLoginCard')),
  createLazyRegistration('GitHubRepoPicker', () => import('./catalog/components/GitHubRepoPicker')),
  createLazyRegistration('Markdown', () => import('./catalog/components/Markdown')),
  createLazyRegistration('ProgressSteps', () => import('./catalog/components/ProgressSteps')),
  createLazyRegistration('Questionnaire', () => import('./catalog/components/Questionnaire')),
  createLazyRegistration('RadioGroup', () => import('./catalog/components/RadioGroup')),
  createLazyRegistration('SteppedCarousel', () => import('./catalog/components/SteppedCarousel')),
  createLazyRegistration('SummaryCard', () => import('./catalog/components/SummaryCard')),
  createLazyRegistration('TrackPicker', () => import('./catalog/components/TrackPicker')),
];

for (const impl of richComponents) {
  clientRegistry.register(impl);
}

// Step 1c: Pack-contributed renderers (azure/*, aks/*, github/*) from each
// pack's ./client subpath. Registers them under their pack-qualified names
// (e.g. "azure/AzureResourceCard") so the LLM can emit pack components in chat
// and Playground can render them via the same A2UI pipeline as core/*.
import { registerPackComponents } from './bootstrap/registerPackComponents';
registerPackComponents(clientRegistry);

// Step 2: Seal — ReadonlyMap, no further registrations accepted
clientRegistry.seal();

// Session-scoped artifact store — one per page load, no singleton fallback.
const sessionArtifactStore = new InMemoryArtifactStore();

// Step 3: Mount React (only after seal)
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <DebugProvider>
        <A2UIRegistryProvider>
          <APIConnectorProvider>
            <GitHubAuthProvider>
            <ArtifactProvider store={sessionArtifactStore}>
              <VirtualFSProvider>
                <App />
              </VirtualFSProvider>
            </ArtifactProvider>
            </GitHubAuthProvider>
          </APIConnectorProvider>
        </A2UIRegistryProvider>
      </DebugProvider>
    </ThemeProvider>
  </React.StrictMode>
);
