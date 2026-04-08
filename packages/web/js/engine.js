/**
 * Client-side conversation engine
 *
 * Mirrors @kickstart/core phase state machine in plain JS.
 * Uses a scripted demo flow until a real LLM backend is wired up.
 *
 * @module engine
 */

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
// Each handler returns { a2ui, text?, advance? }
// a2ui: A2UI JSON array to render as assistant message
// text: optional plain text fallback
// advance: if true, transition to next phase after response

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
    // First turn — greet + ask
    return {
      a2ui: [
        { type: 'Text', text: "Great! Tell me a bit more — what language or framework does it use? (e.g. Node.js, Python, .NET, Java)" },
      ],
    };
  }

  // Second turn — infer app from whatever the user typed, show AppOverview, advance
  const appName = state.collected.appName || extractAppName(input);
  const runtime = detectRuntime(input);

  return {
    advance: true,
    a2ui: [
      { type: 'Text', text: "Got it! Here's what I understand so far:" },
      {
        type: 'AppOverview',
        appName,
        runtime,
        status: 'draft',
        services: detectServices(input),
        description: state.collected.description || input,
      },
      { type: 'Text', text: "Next I'll sketch out an architecture for you." },
    ],
  };
}

function designHandler(_input, state) {
  const appName = state.collected.appName || 'my-app';
  return {
    advance: true,
    a2ui: [
      { type: 'Text', text: `Here's a recommended architecture for **${appName}**:` },
      {
        type: 'ArchitectureDiagram',
        title: 'Proposed Architecture',
        components: [
          { name: 'Web App', icon: '🌐', description: state.collected.runtime || 'Node.js' },
          { name: 'App Platform', icon: '☁️', description: 'Scalable hosting' },
          { name: 'Database', icon: '🗄️', description: 'Managed data store' },
          { name: 'CI/CD', icon: '🔄', description: 'GitHub Actions' },
        ],
      },
      { type: 'Text', text: "I'll now generate the deployment files for this setup." },
    ],
  };
}

function generateHandler(_input, state) {
  const appName = state.collected.appName || 'my-app';
  return {
    advance: true,
    a2ui: [
      { type: 'Text', text: 'I\'ve generated the key files for your project:' },
      {
        type: 'CodeBlock',
        language: 'dockerfile',
        code: `FROM node:20-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --production\nCOPY . .\nEXPOSE 3000\nCMD ["node", "server.js"]`,
      },
      {
        type: 'CodeBlock',
        language: 'yaml',
        code: `name: Deploy ${appName}\non:\n  push:\n    branches: [main]\njobs:\n  build-and-deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: docker build -t ${appName} .\n      - run: echo "Deploying to app platform..."`,
      },
      { type: 'Text', text: "Let's review the estimated cost before moving on." },
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
      { type: 'Text', text: "Looks good — let's hand this off to your GitHub repo so you can start coding." },
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
      { type: 'Text', text: "When you're ready, I can help you deploy to Azure." },
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
  if (services.length === 0) services.push('Web');
  return services;
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Create a conversation engine instance.
 * @param {Object} opts
 * @param {Function} opts.onPhaseChange - (phaseIndex: number) => void
 * @param {Function} opts.onResponse    - ({ a2ui, text }) => void
 */
export function createEngine({ onPhaseChange, onResponse }) {
  let state = createInitialState();

  function currentPhaseIndex() {
    return phaseIndex(state.currentPhase);
  }

  /** Process a user message and produce a response. */
  function handleMessage(userText) {
    // Stash first user input as description / appName on first discover turn
    if (state.currentPhase === Phase.Discover && state.turnCount === 0) {
      state.collected.description = userText;
      state.collected.appName = extractAppName(userText);
    }

    const handler = DEMO_HANDLERS[state.currentPhase];
    if (!handler) return;

    const result = handler(userText, state);
    state.turnCount++;

    if (result.advance) {
      state = advance(state);
      onPhaseChange?.(currentPhaseIndex());
    }

    onResponse?.(result);
  }

  /** Get welcome A2UI for the initial screen. */
  function getWelcome() {
    return [
      {
        type: 'Text',
        text: "👋 Hi! I'm Kickstart — your AI guide for getting apps running on Azure. Tell me: **what are you building?**",
      },
    ];
  }

  return Object.freeze({
    handleMessage,
    getWelcome,
    getCurrentPhase: () => state.currentPhase,
    getCurrentPhaseIndex: () => currentPhaseIndex(),
    getState: () => structuredClone(state),
  });
}
