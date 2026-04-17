import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { APIConnectorProvider } from './contexts/APIConnectorContext';
import { ArtifactProvider } from './contexts/ArtifactContext';
import { VirtualFSProvider } from './contexts/VirtualFSContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { DebugProvider } from './contexts/DebugContext';
import { InMemoryArtifactStore } from '@kickstart/harness';

// Session-scoped artifact store — one per page load, no singleton fallback.
const sessionArtifactStore = new InMemoryArtifactStore();

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
