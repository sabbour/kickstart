import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const reactRuntime = vi.hoisted(() => ({
  callIndex: 0,
  initialMode: undefined as string | undefined,
}));

const vfsApi = vi.hoisted(() => ({
  clear: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
  exportZip: vi.fn().mockResolvedValue(new Blob()),
  deleteFile: vi.fn().mockResolvedValue(undefined),
  readAll: vi.fn().mockResolvedValue([]),
  getFile: vi.fn().mockResolvedValue(undefined),
  saveWorkspaceSnapshot: vi.fn().mockResolvedValue(undefined),
  loadWorkspaceSnapshot: vi.fn().mockResolvedValue([]),
  clearWorkspaceSnapshots: vi.fn().mockResolvedValue(undefined),
  deleteWorkspaceSnapshot: vi.fn().mockResolvedValue(undefined),
}));

function marker(testId: string) {
  return React.createElement('div', { 'data-testid': testId });
}

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');

  return {
    ...actual,
    default: actual,
    useState: ((initial: unknown) => {
      reactRuntime.callIndex += 1;
      if (reactRuntime.callIndex === 1 && reactRuntime.initialMode !== undefined) {
        return actual.useState(reactRuntime.initialMode);
      }
      return actual.useState(initial as never);
    }) as typeof actual.useState,
    useSyncExternalStore: ((_, getSnapshot) => getSnapshot()) as typeof actual.useSyncExternalStore,
  };
});

vi.mock('@fluentui/react-components', () => ({
  FluentProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  webLightTheme: {},
  webDarkTheme: {},
}));

vi.mock('../components/Layout', () => ({
  Layout: ({ sidebar, fileEditor, fileManagerSidebar, fileViewer, children }: any) =>
    React.createElement(
      'div',
      { 'data-testid': 'layout' },
      sidebar,
      fileEditor,
      fileManagerSidebar,
      fileViewer,
      children,
    ),
}));

vi.mock('../components/Landing', () => ({
  Landing: () => marker('landing'),
}));

vi.mock('../components/Chat/ChatShell', () => ({
  ChatShell: () => marker('chat-shell'),
}));

vi.mock('../components/Sidebar/SessionsSidebar', () => ({
  SessionsSidebar: () => marker('sessions-sidebar'),
}));

vi.mock('../components/FileEditor/FileEditor', () => ({
  FileEditor: () => marker('legacy-file-editor'),
}));

vi.mock('../components/FileTreePanel', () => ({
  FileTreePanel: () => marker('legacy-file-tree-panel'),
}));

vi.mock('../components/FileManager', () => ({
  FileManagerSidebar: () => marker('file-manager-sidebar'),
  FileViewer: () => marker('file-viewer'),
}));

vi.mock('../pages/Playground', () => ({
  Playground: () => marker('playground'),
}));

vi.mock('../hooks/useA2UI', () => ({
  useA2UI: () => ({
    reset: () => undefined,
    processMessages: () => [],
    getSurface: () => undefined,
  }),
}));

vi.mock('../hooks/useActionDispatch', () => ({
  useActionDispatch: () => ({
    handler: () => undefined,
    resetConsecutiveCount: () => undefined,
  }),
}));

vi.mock('../hooks/useProgressiveQueue', () => ({
  useProgressiveQueue: () => ({
    visibleIds: [],
    enqueue: () => undefined,
    reset: () => undefined,
    flush: () => undefined,
  }),
}));

vi.mock('../hooks/useSessions', () => ({
  useSessions: () => ({
    sessions: [],
    activeSessionId: null,
    recentSessions: [],
    getActiveSession: () => null,
    createSession: () => ({ id: 'session-1', messages: [] }),
    addMessage: () => undefined,
    updateSession: () => undefined,
    deleteSession: () => undefined,
    clearAllSessions: () => undefined,
    setActiveSessionId: () => undefined,
  }),
}));

vi.mock('../hooks/useNavigation', () => ({
  useNavigation: () => ({
    pushSession: () => undefined,
    pushLanding: () => undefined,
    replaceCurrent: () => undefined,
    getInitialState: () => ({ view: 'landing' as const }),
  }),
}));

vi.mock('../hooks/useStreaming', () => ({
  useStreaming: () => ({
    isStreaming: false,
    streamText: '',
    send: () => undefined,
  }),
}));

vi.mock('../hooks/useMockStreaming', () => ({
  useMockStreaming: () => ({
    isStreaming: false,
    streamText: '',
    send: () => undefined,
  }),
}));

vi.mock('../contexts/APIConnectorContext', () => ({
  useAPIConnectorRegistry: () => ({}),
}));

vi.mock('../contexts/ArtifactContext', () => ({
  useArtifacts: () => ({
    getArtifact: () => null,
  }),
}));

vi.mock('../contexts/ConversationSessionContext', () => ({
  ConversationSessionProvider: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}));

vi.mock('../contexts/ThemeContext', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));

vi.mock('../contexts/DebugContext', () => ({
  useDebug: () => ({
    debugEnabled: false,
    logAction: () => undefined,
    clearActionLog: () => undefined,
    toggleDebug: () => undefined,
  }),
}));

vi.mock('../contexts/VirtualFSContext', () => ({
  useVirtualFS: () => ({
    fs: vfsApi,
    files: ['Dockerfile'],
    fileRecords: [{
      path: 'Dockerfile',
      content: 'FROM node:20-alpine',
      language: 'dockerfile',
      createdAt: 0,
      updatedAt: 0,
    }],
  }),
}));

vi.mock('../services/api-client', () => ({
  healthCheck: () => Promise.resolve(true),
}));

vi.mock('../services/mock-streaming', () => ({
  isMockMode: () => false,
  isPlaygroundMode: () => false,
}));

let App: typeof import('../App').App;

beforeAll(async () => {
  ({ App } = await import('../App'));
});

describe('App file surface composition', () => {
  beforeEach(() => {
    reactRuntime.callIndex = 0;
    reactRuntime.initialMode = 'chat';
    vi.clearAllMocks();
  });

  it('keeps the workspace file manager as the only mounted file surface in chat mode', () => {
    const markup = renderToStaticMarkup(React.createElement(App));

    expect(markup).toContain('data-testid="file-manager-sidebar"');
    expect(markup).toContain('data-testid="file-viewer"');
    expect(markup).not.toContain('data-testid="legacy-file-editor"');
    expect(markup).not.toContain('data-testid="legacy-file-tree-panel"');
  });
});
