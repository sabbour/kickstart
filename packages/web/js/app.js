/**
 * App — Chat-first UI initialization with landing page
 * @module app
 */

import { EventBus } from './framework/core.js';
import { createChatUI, createFileViewer, createCodeBlock, escapeHtml, renderMarkdown } from './framework/components.js';
import { renderA2UI } from './framework/a2ui-renderer.js';
import { createEngine } from './engine.js';
import { createApiClient } from './api-client.js';
import { buildSystemPrompt } from './prompts.js';
import Auth from './auth.js';

// ---------- Conversation Engine ----------
let engine;
let apiClient = null;
let isApiMode = false;

// ---------- Landing page state ----------
let selectedTrack = null;       // 'web-app' | 'agentic-app' | null
let selectedFramework = null;   // framework name or null
let pendingQuickPrompt = null;
let resumingSessionId = null;   // set when clicking a recent session

// ---------- Inspiration Carousel ----------
let INSPIRATION_IDEAS = [
  { title: 'Movie night pick that settles disputes', subtitle: 'Your group votes, and the app chooses confidently.', prompt: 'I want to build a movie night pick app that settles disputes — your group votes, and the app chooses confidently.' },
  { title: 'AI recipe finder from fridge photos', subtitle: 'Snap a photo of your fridge, get dinner ideas instantly.', prompt: 'I want to build an AI recipe finder from fridge photos — snap a photo of your fridge, get dinner ideas instantly.' },
  { title: 'Team standup bot that respects time zones', subtitle: 'Async standups that actually work for global teams.', prompt: 'I want to build a team standup bot that respects time zones — async standups that actually work for global teams.' },
  { title: 'Pet adoption matcher powered by AI', subtitle: 'Swipe-style matching between shelters and families.', prompt: 'I want to build a pet adoption matcher powered by AI — swipe-style matching between shelters and families.' },
  { title: 'Real-time air quality dashboard', subtitle: 'Hyperlocal pollution data with health recommendations.', prompt: 'I want to build a real-time air quality dashboard — hyperlocal pollution data with health recommendations.' },
  { title: 'Neighborhood tool lending library', subtitle: 'Borrow a drill from your neighbor — no awkward texts required.', prompt: 'I want to build a neighborhood tool lending library — borrow a drill from your neighbor, no awkward texts required.' },
  { title: 'Personal finance coach that speaks plain English', subtitle: 'Budget tracking without the spreadsheet headaches.', prompt: 'I want to build a personal finance coach that speaks plain English — budget tracking without the spreadsheet headaches.' },
  { title: 'Workout generator for hotel rooms', subtitle: 'No equipment? No problem. AI builds a routine in seconds.', prompt: 'I want to build a workout generator for hotel rooms — no equipment needed, AI builds a routine in seconds.' },
  { title: 'Live event parking optimizer', subtitle: 'Find the fastest lot and walking route to the venue.', prompt: 'I want to build a live event parking optimizer — find the fastest lot and walking route to the venue.' },
  { title: 'Study group matchmaker for college', subtitle: 'Match with classmates by course, schedule, and study style.', prompt: 'I want to build a study group matchmaker for college — match with classmates by course, schedule, and study style.' },
];
let carouselIndex = 0;
let carouselTimer = null;

// ---------- Prompt Inspector ----------
let promptInspectorOn = false;

// ---------- Recent Sessions (localStorage) ----------
const SESSIONS_KEY = 'kickstart-sessions';
const MAX_RECENT = 5;

function getSessions() {
  try {
    return JSON.parse(localStorage.getItem(SESSIONS_KEY) || '[]');
  } catch { return []; }
}

function saveSession(session) {
  const sessions = getSessions();
  // Update existing or prepend new
  const idx = sessions.findIndex(s => s.id === session.id);
  if (idx >= 0) {
    sessions[idx] = { ...sessions[idx], ...session, updatedAt: Date.now() };
  } else {
    sessions.unshift({ ...session, createdAt: Date.now(), updatedAt: Date.now() });
  }
  // Keep only recent
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions.slice(0, 20)));
}

function deleteSession(id) {
  let sessions = getSessions();
  sessions = sessions.filter(s => s.id !== id);
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

function renderRecentSessions() {
  const section = document.getElementById('recent-sessions-section');
  const list = document.getElementById('recent-sessions-list');
  if (!section || !list) return;

  const sessions = getSessions().slice(0, MAX_RECENT);
  if (sessions.length === 0) {
    section.style.display = 'none';
    return;
  }

  section.style.display = '';
  list.innerHTML = sessions.map(s => {
    const date = new Date(s.updatedAt || s.createdAt);
    const dateStr = date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
    return `<div class="recent-session-item" data-session-id="${s.id}">
      <div class="recent-session-content">
        <span class="recent-session-title">${escapeHtml(s.title || s.prompt || 'Untitled session')}</span>
        <span class="recent-session-date">${dateStr}</span>
        <button class="recent-session-delete" aria-label="Delete session" title="Delete session">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M2.146 2.146a.5.5 0 01.708 0L6 5.293l3.146-3.147a.5.5 0 01.708.708L6.707 6l3.147 3.146a.5.5 0 01-.708.708L6 6.707l-3.146 3.147a.5.5 0 01-.708-.708L5.293 6 2.146 2.854a.5.5 0 010-.708z"/>
          </svg>
        </button>
      </div>
    </div>`;
  }).join('');

}

// Set up recent-sessions click delegation once (avoids stacking listeners)
function initRecentSessionsListener() {
  const list = document.getElementById('recent-sessions-list');
  if (!list) return;
  list.addEventListener('click', (e) => {
    // Handle confirm-delete Yes
    const yesBtn = e.target.closest('.confirm-delete-yes');
    if (yesBtn) {
      e.stopPropagation();
      const item = yesBtn.closest('.recent-session-item');
      if (item) {
        deleteSession(item.dataset.sessionId);
        renderRecentSessions();
      }
      return;
    }

    // Handle confirm-delete No (cancel)
    const noBtn = e.target.closest('.confirm-delete-no');
    if (noBtn) {
      e.stopPropagation();
      const item = noBtn.closest('.recent-session-item');
      const confirmBar = item?.querySelector('.confirm-delete-bar');
      if (confirmBar) confirmBar.remove();
      // Restore the normal content visibility
      const content = item?.querySelector('.recent-session-content');
      if (content) content.style.display = '';
      return;
    }

    // Check for delete button click — show inline confirmation
    const deleteBtn = e.target.closest('.recent-session-delete');
    if (deleteBtn) {
      e.stopPropagation();
      const item = deleteBtn.closest('.recent-session-item');
      if (!item || item.querySelector('.confirm-delete-bar')) return; // already showing

      const title = item.querySelector('.recent-session-title')?.textContent || 'this session';
      const shortTitle = title.length > 20 ? title.slice(0, 20) + '…' : title;

      // Hide normal content, show confirmation bar
      const content = item.querySelector('.recent-session-content');
      if (content) content.style.display = 'none';

      const bar = document.createElement('div');
      bar.className = 'confirm-delete-bar';
      bar.innerHTML = `<span class="confirm-delete-label">Delete "${escapeHtml(shortTitle)}"?</span>
        <button class="confirm-delete-yes">Yes</button>
        <button class="confirm-delete-no">No</button>`;
      item.appendChild(bar);
      return;
    }

    // Handle session item click
    const item = e.target.closest('.recent-session-item');
    if (!item) return;
    const sessionId = item.dataset.sessionId;
    const session = getSessions().find(s => s.id === sessionId);
    if (session) {
      pendingQuickPrompt = session.prompt || session.title;
      resumingSessionId = session.id;
      transitionToChat();
    }
  });
}

// ---------- Preview Panel ----------
const PHASE_NAMES = ['discover', 'design', 'generate', 'review', 'handoff', 'deploy'];
const PREVIEW_TITLES = {
  discover: 'Architecture Preview',
  design: 'Architecture Preview',
  generate: 'Generated Files',
  review: 'Deployment Plan',
  handoff: 'Project Handoff',
  deploy: 'Deployment Status',
};

function updatePreviewTitle(phase) {
  const titleEl = document.getElementById('preview-panel-title');
  if (titleEl) titleEl.textContent = PREVIEW_TITLES[phase] || 'Preview';
}

function showPreviewContent(a2uiComponent) {
  const body = document.getElementById('preview-panel-body');
  const panel = document.getElementById('file-viewer');
  if (!body || !panel) return;

  const el = renderA2UI(a2uiComponent, {});
  body.innerHTML = '';
  body.appendChild(el);
  body.classList.remove('hidden');
  panel.classList.remove('hidden');
}

// ---------- Chat UI (primary experience) ----------
const chatUI = createChatUI({
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
});

// Mount chat UI into main area (hidden initially; landing page is shown first)
const chatMain = document.getElementById('chat-main');
chatMain?.appendChild(chatUI.element);
chatUI.element.style.display = 'none';

// ---------- File Viewer ----------
const fileViewer = createFileViewer();
document.getElementById('file-viewer')?.appendChild(fileViewer.element);

EventBus.on('fileViewer:close', () => {
  document.getElementById('file-viewer')?.classList.add('hidden');
});

// Preview panel close
document.getElementById('preview-panel-close')?.addEventListener('click', () => {
  document.getElementById('file-viewer')?.classList.add('hidden');
});

EventBus.on('files:generated', ({ files }) => {
  if (files && files.length > 0) {
    fileViewer.setFiles(files);
    document.getElementById('file-viewer')?.classList.remove('hidden');
  }
});

// File chip click delegation — opens preview panel and highlights file
chatUI.element.addEventListener('click', (e) => {
  const chip = e.target.closest('.file-chip');
  if (!chip) return;
  const filename = chip.dataset.filename;
  const panel = document.getElementById('file-viewer');
  if (panel) {
    panel.classList.remove('hidden');
    // Find and click the matching file tab
    const tabs = panel.querySelectorAll('.file-tab');
    tabs.forEach(t => {
      if (t.textContent.trim() === filename) t.click();
    });
  }
});

// A2UI button event delegation — catches clicks on buttons rendered via innerHTML
chatUI.element.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-a2ui-action]');
  if (!btn) return;
  const action = btn.dataset.a2uiAction;
  let data = {};
  try { data = JSON.parse(btn.dataset.a2uiData || '{}'); } catch { /* ignore */ }

  if (action === 'reply' && data.text) {
    handleUserMessage(data.text);
  } else {
    EventBus.emit('chat:action', { action, data });
  }
});

// ---------- Sessions Sidebar Toggle ----------
document.getElementById('topbar-sessions-toggle')?.addEventListener('click', () => {
  const sidebar = document.getElementById('sessions-sidebar');
  sidebar?.classList.toggle('hidden');
});

document.getElementById('sessions-close-btn')?.addEventListener('click', () => {
  document.getElementById('sessions-sidebar')?.classList.add('hidden');
});

// ==================== Inspiration Carousel ====================

async function fetchInspirations() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000);
  try {
    const res = await fetch('/api/inspirations', { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data)) return null;
    return data;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

// ---------- Placeholder Rotation ----------
function initPlaceholderRotation() {
  const placeholderEl = document.querySelector('.hero-input-placeholder');
  const heroInput = document.getElementById('hero-input');
  if (!placeholderEl || !heroInput) return;

  // Show first idea
  carouselIndex = 0;
  placeholderEl.textContent = INSPIRATION_IDEAS[0].title;
  placeholderEl.classList.add('visible');

  // Hide placeholder when input has focus or text
  heroInput.addEventListener('focus', () => {
    if (!heroInput.value) placeholderEl.classList.add('dimmed');
  });
  heroInput.addEventListener('blur', () => {
    if (!heroInput.value) placeholderEl.classList.remove('dimmed');
  });
  heroInput.addEventListener('input', () => {
    if (heroInput.value) {
      placeholderEl.classList.remove('visible');
    } else {
      placeholderEl.classList.add('visible');
      placeholderEl.classList.remove('dimmed');
    }
  });

  // Rotate every 4 seconds
  carouselTimer = setInterval(() => {
    placeholderEl.classList.remove('visible');
    setTimeout(() => {
      carouselIndex = (carouselIndex + 1) % INSPIRATION_IDEAS.length;
      placeholderEl.textContent = INSPIRATION_IDEAS[carouselIndex].title;
      placeholderEl.classList.add('visible');
    }, 300); // brief fade-out before new text
  }, 4000);
}

function stopPlaceholderRotation() {
  if (carouselTimer) {
    clearInterval(carouselTimer);
    carouselTimer = null;
  }
}

// ==================== Landing Page ====================

function initLandingListeners() {
  // Hero input — Enter key starts chat
  const heroInput = document.getElementById('hero-input');
  if (heroInput) {
    heroInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const text = heroInput.value?.trim();
        if (text) {
          pendingQuickPrompt = text;
        } else {
          // Use current rotating placeholder idea
          const idea = INSPIRATION_IDEAS[carouselIndex];
          if (idea?.prompt) {
            pendingQuickPrompt = idea.prompt;
          }
        }
        transitionToChat();
      }
    });
  }

  // Send button
  const sendBtn = document.getElementById('hero-send-btn');
  if (sendBtn) {
    sendBtn.addEventListener('click', () => {
      const text = heroInput?.value?.trim();
      if (text) {
        pendingQuickPrompt = text;
      } else {
        // Use current rotating placeholder idea
        const idea = INSPIRATION_IDEAS[carouselIndex];
        if (idea?.prompt) {
          pendingQuickPrompt = idea.prompt;
        }
      }
      transitionToChat();
    });
  }

  // Framework pills
  document.querySelectorAll('.framework-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      pendingQuickPrompt = `I want to build an app using ${pill.textContent}`;
      transitionToChat();
    });
  });

  // Track card links
  document.querySelectorAll('.track-card-link').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedTrack = btn.dataset.track;
      pendingQuickPrompt = selectedTrack === 'agentic-app'
        ? 'I want to build an AI agent and deploy it to Azure'
        : 'I want to build a web app or API and deploy it to Azure';
      transitionToChat();
    });
  });
}

async function transitionToChat() {
  // Save to recent sessions (skip if resuming an existing session)
  if (pendingQuickPrompt && !resumingSessionId) {
    saveSession({
      id: 'session-' + Date.now(),
      title: pendingQuickPrompt.substring(0, 100),
      prompt: pendingQuickPrompt,
    });
  }
  // If resuming, update the session's timestamp
  if (resumingSessionId) {
    saveSession({ id: resumingSessionId });
    resumingSessionId = null;
  }

  stopPlaceholderRotation();

  const landingEl = document.getElementById('landing-page');
  if (landingEl) {
    landingEl.classList.add('hiding');
    await new Promise(r => setTimeout(r, 200));
    landingEl.classList.remove('hiding');
    landingEl.style.display = 'none';
  }

  // Remove landing body class, show chat
  document.body.classList.remove('on-landing');
  chatUI.element.style.display = '';

  // Init engine with selections
  await initEngine();

  // Send welcome message
  const welcomeA2UI = engine.getWelcome();
  const html = renderA2UIMessage(welcomeA2UI);
  chatUI.addMessage({ role: 'assistant', html });

  // If a suggestion pill or track card was clicked, auto-send its prompt
  if (pendingQuickPrompt) {
    const prompt = pendingQuickPrompt;
    pendingQuickPrompt = null;
    chatUI.addMessage({ role: 'user', text: prompt });
    setTimeout(() => handleUserMessage(prompt), 300);
  }
}

function returnToLanding() {
  // Hide chat UI
  if (chatUI && chatUI.element) {
    chatUI.element.style.display = 'none';
  }

  // Show landing page
  const landingEl = document.getElementById('landing-page');
  if (landingEl) {
    landingEl.style.display = '';
  }

  // Add back landing body class
  document.body.classList.add('on-landing');

  // Clear hero input
  const heroInput = document.getElementById('hero-input');
  if (heroInput) {
    heroInput.value = '';
  }

  // Re-render recent sessions
  renderRecentSessions();

  // Restart placeholder rotation
  initPlaceholderRotation();
}

// ---------- Engine Setup ----------
async function initEngine() {
  apiClient = createApiClient();

  // On known deployment hosts the API always exists — skip healthCheck.
  // healthCheck fails because OPTIONS (CORS preflight) never sends cookies,
  // so SWA returns 401/redirect even for authenticated users.
  const knownHosts = ['kickstart.aks.azure.sabbour.me', 'kickstart.aks.azure.com'];
  const apiAvailable = knownHosts.includes(window.location.hostname)
    || await apiClient.healthCheck();

  if (apiAvailable) {
    isApiMode = true;
    engine = createEngine({
      apiClient,
      track: selectedTrack,
      preSelectedFramework: selectedFramework,
      onPhaseChange(phaseIndex) {
        chatUI.setPhase(phaseIndex);
        updatePreviewTitle(PHASE_NAMES[phaseIndex]);
      },
      onResponse({ a2ui, text, systemPrompt, model }) {
        chatUI.setTyping(false);
        clearStreamingBubble();

        // Always show text if present (streaming accumulated the text, now finalize it)
        if (text) {
          chatUI.addMessage({ role: 'assistant', text, model });
        }

        if (a2ui) {
          // Filter out ConversationPhase — it's shown in the phase bar, not inline
          const components = Array.isArray(a2ui) ? a2ui : [a2ui];
          const nonPhaseComponents = components.filter(c => c.type !== 'ConversationPhase');

          if (nonPhaseComponents.length > 0) {
            const html = renderA2UIMessage(nonPhaseComponents);
            chatUI.addMessage({ role: 'assistant', html });
          }

          // Show ArchitectureDiagram in preview panel
          const diagram = components.find(c => c.type === 'ArchitectureDiagram');
          if (diagram) showPreviewContent(diagram);
        }

        if (promptInspectorOn && systemPrompt) {
          const promptHtml = renderPromptInspector(systemPrompt);
          chatUI.addMessage({ role: 'assistant', html: promptHtml });
        }
      },
      onError({ message, retryable }) {
        chatUI.setTyping(false);
        clearStreamingBubble();
        showErrorBubble(message, retryable);
      },
      onStreaming(partialText) {
        updateStreamingBubble(partialText);
      },
    });
  } else {
    isApiMode = false;
    engine = createEngine({
      track: selectedTrack,
      preSelectedFramework: selectedFramework,
      onPhaseChange(phaseIndex) {
        chatUI.setPhase(phaseIndex);
        updatePreviewTitle(PHASE_NAMES[phaseIndex]);
      },
      onResponse({ a2ui, text, systemPrompt, files }) {
        chatUI.setTyping(false);
        if (a2ui) {
          const html = renderA2UIMessage(a2ui);
          chatUI.addMessage({ role: 'assistant', html });
          // Show ArchitectureDiagram in preview panel
          const components = Array.isArray(a2ui) ? a2ui : [a2ui];
          const diagram = components.find(c => c.type === 'ArchitectureDiagram');
          if (diagram) showPreviewContent(diagram);
        } else if (text) {
          chatUI.addMessage({ role: 'assistant', text });
        }

        if (files && files.length > 0) {
          EventBus.emit('files:generated', { files });
        }

        if (promptInspectorOn && systemPrompt) {
          const promptHtml = renderPromptInspector(systemPrompt);
          chatUI.addMessage({ role: 'assistant', html: promptHtml });
        }
      },
    });

    showDemoBadge();
  }
}

// ---------- Demo Mode Badge ----------
function showDemoBadge() {
  const phase = document.querySelector('.chat-phase');
  if (!phase || phase.querySelector('.demo-badge')) return;

  const badge = document.createElement('span');
  badge.className = 'demo-badge';
  badge.textContent = 'Demo';
  badge.title = 'Running without API backend — using scripted demo responses';
  phase.appendChild(badge);
}

// ---------- Streaming bubble ----------
let streamingBubbleEl = null;
let lastRetryMessage = null;

function updateStreamingBubble(text) {
  chatUI.setTyping(false);
  const container = document.querySelector('#chat-messages-inner');
  if (!container) return;

  // Strip any partial ~~~a2ui block from display
  const a2uiIdx = text.indexOf('~~~a2ui');
  const displayText = a2uiIdx >= 0 ? text.substring(0, a2uiIdx).trimEnd() : text;
  // Also strip trailing tildes that might be the start of a marker
  const cleanText = displayText.replace(/~+$/, '');

  if (!streamingBubbleEl) {
    streamingBubbleEl = document.createElement('div');
    streamingBubbleEl.className = 'chat-bubble assistant streaming';
    streamingBubbleEl.setAttribute('role', 'article');

    const textSpan = document.createElement('span');
    textSpan.className = 'streaming-text';
    streamingBubbleEl.appendChild(textSpan);

    const cursor = document.createElement('span');
    cursor.className = 'streaming-cursor';
    streamingBubbleEl.appendChild(cursor);

    container.appendChild(streamingBubbleEl);
  }

  // Use textContent — avoids DOM thrashing from innerHTML/renderMarkdown
  const textSpan = streamingBubbleEl.querySelector('.streaming-text');
  if (textSpan) textSpan.textContent = cleanText;
  chatUI.scrollToBottom();
}

function clearStreamingBubble() {
  if (streamingBubbleEl) {
    streamingBubbleEl.remove();
    streamingBubbleEl = null;
  }
}

// ---------- Error bubble ----------
function showErrorBubble(message, retryable) {
  const container = document.querySelector('#chat-messages-inner');
  if (!container) return;

  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble assistant error-bubble';
  bubble.setAttribute('role', 'alert');

  const msgEl = document.createElement('span');
  msgEl.className = 'error-bubble-text';
  msgEl.textContent = message;
  bubble.appendChild(msgEl);

  if (retryable) {
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
  chatUI.scrollToBottom();
}

function handleUserMessage(text) {
  lastRetryMessage = text;
  chatUI.setTyping(true, engine?.getCurrentPhase());

  if (isApiMode) {
    engine.handleMessage(text);
  } else {
    setTimeout(() => {
      engine.handleMessage(text);
    }, 800);
  }
}

function renderA2UIMessage(a2uiJson) {
  const el = renderA2UI(a2uiJson, {
    onAction(action, data) {
      EventBus.emit('chat:action', { action, data });
    },
    onDataChange(name, value) {
      EventBus.emit('chat:dataChange', { name, value });
    },
  });
  return el.outerHTML;
}

/** Render an expandable system prompt inspector block. */
function renderPromptInspector(systemPrompt) {
  const promptA2UI = [
    {
      type: 'Text',
      text: '<details class="prompt-inspector"><summary><svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" style="vertical-align:-2px;margin-right:4px"><path d="M5.854 3.354a.5.5 0 10-.708-.708l-4 4a.5.5 0 000 .708l4 4a.5.5 0 00.708-.708L2.207 8l3.647-3.646zm4.292-.708a.5.5 0 01.708 0l4 4a.5.5 0 010 .708l-4 4a.5.5 0 01-.708-.708L13.793 8l-3.647-3.646a.5.5 0 010-.708z"/></svg> View system prompt for this phase</summary></details>',
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
  await updateAuthUI();
}

async function updateAuthUI() {
  const userBtn = document.getElementById('topbar-user');
  if (!userBtn) return;

  if (Auth.isAuthenticated()) {
    const info = Auth.getUserInfo();
    const initials = info.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
    userBtn.innerHTML = `
      <span class="topbar-avatar-initials">${escapeHtml(initials)}</span>
      <span class="topbar-user-name">${escapeHtml(info.name)}</span>`;
    userBtn.onclick = () => Auth.logout();
    userBtn.title = `Signed in as ${info.email} — click to sign out`;
  } else {
    userBtn.innerHTML = `
      <img src="assets/icons/commands/avatar-default.svg" width="28" height="28" alt="" style="border-radius:50%">
      <span>Sign in</span>`;
    userBtn.onclick = () => Auth.login();
    userBtn.title = 'Sign in with your Microsoft account';
  }
}

// ---------- Boot ----------
async function boot() {
  await initAuth();

  // Handle /login path — redirect to SWA login
  if (window.location.pathname === '/login') {
    if (!Auth.isAuthenticated()) {
      Auth.login(); // redirects to /.auth/login/aad, then back to /
      return;
    }
    window.history.replaceState({}, '', '/');
  }

  // Landing page is shown by default (via HTML).
  initLandingListeners();

  // New session button
  const newSessionBtn = document.getElementById('sessions-new-btn');
  if (newSessionBtn) {
    newSessionBtn.addEventListener('click', returnToLanding);
  }

  // Render placeholder rotation immediately with hardcoded ideas
  initPlaceholderRotation();

  // Render recent sessions
  renderRecentSessions();
  initRecentSessionsListener();

  // Footer version info
  const footerVersion = document.getElementById('landing-footer-version');
  if (footerVersion) {
    const sha = window.__BUILD_SHA__ || 'local';
    const raw = window.__BUILD_DATE__;
    const date = typeof raw === 'string' && raw.includes('T')
      ? new Date(raw).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
      : (raw || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }));
    footerVersion.textContent = `build ${sha} · ${date}`;
  }
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
