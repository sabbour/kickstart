/**
 * App — Chat-first UI initialization with landing page
 * @module app
 */

import { EventBus } from './framework/core.js';
import { createChatUI, createFileViewer, createCodeBlock, escapeHtml } from './framework/components.js';
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

// ---------- Prompt Inspector ----------
let promptInspectorOn = false;

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

EventBus.on('files:generated', ({ files }) => {
  if (files && files.length > 0) {
    fileViewer.setFiles(files);
    document.getElementById('file-viewer')?.classList.remove('hidden');
  }
});

// ---------- Sessions Sidebar Toggle ----------
document.getElementById('topbar-sessions-toggle')?.addEventListener('click', () => {
  const sidebar = document.getElementById('sessions-sidebar');
  sidebar?.classList.toggle('hidden');
});

// ---------- Prompt Inspector Toggle ----------
document.getElementById('topbar-inspector-toggle')?.addEventListener('click', () => {
  promptInspectorOn = !promptInspectorOn;
  const btn = document.getElementById('topbar-inspector-toggle');
  btn?.classList.toggle('active', promptInspectorOn);
});

// ==================== Landing Page ====================

const INSPIRATION_IDEAS = [
  { title: 'Movie night pick that settles disputes', subtitle: 'Your group votes, and the app chooses confidently.' },
  { title: 'AI recipe finder from fridge photos', subtitle: 'Snap a photo of your fridge, get dinner ideas instantly.' },
  { title: 'Team standup bot that respects time zones', subtitle: 'Async standups that actually work for global teams.' },
  { title: 'Pet adoption matcher powered by AI', subtitle: 'Swipe-style matching between shelters and families.' },
  { title: 'Real-time air quality dashboard', subtitle: 'Hyperlocal pollution data with health recommendations.' },
  { title: 'Neighborhood tool lending library', subtitle: 'Borrow a drill from your neighbor — no awkward texts required.' },
  { title: 'Personal finance coach that speaks plain English', subtitle: 'Budget tracking without the spreadsheet headaches.' },
  { title: 'Workout generator for hotel rooms', subtitle: 'No equipment? No problem. AI builds a routine in seconds.' },
  { title: 'Live event parking optimizer', subtitle: 'Find the fastest lot and walking route to the venue.' },
  { title: 'Study group matchmaker for college', subtitle: 'Match with classmates by course, schedule, and study style.' },
];

let carouselIndex = 0;
let carouselTimer = null;

function initCarousel() {
  const viewport = document.getElementById('carousel-viewport');
  const dotsContainer = document.getElementById('carousel-dots');
  if (!viewport || !dotsContainer) return;

  // Build slides
  viewport.innerHTML = INSPIRATION_IDEAS.map((idea, i) => `
    <div class="carousel-slide ${i === 0 ? 'active' : ''}" data-slide="${i}">
      <div class="carousel-title">${escapeHtml(idea.title)}</div>
      <div class="carousel-subtitle">${escapeHtml(idea.subtitle)}</div>
    </div>
  `).join('');

  // Build dots
  dotsContainer.innerHTML = INSPIRATION_IDEAS.map((_, i) => `
    <button class="carousel-dot ${i === 0 ? 'active' : ''}" data-dot="${i}" aria-label="Idea ${i + 1}"></button>
  `).join('');

  // Dot clicks
  dotsContainer.addEventListener('click', (e) => {
    const dot = e.target.closest('.carousel-dot');
    if (!dot) return;
    goToSlide(parseInt(dot.dataset.dot, 10));
    resetCarouselTimer();
  });

  // Start auto-rotation
  resetCarouselTimer();
}

function goToSlide(newIndex) {
  const viewport = document.getElementById('carousel-viewport');
  const dotsContainer = document.getElementById('carousel-dots');
  if (!viewport) return;

  const slides = viewport.querySelectorAll('.carousel-slide');
  const dots = dotsContainer?.querySelectorAll('.carousel-dot');

  if (newIndex === carouselIndex) return;

  // Remove active from old
  slides[carouselIndex]?.classList.remove('active');
  slides[carouselIndex]?.classList.add('exit-left');
  dots?.[carouselIndex]?.classList.remove('active');

  // Clean up exit class after transition
  const oldIdx = carouselIndex;
  setTimeout(() => slides[oldIdx]?.classList.remove('exit-left'), 400);

  carouselIndex = newIndex;

  // Set active on new
  slides[carouselIndex]?.classList.add('active');
  dots?.[carouselIndex]?.classList.add('active');
}

function nextSlide() {
  goToSlide((carouselIndex + 1) % INSPIRATION_IDEAS.length);
}

function resetCarouselTimer() {
  if (carouselTimer) clearInterval(carouselTimer);
  carouselTimer = setInterval(nextSlide, 5000);
}

function stopCarousel() {
  if (carouselTimer) {
    clearInterval(carouselTimer);
    carouselTimer = null;
  }
}

function initLandingListeners() {
  // Track card links
  document.querySelectorAll('.track-card-link').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedTrack = btn.dataset.track;
      transitionToChat();
    });
  });

  // Framework pills
  document.querySelectorAll('.framework-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      selectedFramework = pill.dataset.framework;
      // Auto-detect track from framework
      const agenticFrameworks = ['LangChain Agent', 'RAG App'];
      selectedTrack = agenticFrameworks.includes(selectedFramework) ? 'agentic-app' : 'web-app';
      transitionToChat();
    });
  });
}

async function transitionToChat() {
  stopCarousel();

  const landingEl = document.getElementById('landing-page');
  if (landingEl) {
    landingEl.classList.add('hiding');
    await new Promise(r => setTimeout(r, 200));
    landingEl.remove();
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
}

// ---------- Engine Setup ----------
async function initEngine() {
  apiClient = createApiClient();
  const apiAvailable = await apiClient.healthCheck();

  if (apiAvailable) {
    isApiMode = true;
    engine = createEngine({
      apiClient,
      track: selectedTrack,
      preSelectedFramework: selectedFramework,
      onPhaseChange(phaseIndex) {
        chatUI.setPhase(phaseIndex);
      },
      onResponse({ a2ui, text, systemPrompt }) {
        chatUI.setTyping(false);
        clearStreamingBubble();

        if (a2ui) {
          const html = renderA2UIMessage(a2ui);
          chatUI.addMessage({ role: 'assistant', html });
        } else if (text) {
          chatUI.addMessage({ role: 'assistant', text });
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
      },
      onResponse({ a2ui, text, systemPrompt, files }) {
        chatUI.setTyping(false);
        if (a2ui) {
          const html = renderA2UIMessage(a2ui);
          chatUI.addMessage({ role: 'assistant', html });
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

  if (!streamingBubbleEl) {
    streamingBubbleEl = document.createElement('div');
    streamingBubbleEl.className = 'chat-bubble assistant streaming';
    streamingBubbleEl.setAttribute('role', 'article');
    container.appendChild(streamingBubbleEl);
  }

  streamingBubbleEl.textContent = text;
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
  chatUI.setTyping(true);

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

// ---------- Boot ----------
async function boot() {
  await initAuth();

  // Landing page is shown by default (via HTML).
  // Initialize carousel and landing listeners.
  initCarousel();
  initLandingListeners();
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
