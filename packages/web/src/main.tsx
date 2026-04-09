import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { APIConnectorProvider } from './contexts/APIConnectorContext';
import { ArtifactProvider } from './contexts/ArtifactContext';
import { registerKit, azureKit, githubKit } from '@kickstart/core';

// Register integration kits at startup — auto-wires tools + connectors into
// their default registries so the engine can call them immediately.
registerKit(azureKit);
registerKit(githubKit);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <APIConnectorProvider>
      <ArtifactProvider>
        <App />
      </ArtifactProvider>
    </APIConnectorProvider>
  </React.StrictMode>
);
