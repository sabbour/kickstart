import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { APIConnectorProvider } from './contexts/APIConnectorContext';
import { ArtifactProvider } from './contexts/ArtifactContext';
import { VirtualFSProvider } from './contexts/VirtualFSContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { DebugProvider } from './contexts/DebugContext';
import { A2UIRegistryProvider, clientRegistry } from './contexts/A2UIRegistryContext';
import { InMemoryArtifactStore } from '@kickstart/harness';

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
