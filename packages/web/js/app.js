/**
 * App — Chat-first UI initialization
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

// Mount chat UI into main area
document.getElementById('chat-main')?.appendChild(chatUI.element);

// ---------- File Viewer ----------
const fileViewer = createFileViewer();
document.getElementById('file-viewer')?.appendChild(fileViewer.element);

EventBus.on('fileViewer:close', () => {
  document.getElementById('file-viewer')?.classList.add('hidden');
});

// Show file viewer when files are emitted
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

// ---------- Engine Setup ----------
async function initEngine() {
  apiClient = createApiClient();
  const apiAvailable = await apiClient.healthCheck();

  if (apiAvailable) {
    isApiMode = true;
    engine = createEngine({
      apiClient,
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

        // If files were generated, show in file viewer
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
  await initEngine();

  // Send welcome message immediately — chat starts on page load
  const welcomeA2UI = engine.getWelcome();
  const html = renderA2UIMessage(welcomeA2UI);
  chatUI.addMessage({ role: 'assistant', html });
}

// Run on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
