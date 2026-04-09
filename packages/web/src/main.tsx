import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import { APIConnectorProvider } from './contexts/APIConnectorContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <APIConnectorProvider>
      <App />
    </APIConnectorProvider>
  </React.StrictMode>
);
