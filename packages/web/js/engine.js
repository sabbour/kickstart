/**
 * Client-side conversation engine
 *
 * Mirrors @kickstart/core phase state machine in plain JS.
 * Uses a scripted demo flow until a real LLM backend is wired up.
 *
 * @module engine
 */

import { buildSystemPrompt } from './prompts.js';

// ── Phase definitions (6 phases, matching Decision 11) ──────────────
export const Phase = Object.freeze({
  Discover: 'discover',
  Design:   'design',
  Generate: 'generate',
  Review:   'review',
  Handoff:  'handoff',
  Deploy:   'deploy',
});

const PHASE_ORDER = [
  Phase.Discover,
  Phase.Design,
  Phase.Generate,
  Phase.Review,
  Phase.Handoff,
  Phase.Deploy,
];

// ── State machine ───────────────────────────────────────────────────

function createInitialState() {
  const phaseStatus = {};
  for (const p of PHASE_ORDER) {
    phaseStatus[p] = p === Phase.Discover ? 'active' : 'pending';
  }
  return {
    currentPhase: Phase.Discover,
    phaseStatus,
    collected: {},   // user-provided info accumulated across phases
    turnCount: 0,    // how many user turns in the current phase
    isComplete: false,
  };
}

function phaseIndex(phase) {
  return PHASE_ORDER.indexOf(phase);
}

function nextPhase(phase) {
  const idx = phaseIndex(phase);
  return idx < PHASE_ORDER.length - 1 ? PHASE_ORDER[idx + 1] : null;
}

function advance(state) {
  const next = structuredClone(state);
  const np = nextPhase(next.currentPhase);
  next.phaseStatus[next.currentPhase] = 'complete';
  if (np) {
    next.currentPhase = np;
    next.phaseStatus[np] = 'active';
    next.turnCount = 0;
  } else {
    next.isComplete = true;
  }
  return next;
}

// ── Scripted demo responses ─────────────────────────────────────────
// Each handler returns { a2ui, text?, advance?, files? }
// ONE concept per turn. Conversation flows naturally.

const DEMO_HANDLERS = {
  [Phase.Discover]: discoverHandler,
  [Phase.Design]:   designHandler,
  [Phase.Generate]: generateHandler,
  [Phase.Review]:   reviewHandler,
  [Phase.Handoff]:  handoffHandler,
  [Phase.Deploy]:   deployHandler,
};

function discoverHandler(input, state) {
  if (state.turnCount === 0) {
    // First turn — user described their app. Ask about framework.
    state.collected.description = input;
    state.collected.appName = extractAppName(input);
    return {
      a2ui: [
        { type: 'Text', text: `Nice — **${state.collected.appName}** sounds great! What language or framework are you using? (e.g. Node.js, Python, .NET, Java, Go)` },
      ],
    };
  }

  if (state.turnCount === 1) {
    // Second turn — user said the framework. Ask about database/services.
    const runtime = detectRuntime(input);
    state.collected.runtime = runtime;
    return {
      a2ui: [
        { type: 'Text', text: `Got it — **${runtime}**. Does your app need a database or any other backing services? (e.g. PostgreSQL, Redis, MongoDB, or "none")` },
      ],
    };
  }

  // Third turn — collect services, show summary, advance
  const services = detectServices(input);
  state.collected.services = services;
  const appName = state.collected.appName || 'my-app';

  return {
    advance: true,
    a2ui: [
      { type: 'Text', text: "Great, here's what I've gathered:" },
      {
        type: 'AppOverview',
        appName,
        runtime: state.collected.runtime || 'Node.js',
        status: 'draft',
        services,
        description: state.collected.description || input,
      },
      { type: 'Text', text: "Let me sketch out an architecture for this. One moment…" },
    ],
  };
}

function designHandler(_input, state) {
  const appName = state.collected.appName || 'my-app';
  const runtime = state.collected.runtime || 'Node.js';
  const services = state.collected.services || ['Web'];

  const components = [
    { name: appName, icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.67 4-1.8 5.56l-.3-.17z"/></svg>', description: runtime },
    { name: 'App Platform', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19.35 10.04A7.49 7.49 0 0012 4C9.11 4 6.6 5.64 5.35 8.04A5.994 5.994 0 000 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg>', description: 'Azure (scalable hosting)' },
  ];

  if (services.some(s => ['PostgreSQL', 'MySQL', 'MongoDB'].includes(s))) {
    components.push({ name: 'Database', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3C7.58 3 4 4.79 4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7c0-2.21-3.58-4-8-4zm6 14c0 .5-2.13 2-6 2s-6-1.5-6-2v-2.23c1.61.77 3.72 1.23 6 1.23s4.39-.46 6-1.23V17zm0-5c0 .5-2.13 2-6 2s-6-1.5-6-2V9.77c1.61.77 3.72 1.23 6 1.23s4.39-.46 6-1.23V12zm-6-3c-3.87 0-6-1.5-6-2s2.13-2 6-2 6 1.5 6 2-2.13 2-6 2z"/></svg>', description: services.find(s => ['PostgreSQL', 'MySQL', 'MongoDB'].includes(s)) });
  }
  if (services.includes('Redis')) {
    components.push({ name: 'Cache', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M7 2v11h3v9l7-12h-4l4-8z"/></svg>', description: 'Redis' });
  }
  components.push({ name: 'CI/CD', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46A7.93 7.93 0 0020 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74A7.93 7.93 0 004 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>', description: 'GitHub Actions' });

  return {
    advance: true,
    a2ui: [
      { type: 'Text', text: `Here's a recommended architecture for **${appName}**:` },
      {
        type: 'ArchitectureDiagram',
        title: 'Proposed Architecture',
        components,
      },
      { type: 'Text', text: "Does this look right? I'll generate the deployment files next." },
    ],
  };
}

function generateHandler(_input, state) {
  const appName = state.collected.appName || 'my-app';
  const runtime = state.collected.runtime || 'Node.js';

  const dockerfileCode = runtime === 'Python'
    ? `FROM python:3.12-slim\nWORKDIR /app\nCOPY requirements.txt .\nRUN pip install -r requirements.txt\nCOPY . .\nEXPOSE 8000\nCMD ["python", "app.py"]`
    : runtime === '.NET'
    ? `FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build\nWORKDIR /src\nCOPY . .\nRUN dotnet publish -c Release -o /app\n\nFROM mcr.microsoft.com/dotnet/aspnet:8.0\nWORKDIR /app\nCOPY --from=build /app .\nEXPOSE 8080\nENTRYPOINT ["dotnet", "${appName}.dll"]`
    : `FROM node:20-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --production\nCOPY . .\nEXPOSE 3000\nCMD ["node", "server.js"]`;

  const workflowCode = `name: Deploy ${appName}\non:\n  push:\n    branches: [main]\njobs:\n  build-and-deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: docker build -t ${appName} .\n      - run: echo "Deploying to app platform..."`;

  return {
    advance: true,
    files: [
      { name: 'Dockerfile', code: dockerfileCode },
      { name: `.github/workflows/deploy.yml`, code: workflowCode },
    ],
    a2ui: [
      { type: 'Text', text: 'I\'ve generated the key files for your project:' },
      {
        type: 'FileGeneration',
        files: [
          { name: 'Dockerfile', status: 'done' },
          { name: '.github/workflows/deploy.yml', status: 'done' },
        ],
      },
      {
        type: 'CodeBlock',
        language: 'dockerfile',
        code: dockerfileCode,
      },
      {
        type: 'CodeBlock',
        language: 'yaml',
        code: workflowCode,
      },
      { type: 'Text', text: "Click a file chip above to preview it, or continue to review the deployment plan." },
    ],
  };
}

function reviewHandler(_input, _state) {
  return {
    advance: true,
    a2ui: [
      { type: 'Text', text: 'Here\'s a monthly cost estimate for your setup:' },
      {
        type: 'CostEstimate',
        title: 'Estimated Monthly Cost',
        items: [
          { name: 'App Platform (Standard)', sku: 'Standard_DS2_v2', cost: 69.35 },
          { name: 'Managed Database', sku: 'Burstable B1ms', cost: 24.82 },
          { name: 'Container Registry', sku: 'Basic', cost: 5.00 },
        ],
        total: 99.17,
      },
      { type: 'Text', text: "Looks good? Let's set up your GitHub repo and get you coding." },
    ],
  };
}

function handoffHandler(_input, state) {
  const appName = state.collected.appName || 'my-app';
  return {
    advance: true,
    a2ui: [
      { type: 'Text', text: 'Your project is ready! Open it in Codespaces to start developing:' },
      {
        type: 'CodespaceLink',
        repoFullName: `contoso/${appName}`,
        branch: 'main',
        codespaceUrl: `https://github.com/codespaces/new?repo=contoso/${appName}&ref=main`,
        vscodeUrl: `https://vscode.dev/github/contoso/${appName}`,
      },
      { type: 'Text', text: "When you're ready, type **deploy** and I'll kick off the deployment to Azure." },
    ],
  };
}

function deployHandler(_input, state) {
  const appName = state.collected.appName || 'my-app';
  return {
    advance: false,
    a2ui: [
      { type: 'Text', text: `Deploying **${appName}** to your app platform…` },
      {
        type: 'DeploymentProgress',
        title: 'Deployment Progress',
        status: 'running',
        statusLabel: 'In Progress',
        steps: [
          { label: 'Build container image', status: 'completed', duration: '42s' },
          { label: 'Push to registry', status: 'completed', duration: '18s' },
          { label: 'Update app platform', status: 'running' },
          { label: 'Health check', status: 'pending' },
        ],
      },
      {
        type: 'WorkflowStatus',
        title: 'GitHub Actions',
        runs: [
          { name: `Deploy ${appName}`, status: 'in_progress', branch: 'main', sha: 'a1b2c3d', url: '#' },
          { name: 'CI Tests', status: 'success', branch: 'main', sha: 'a1b2c3d', url: '#' },
        ],
      },
    ],
  };
}

// ── Helpers ──────────────────────────────────────────────────────────

function extractAppName(input) {
  const words = input.trim().split(/\s+/);
  if (words.length <= 3) return words.join('-').toLowerCase().replace(/[^a-z0-9-]/g, '');
  return 'my-app';
}

function detectRuntime(input) {
  const lower = input.toLowerCase();
  if (/node|javascript|express|next\.?js|react/.test(lower)) return 'Node.js';
  if (/python|flask|django|fastapi/.test(lower)) return 'Python';
  if (/\.net|c#|csharp|blazor|asp\.net/.test(lower)) return '.NET';
  if (/java|spring|quarkus/.test(lower)) return 'Java';
  if (/\bgo\b|golang|gin|fiber/.test(lower)) return 'Go';
  if (/rust|axum|actix/.test(lower)) return 'Rust';
  return 'Node.js';
}

function detectServices(input) {
  const services = [];
  const lower = input.toLowerCase();
  if (/postgres|pg|sql/.test(lower)) services.push('PostgreSQL');
  if (/mongo/.test(lower)) services.push('MongoDB');
  if (/redis/.test(lower)) services.push('Redis');
  if (/mysql/.test(lower)) services.push('MySQL');
  if (/none|no|nope|nah/.test(lower)) services.push('Web');
  if (services.length === 0) services.push('Web');
  return services;
}

// ── Demo Engine (scripted flow, no backend needed) ──────────────────

/**
 * Create a scripted demo engine instance (no API backend).
 * @param {Object} opts
 * @param {Function} opts.onPhaseChange - (phaseIndex: number) => void
 * @param {Function} opts.onResponse    - ({ a2ui, text, systemPrompt, files }) => void
 * @param {string}   [opts.track]       - 'web-app' or 'agentic-app'
 * @param {string}   [opts.preSelectedFramework] - skip framework question
 */
export function createDemoEngine({ onPhaseChange, onResponse, track, preSelectedFramework }) {
  let state = createInitialState();
  if (track) state.collected.track = track;

  // If framework is pre-selected, record it and start at turnCount 1
  // so the discover handler skips the framework question.
  if (preSelectedFramework) {
    state.collected.runtime = detectRuntime(preSelectedFramework);
    state.collected.preSelectedFramework = preSelectedFramework;
    state.turnCount = 1; // skip the "which framework?" turn
  }

  function currentPhaseIndex() {
    return phaseIndex(state.currentPhase);
  }

  /** Process a user message and produce a response. */
  function handleMessage(userText) {
    const handler = DEMO_HANDLERS[state.currentPhase];
    if (!handler) return;

    const result = handler(userText, state);
    state.turnCount++;

    result.systemPrompt = buildSystemPrompt(state.currentPhase, state.collected, track);

    if (result.advance) {
      state = advance(state);
      onPhaseChange?.(currentPhaseIndex());
    }

    onResponse?.(result);
  }

  function getWelcome() {
    if (preSelectedFramework) {
      return [
        {
          type: 'Text',
          text: `Great choice — let's build something with **${preSelectedFramework}**! Tell me about your app.`,
        },
      ];
    }
    return [
      {
        type: 'Text',
        text: "Hi! I'm **Kickstart** — your AI guide for getting apps running on Azure.\n\nTell me: **what are you building?**",
      },
    ];
  }

  return Object.freeze({
    handleMessage,
    getWelcome,
    getCurrentPhase: () => state.currentPhase,
    getCurrentPhaseIndex: () => currentPhaseIndex(),
    getState: () => structuredClone(state),
    isDemo: true,
  });
}

// ── API Engine (real backend) ───────────────────────────────────────

/**
 * Create an API-backed engine that calls POST /api/converse.
 * @param {Object} opts
 * @param {Function} opts.onPhaseChange - (phaseIndex: number) => void
 * @param {Function} opts.onResponse    - ({ a2ui, text, systemPrompt, files }) => void
 * @param {Object}   opts.apiClient     - API client from createApiClient()
 * @param {Function} [opts.onError]     - ({ message, retryable }) => void
 * @param {Function} [opts.onStreaming]  - (partialText: string) => void
 * @param {string}   [opts.track]       - 'web-app' or 'agentic-app'
 */
export function createApiEngine({ onPhaseChange, onResponse, apiClient, onError, onStreaming, track }) {
  let sessionId = null;
  let currentPhase_ = Phase.Discover;

  function currentPhaseIndex() {
    return phaseIndex(currentPhase_);
  }

  function mapApiResponse(apiRes) {
    return {
      a2ui: apiRes.a2ui ?? null,
      // Prefer cleanText (A2UI markers stripped) over raw message
      text: apiRes.cleanText ?? apiRes.message ?? null,
      systemPrompt: apiRes.systemPrompt ?? null,
      files: apiRes.files ?? null,
      model: apiRes.model ?? null,
      advance: false, // phase change handled by comparing phases
    };
  }

  function handlePhaseFromApi(newPhase) {
    if (newPhase && newPhase !== currentPhase_ && PHASE_ORDER.includes(newPhase)) {
      currentPhase_ = newPhase;
      onPhaseChange?.(currentPhaseIndex());
    }
  }

  async function handleMessage(userText) {
    try {
      const apiRes = await apiClient.converseStream(sessionId, userText, (partial) => {
        // Deliver incremental streaming updates
        if (partial.message) {
          onStreaming?.(partial.message);
        }
      });

      if (apiRes.error) {
        onError?.({
          message: apiRes.message || (typeof apiRes.error === 'string' ? apiRes.error : 'Something went wrong'),
          retryable: apiRes.status === 429 || apiRes.status === 503 || apiRes.status === 0,
        });
        return;
      }

      // Update session
      if (apiRes.sessionId) sessionId = apiRes.sessionId;

      // Handle phase transitions
      handlePhaseFromApi(apiRes.phase);

      // Map to engine response format
      const result = mapApiResponse(apiRes);
      onResponse?.(result);
    } catch (err) {
      onError?.({
        message: err.message || 'Unexpected error',
        retryable: true,
      });
    }
  }

  function getWelcome() {
    return [
      {
        type: 'Text',
        text: "Hi! I'm **Kickstart** — your AI guide for getting apps running on Azure.\n\nTell me: **what are you building?**",
      },
    ];
  }

  return Object.freeze({
    handleMessage,
    getWelcome,
    getCurrentPhase: () => currentPhase_,
    getCurrentPhaseIndex: () => currentPhaseIndex(),
    getState: () => ({ currentPhase: currentPhase_, sessionId }),
    isDemo: false,
  });
}

// ── Smart Factory (auto-selects API or demo) ────────────────────────

/**
 * Create a conversation engine, auto-selecting API mode if an apiClient
 * is provided, or falling back to demo mode.
 *
 * @param {Object} opts
 * @param {Function} opts.onPhaseChange
 * @param {Function} opts.onResponse
 * @param {Object}   [opts.apiClient]   - If provided, uses API backend
 * @param {Function} [opts.onError]     - Error handler (API mode only)
 * @param {Function} [opts.onStreaming]  - Streaming chunk handler (API mode only)
 * @param {string}   [opts.track]       - 'web-app' or 'agentic-app'
 * @param {string}   [opts.preSelectedFramework] - Pre-selected framework name
 */
export function createEngine({ onPhaseChange, onResponse, apiClient, onError, onStreaming, track, preSelectedFramework }) {
  if (apiClient) {
    return createApiEngine({ onPhaseChange, onResponse, apiClient, onError, onStreaming, track });
  }
  return createDemoEngine({ onPhaseChange, onResponse, track, preSelectedFramework });
}
