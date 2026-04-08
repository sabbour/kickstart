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

// ---------- Sessions Sidebar Toggle ----------
document.getElementById('topbar-sessions-toggle')?.addEventListener('click', () => {
  const sidebar = document.getElementById('sessions-sidebar');
  sidebar?.classList.toggle('hidden');
});

document.getElementById('sessions-close-btn')?.addEventListener('click', () => {
  document.getElementById('sessions-sidebar')?.classList.add('hidden');
});

// ---------- Prompt Inspector Toggle ----------
document.getElementById('topbar-inspector-toggle')?.addEventListener('click', () => {
  promptInspectorOn = !promptInspectorOn;
  const btn = document.getElementById('topbar-inspector-toggle');
  btn?.classList.toggle('active', promptInspectorOn);
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

function updateCarouselIdeas(ideas) {
  INSPIRATION_IDEAS = ideas;
  const viewport = document.getElementById('carousel-viewport');
  const dotsContainer = document.getElementById('carousel-dots');
  if (!viewport || !dotsContainer) return;

  const newIndex = carouselIndex < ideas.length ? carouselIndex : 0;

  viewport.innerHTML = ideas.map((idea, i) => `
    <div class="carousel-slide ${i === newIndex ? 'active' : ''}" data-slide="${i}">
      <div class="carousel-title">${escapeHtml(idea.title)}</div>
      <div class="carousel-subtitle">${escapeHtml(idea.subtitle)}</div>
    </div>
  `).join('');

  dotsContainer.innerHTML = ideas.map((_, i) => `
    <button class="carousel-dot ${i === newIndex ? 'active' : ''}" data-dot="${i}" aria-label="Idea ${i + 1}"></button>
  `).join('');

  carouselIndex = newIndex;
  resetCarouselTimer();
}

function initCarousel() {
  const viewport = document.getElementById('carousel-viewport');
  const dotsContainer = document.getElementById('carousel-dots');
  if (!viewport || !dotsContainer) return;

  viewport.innerHTML = INSPIRATION_IDEAS.map((idea, i) => `
    <div class="carousel-slide ${i === 0 ? 'active' : ''}" data-slide="${i}">
      <div class="carousel-title">${escapeHtml(idea.title)}</div>
      <div class="carousel-subtitle">${escapeHtml(idea.subtitle)}</div>
    </div>
  `).join('');

  dotsContainer.innerHTML = INSPIRATION_IDEAS.map((_, i) => `
    <button class="carousel-dot ${i === 0 ? 'active' : ''}" data-dot="${i}" aria-label="Idea ${i + 1}"></button>
  `).join('');

  dotsContainer.addEventListener('click', (e) => {
    const dot = e.target.closest('.carousel-dot');
    if (!dot) return;
    goToSlide(parseInt(dot.dataset.dot, 10));
    resetCarouselTimer();
  });

  viewport.addEventListener('click', (e) => {
    const slide = e.target.closest('.carousel-slide');
    if (!slide) return;
    const idx = parseInt(slide.dataset.slide, 10);
    const idea = INSPIRATION_IDEAS[idx];
    if (idea?.prompt) {
      pendingQuickPrompt = idea.prompt;
      transitionToChat();
    }
  });

  resetCarouselTimer();
}

function goToSlide(newIndex) {
  const viewport = document.getElementById('carousel-viewport');
  const dotsContainer = document.getElementById('carousel-dots');
  if (!viewport) return;

  const slides = viewport.querySelectorAll('.carousel-slide');
  const dots = dotsContainer?.querySelectorAll('.carousel-dot');

  if (newIndex === carouselIndex) return;

  slides[carouselIndex]?.classList.remove('active');
  dots?.[carouselIndex]?.classList.remove('active');
  carouselIndex = newIndex;
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

// ==================== Landing Page ====================

function initLandingListeners() {
  // Hero input — Enter key starts chat (fluent-search fires keydown on its host)
  const heroInput = document.getElementById('hero-input');
  if (heroInput) {
    heroInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const text = heroInput.value?.trim();
        if (text) {
          pendingQuickPrompt = text;
          transitionToChat();
        }
      }
    });
  }

  // Suggestion pills
  document.querySelectorAll('.suggestion-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      pendingQuickPrompt = pill.dataset.suggestion;
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

  // If a suggestion pill or track card was clicked, auto-send its prompt
  if (pendingQuickPrompt) {
    const prompt = pendingQuickPrompt;
    pendingQuickPrompt = null;
    chatUI.addMessage({ role: 'user', text: prompt });
    setTimeout(() => handleUserMessage(prompt), 300);
  }
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
        updatePreviewTitle(PHASE_NAMES[phaseIndex]);
      },
      onResponse({ a2ui, text, systemPrompt }) {
        chatUI.setTyping(false);
        clearStreamingBubble();

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

  if (!streamingBubbleEl) {
    streamingBubbleEl = document.createElement('div');
    streamingBubbleEl.className = 'chat-bubble assistant streaming';
    streamingBubbleEl.setAttribute('role', 'article');
    container.appendChild(streamingBubbleEl);
  }

  streamingBubbleEl.innerHTML = renderMarkdown(text);
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

async function fetchUserPhoto() {
  try {
    const token = await Auth.getToken(['User.Read']);
    if (!token) return null;
    const response = await fetch('https://graph.microsoft.com/v1.0/me/photo/$value', {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!response.ok) return null;
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

async function updateAuthUI() {
  const userBtn = document.getElementById('topbar-user');
  if (!userBtn) return;

  if (Auth.isAuthenticated()) {
    const info = Auth.getUserInfo();
    userBtn.innerHTML = `
      <fluent-avatar name="${escapeHtml(info.name)}" size="28" color="colorful"></fluent-avatar>
      <span class="topbar-user-name">${escapeHtml(info.name)}</span>`;
    userBtn.onclick = () => Auth.logout().then(updateAuthUI);
    userBtn.title = `Signed in as ${info.email} — click to sign out`;

    // Fetch photo in background, update avatar when ready
    const photoUrl = await fetchUserPhoto();
    if (photoUrl) {
      const avatar = userBtn.querySelector('fluent-avatar');
      if (avatar) avatar.setAttribute('src', photoUrl);
    }
  } else {
    userBtn.innerHTML = `
      <fluent-avatar name="?" size="28"></fluent-avatar>
      <span>Sign in</span>`;
    userBtn.onclick = () => Auth.login().then(updateAuthUI);
    userBtn.title = 'Sign in with your Microsoft account';
  }
}

// ---------- Boot ----------
async function boot() {
  await initAuth();

  // Handle /login path — auto-trigger client-side sign-in
  if (window.location.pathname === '/login') {
    if (!Auth.isAuthenticated()) {
      Auth.login().then(() => {
        window.history.replaceState({}, '', '/');
        updateAuthUI();
      });
    } else {
      window.history.replaceState({}, '', '/');
    }
  }

  // Landing page is shown by default (via HTML).
  initLandingListeners();

  // Render carousel immediately with hardcoded ideas, then try API.
  initCarousel();
  fetchInspirations().then(ideas => {
    if (ideas) updateCarouselIdeas(ideas);
  });
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
