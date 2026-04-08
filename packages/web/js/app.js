/**
 * App — Product-specific route config & initialization
 * @module app
 */

import { Router, Navigation, Breadcrumbs, EventBus } from './framework/core.js';
import { createCopilotPanel, createCommandBar, createWizard, createCard, createCodeBlock, escapeHtml } from './framework/components.js';
import { renderA2UI } from './framework/a2ui-renderer.js';
import { createEngine } from './engine.js';
import { createApiClient } from './api-client.js';
import { buildSystemPrompt } from './prompts.js';
import Auth from './auth.js';

// ---------- Conversation Engine ----------
let engine;
let apiClient = null;
let isApiMode = false;

// ---------- Copilot Panel ----------
let promptInspectorOn = false;

const copilot = createCopilotPanel({
  phases: [
    { id: 'discover', label: 'Discover' },
    { id: 'design', label: 'Design' },
    { id: 'generate', label: 'Generate' },
    { id: 'review', label: 'Review' },
    { id: 'handoff', label: 'Handoff' },
    { id: 'deploy', label: 'Deploy' },
  ],
  onSend(text) {
    handleUserMessage(text);
  },
  onPromptInspectorToggle(enabled) {
    promptInspectorOn = enabled;
  },
});

// Mount Copilot panel
document.getElementById('copilot-slot')?.appendChild(copilot.element);

// Wire conversation engine
async function initEngine() {
  // Try to connect to API backend
  apiClient = createApiClient();
  const apiAvailable = await apiClient.healthCheck();

  if (apiAvailable) {
    isApiMode = true;
    engine = createEngine({
      apiClient,
      onPhaseChange(phaseIndex) {
        copilot.setPhase(phaseIndex);
      },
      onResponse({ a2ui, text, systemPrompt }) {
        copilot.setTyping(false);
        clearStreamingBubble();

        if (a2ui) {
          const html = renderA2UIMessage(a2ui);
          copilot.addMessage({ role: 'assistant', html });
        } else if (text) {
          copilot.addMessage({ role: 'assistant', text });
        }

        if (promptInspectorOn && systemPrompt) {
          const promptHtml = renderPromptInspector(systemPrompt);
          copilot.addMessage({ role: 'assistant', html: promptHtml });
        }
      },
      onError({ message, retryable }) {
        copilot.setTyping(false);
        clearStreamingBubble();
        showErrorBubble(message, retryable);
      },
      onStreaming(partialText) {
        updateStreamingBubble(partialText);
      },
    });
  } else {
    // Fallback to demo mode
    isApiMode = false;
    engine = createEngine({
      onPhaseChange(phaseIndex) {
        copilot.setPhase(phaseIndex);
      },
      onResponse({ a2ui, text, systemPrompt }) {
        copilot.setTyping(false);
        if (a2ui) {
          const html = renderA2UIMessage(a2ui);
          copilot.addMessage({ role: 'assistant', html });
        } else if (text) {
          copilot.addMessage({ role: 'assistant', text });
        }

        if (promptInspectorOn && systemPrompt) {
          const promptHtml = renderPromptInspector(systemPrompt);
          copilot.addMessage({ role: 'assistant', html: promptHtml });
        }
      },
    });

    showDemoBadge();
  }
}

// ---------- Demo Mode Badge ----------
function showDemoBadge() {
  const header = document.querySelector('.copilot-header-title');
  if (!header || header.querySelector('.demo-badge')) return;

  const badge = document.createElement('span');
  badge.className = 'demo-badge';
  badge.textContent = 'Demo';
  badge.title = 'Running without API backend — using scripted demo responses';
  header.appendChild(badge);
}

// ---------- Streaming bubble ----------
let streamingBubbleEl = null;
let lastRetryMessage = null;

function updateStreamingBubble(text) {
  copilot.setTyping(false);
  const container = document.querySelector('.copilot-messages');
  if (!container) return;

  if (!streamingBubbleEl) {
    streamingBubbleEl = document.createElement('div');
    streamingBubbleEl.className = 'chat-bubble assistant streaming';
    streamingBubbleEl.setAttribute('role', 'article');
    container.appendChild(streamingBubbleEl);
  }

  streamingBubbleEl.textContent = text;
  requestAnimationFrame(() => {
    container.scrollTop = container.scrollHeight;
  });
}

function clearStreamingBubble() {
  if (streamingBubbleEl) {
    streamingBubbleEl.remove();
    streamingBubbleEl = null;
  }
}

// ---------- Error bubble ----------
function showErrorBubble(message, retryable) {
  const container = document.querySelector('.copilot-messages');
  if (!container) return;

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble assistant error-bubble';
  bubble.setAttribute('role', 'alert');

  const msgEl = document.createElement('span');
  msgEl.className = 'error-bubble-text';
  msgEl.textContent = message;
  bubble.appendChild(msgEl);

  if (retryable) {
    lastRetryMessage = lastRetryMessage; // preserve for retry
    const retryBtn = document.createElement('button');
    retryBtn.className = 'error-retry-btn';
    retryBtn.textContent = 'Retry';
    retryBtn.addEventListener('click', () => {
      bubble.remove();
      if (lastRetryMessage) {
        handleUserMessage(lastRetryMessage);
      }
    });
    bubble.appendChild(retryBtn);
  }

  container.appendChild(bubble);
  requestAnimationFrame(() => {
    container.scrollTop = container.scrollHeight;
  });
}

function handleUserMessage(text) {
  lastRetryMessage = text;
  copilot.setTyping(true);

  if (isApiMode) {
    // API mode — async, real latency
    engine.handleMessage(text);
  } else {
    // Demo mode — small delay to feel natural
    setTimeout(() => {
      engine.handleMessage(text);
    }, 800);
  }
}

function renderA2UIMessage(a2uiJson) {
  const el = renderA2UI(a2uiJson, {
    onAction(action, data) {
      EventBus.emit('copilot:action', { action, data });
    },
    onDataChange(name, value) {
      EventBus.emit('copilot:dataChange', { name, value });
    },
  });
  return el.outerHTML;
}

/** Render an expandable system prompt inspector block. */
function renderPromptInspector(systemPrompt) {
  const promptA2UI = [
    {
      type: 'Text',
      text: '<details class="prompt-inspector"><summary>🔍 View system prompt for this phase</summary></details>',
    },
  ];

  const wrapper = renderA2UI(promptA2UI, {});
  const details = wrapper.querySelector('details.prompt-inspector');
  if (details) {
    const codeBlock = createCodeBlock(systemPrompt, 'system-prompt');
    details.appendChild(codeBlock);
  }
  return wrapper.outerHTML;
}

// ---------- Auth UI ----------
async function initAuth() {
  await Auth.initialize();
  updateAuthUI();
}

function updateAuthUI() {
  const userBtn = document.getElementById('topbar-user');
  if (!userBtn) return;

  if (Auth.isAuthenticated()) {
    const info = Auth.getUserInfo();
    userBtn.innerHTML = `
      <span class="topbar-avatar">${info.initials}</span>
      <span>${info.name}</span>`;
    userBtn.onclick = () => Auth.logout().then(updateAuthUI);
    userBtn.title = `Signed in as ${info.email} — click to sign out`;
  } else {
    userBtn.innerHTML = `
      <span class="topbar-avatar">?</span>
      <span>Sign in</span>`;
    userBtn.onclick = () => Auth.login().then(updateAuthUI);
    userBtn.title = 'Sign in with your Microsoft account';
  }
}

// ---------- Command bar ----------
const commandBar = createCommandBar([
  {
    label: 'New deployment',
    icon: '＋',
    primary: true,
    action: 'new-deployment',
    onClick: () => Router.navigate('/create'),
  },
  { type: 'divider' },
  {
    label: 'Refresh',
    icon: '↻',
    action: 'refresh',
    onClick: () => Router.resolve(),
  },
  { type: 'spacer' },
  {
    label: 'Copilot',
    icon: '✦',
    action: 'toggle-copilot',
    onClick: () => copilot.toggle(),
  },
]);

document.getElementById('command-bar-slot')?.appendChild(commandBar);

// ---------- Routes ----------

Router.register('/', renderOverview);
Router.register('/overview', renderOverview);
Router.register('/create', renderCreateWizard);
Router.register('/deployments', renderDeployments);
Router.register('/settings', renderSettings);
Router.register('*', renderNotFound);

// --- Overview (landing page) ---
function renderOverview(container) {
  container.innerHTML = '';

  const hero = document.createElement('section');
  hero.style.cssText = 'max-width:680px;margin:0 auto;text-align:center;padding:var(--spacing-xxxl) 0';
  hero.innerHTML = `
    <img src="assets/logo.svg" alt="" width="64" height="64" style="margin-bottom:var(--spacing-xl)">
    <h1 style="font-size:var(--font-size-800);font-weight:var(--font-weight-bold);margin-bottom:var(--spacing-m)">
      Deploy to AKS, guided by AI
    </h1>
    <p style="font-size:var(--font-size-400);color:var(--color-neutral-foreground-2);margin-bottom:var(--spacing-xxl)">
      Kickstart walks you through containerizing your app, choosing the right Azure resources,
      and deploying to AKS — step by step, with AI that explains every decision.
    </p>
    <button class="btn primary large" id="cta-get-started">Get Started</button>`;

  hero.querySelector('#cta-get-started')?.addEventListener('click', () => {
    Router.navigate('/create');
    if (!copilot.isVisible) copilot.toggle(true);
  });

  container.appendChild(hero);

  // Feature cards
  const features = document.createElement('section');
  features.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:var(--spacing-xl);max-width:900px;margin:0 auto;padding-bottom:var(--spacing-xxxl)';

  const cards = [
    { title: 'Discover', body: 'Tell us about your app — language, framework, dependencies. Kickstart figures out the rest.' },
    { title: 'Design', body: 'Get a recommended architecture with cost estimates and best-practice configurations.' },
    { title: 'Generate', body: 'Kickstart produces deployment files, CI/CD workflows, and infrastructure templates.' },
    { title: 'Deploy', body: 'One-click deployment with a live progress view. GitHub Actions pipeline included.' },
  ];

  cards.forEach(c => features.appendChild(createCard(c)));
  container.appendChild(features);
}

// --- Create AKS App (wizard placeholder) ---
function renderCreateWizard(container) {
  container.innerHTML = '';

  const wizard = createWizard({
    title: 'Create AKS App',
    steps: [
      {
        title: 'App Details',
        render: () => `
          <h2 style="margin-bottom:var(--spacing-l)">Tell us about your app</h2>
          <div class="form-group">
            <label class="form-label">App name <span class="required">*</span></label>
            <input class="form-input" placeholder="my-awesome-app" name="appName">
          </div>
          <div class="form-group">
            <label class="form-label">GitHub repository</label>
            <input class="form-input" placeholder="https://github.com/org/repo" name="repoUrl">
          </div>
          <div class="form-group">
            <label class="form-label">Language / Framework</label>
            <select class="form-input" name="language">
              <option value="">-- Select --</option>
              <option>Node.js</option>
              <option>Python</option>
              <option>.NET</option>
              <option>Java</option>
              <option>Go</option>
              <option>Other</option>
            </select>
          </div>`,
        validate: () => true,
      },
      {
        title: 'Architecture',
        render: () => `
          <h2 style="margin-bottom:var(--spacing-l)">Review architecture</h2>
          <p style="color:var(--color-neutral-foreground-2);margin-bottom:var(--spacing-xl)">
            Kickstart will analyze your repo and recommend an architecture.
            This step will be powered by the AI conversation engine.
          </p>
          <div class="skeleton skeleton-block" style="height:200px"></div>`,
        validate: () => true,
      },
      {
        title: 'Configuration',
        render: () => `
          <h2 style="margin-bottom:var(--spacing-l)">Configure resources</h2>
          <p style="color:var(--color-neutral-foreground-2)">
            Resource configuration will be generated by the AI based on your app's needs.
          </p>`,
        validate: () => true,
      },
      {
        title: 'Review + Create',
        render: () => `
          <h2 style="margin-bottom:var(--spacing-l)">Review and deploy</h2>
          <p style="color:var(--color-neutral-foreground-2)">
            Final review of all resources and configurations before deployment.
          </p>`,
        validate: () => true,
      },
    ],
    onComplete(data) {
      console.log('[App] Wizard completed:', data);
      copilot.addMessage({ role: 'assistant', text: '🚀 Deployment initiated! (This is a prototype — no real resources will be created.)' });
    },
    onCancel() {
      Router.navigate('/');
    },
  });

  container.appendChild(wizard.element);

  // Open copilot if not visible
  if (!copilot.isVisible) copilot.toggle(true);
}

// --- Deployments (placeholder) ---
function renderDeployments(container) {
  container.innerHTML = `
    <div style="max-width:680px;margin:var(--spacing-xxl) auto;text-align:center">
      <h2 style="margin-bottom:var(--spacing-m)">Deployments</h2>
      <p style="color:var(--color-neutral-foreground-2);margin-bottom:var(--spacing-xl)">
        Your deployment history will appear here after you create your first AKS app.
      </p>
      <button class="btn primary" onclick="window.location.hash='/create'">Create your first app</button>
    </div>`;
}

// --- Settings (placeholder) ---
function renderSettings(container) {
  container.innerHTML = `
    <div style="max-width:680px;margin:var(--spacing-xxl) auto">
      <h2 style="margin-bottom:var(--spacing-m)">Settings</h2>
      <p style="color:var(--color-neutral-foreground-2)">
        Settings and preferences will be available here. Coming soon.
      </p>
    </div>`;
}

// --- 404 ---
function renderNotFound(container) {
  container.innerHTML = `
    <div style="max-width:480px;margin:var(--spacing-xxl) auto;text-align:center">
      <h2 style="margin-bottom:var(--spacing-m)">Page not found</h2>
      <p style="margin-bottom:var(--spacing-xl)">The page you're looking for doesn't exist.</p>
      <a class="btn primary" href="#/">Go home</a>
    </div>`;
}

// ---------- Navigation ----------
Navigation.init({
  items: [
    { label: 'Overview', path: '/', icon: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2.5l7 5.5v9a1 1 0 01-1 1h-4v-5H8v5H4a1 1 0 01-1-1V8l7-5.5z"/></svg>' },
    { label: 'Create AKS App', path: '/create', icon: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"/></svg>' },
    { divider: true },
    { label: 'Deployments', path: '/deployments', icon: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M3 4h14v2H3V4zm0 5h14v2H3V9zm0 5h14v2H3v-2z"/></svg>' },
    { label: 'Settings', path: '/settings', icon: '<svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor"><path d="M8.5 2h3l.4 2 1.3.5 1.7-1.2 2.1 2.1-1.2 1.7.5 1.3 2 .4v3l-2 .4-.5 1.3 1.2 1.7-2.1 2.1-1.7-1.2-1.3.5-.4 2h-3l-.4-2-1.3-.5-1.7 1.2-2.1-2.1 1.2-1.7-.5-1.3-2-.4v-3l2-.4.5-1.3L3.2 5.3l2.1-2.1 1.7 1.2L8.3 4l.2-2zM10 7a3 3 0 100 6 3 3 0 000-6z"/></svg>' },
  ],
});

Breadcrumbs.init({
  '/': 'Home',
  '/overview': 'Overview',
  '/create': 'Create AKS App',
  '/deployments': 'Deployments',
  '/settings': 'Settings',
});

// ---------- Boot ----------
async function boot() {
  await initAuth();
  await initEngine();

  // Send welcome message using A2UI from engine
  const welcomeA2UI = engine.getWelcome();
  const html = renderA2UIMessage(welcomeA2UI);
  copilot.addMessage({ role: 'assistant', html });

  Router.init('#content-area');
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
