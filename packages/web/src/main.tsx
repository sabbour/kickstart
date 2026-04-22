// MUST be the first import: disables Zod's JIT (`new Function`) path before
// any schema is constructed, so the app loads under `script-src 'self'` with
// no `'unsafe-eval'`. See `./lib/configure-zod.ts`.
import './lib/configure-zod';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { APIConnectorProvider } from './contexts/APIConnectorContext';
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

// Step 1b: Kickstart rich components (domain-neutral)
import {
  AuthCard,
  AzureAction,
  AzureLoginCard,
  AzureResourceForm,
  AzureResourcePicker,
  CodeBlock,
  CostEstimate,
  DecisionCard,
  FileEditor,
  FormGroup,
  GenerationProgress,
  GitHubAction,
  GitHubCommit,
  GitHubLoginCard,
  GitHubRepoPicker,
  Markdown,
  ProgressSteps,
  Questionnaire,
  RadioGroup,
  SteppedCarousel,
  SummaryCard,
} from './catalog/components/index';

const richComponents = [
  AuthCard,
  AzureAction,
  AzureLoginCard,
  AzureResourceForm,
  AzureResourcePicker,
  CodeBlock,
  CostEstimate,
  DecisionCard,
  FileEditor,
  FormGroup,
  GenerationProgress,
  GitHubAction,
  GitHubCommit,
  GitHubLoginCard,
  GitHubRepoPicker,
  Markdown,
  ProgressSteps,
  Questionnaire,
  RadioGroup,
  SteppedCarousel,
  SummaryCard,
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
            <ArtifactProvider store={sessionArtifactStore}>
              <VirtualFSProvider>
                <App />
              </VirtualFSProvider>
            </ArtifactProvider>
          </APIConnectorProvider>
        </A2UIRegistryProvider>
      </DebugProvider>
    </ThemeProvider>
  </React.StrictMode>
);
