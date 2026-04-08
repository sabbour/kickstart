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
    { name: appName, icon: '🌐', description: runtime },
    { name: 'App Platform', icon: '☁️', description: 'Azure (scalable hosting)' },
  ];

  if (services.some(s => ['PostgreSQL', 'MySQL', 'MongoDB'].includes(s))) {
    components.push({ name: 'Database', icon: '🗄️', description: services.find(s => ['PostgreSQL', 'MySQL', 'MongoDB'].includes(s)) });
  }
  if (services.includes('Redis')) {
    components.push({ name: 'Cache', icon: '⚡', description: 'Redis' });
  }
  components.push({ name: 'CI/CD', icon: '🔄', description: 'GitHub Actions' });

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
        type: 'CodeBlock',
        language: 'dockerfile',
        code: dockerfileCode,
      },
      {
        type: 'CodeBlock',
        language: 'yaml',
        code: workflowCode,
      },
      { type: 'Text', text: "📁 These files are also available in the **file viewer** on the right. Next, let me show you the estimated cost." },
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
 */
export function createDemoEngine({ onPhaseChange, onResponse }) {
  let state = createInitialState();

  function currentPhaseIndex() {
    return phaseIndex(state.currentPhase);
  }

  /** Process a user message and produce a response. */
  function handleMessage(userText) {
    const handler = DEMO_HANDLERS[state.currentPhase];
    if (!handler) return;

    const result = handler(userText, state);
    state.turnCount++;

    result.systemPrompt = buildSystemPrompt(state.currentPhase, state.collected);

    if (result.advance) {
      state = advance(state);
      onPhaseChange?.(currentPhaseIndex());
    }

    onResponse?.(result);
  }

  function getWelcome() {
    return [
      {
        type: 'Text',
        text: "👋 Hi! I'm **Kickstart** — your AI guide for getting apps running on Azure.\n\nTell me: **what are you building?**",
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
 */
export function createApiEngine({ onPhaseChange, onResponse, apiClient, onError, onStreaming }) {
  let sessionId = null;
  let currentPhase_ = Phase.Discover;

  function currentPhaseIndex() {
    return phaseIndex(currentPhase_);
  }

  function mapApiResponse(apiRes) {
    return {
      a2ui: apiRes.a2ui ?? null,
      text: apiRes.message ?? null,
      systemPrompt: apiRes.systemPrompt ?? null,
      files: apiRes.files ?? null,
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
          message: apiRes.message || 'Something went wrong',
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
        text: "👋 Hi! I'm **Kickstart** — your AI guide for getting apps running on Azure.\n\nTell me: **what are you building?**",
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
 */
export function createEngine({ onPhaseChange, onResponse, apiClient, onError, onStreaming }) {
  if (apiClient) {
    return createApiEngine({ onPhaseChange, onResponse, apiClient, onError, onStreaming });
  }
  return createDemoEngine({ onPhaseChange, onResponse });
}
