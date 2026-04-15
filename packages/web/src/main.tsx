import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { APIConnectorProvider } from './contexts/APIConnectorContext';
import { ArtifactProvider } from './contexts/ArtifactContext';
import { VirtualFSProvider } from './contexts/VirtualFSContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { DebugProvider } from './contexts/DebugContext';
import { registerKit, azureKit, githubKit, InMemoryArtifactStore } from '@kickstart/core';
import { initializeTelemetry } from './services/telemetry';

// Register integration kits at startup — auto-wires tools + connectors into
// their default registries so the engine can call them immediately.
// Note: registerKit is async to support lifecycle hooks, but built-in kits
// have no onActivate, so these resolve synchronously.
void registerKit(azureKit);
void registerKit(githubKit);

// Session-scoped artifact store — one per page load, no singleton fallback.
const sessionArtifactStore = new InMemoryArtifactStore();

void initializeTelemetry();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <DebugProvider>
        <APIConnectorProvider>
          <ArtifactProvider store={sessionArtifactStore}>
            <VirtualFSProvider>
              <App />
            </VirtualFSProvider>
          </ArtifactProvider>
        </APIConnectorProvider>
      </DebugProvider>
    </ThemeProvider>
  </React.StrictMode>
);
