/**
 * Component factories — Chat UI, file viewer, cards, code blocks
 * @module components
 */

import { EventBus } from './core.js';

// Phase-aware status text for the sparkle loading animation
const PHASE_STATUS_TEXT = {
  discover: 'Understanding your app...',
  design: 'Designing architecture...',
  generate: 'Generating files...',
  review: 'Reviewing deployment plan...',
  handoff: 'Preparing handoff...',
  deploy: 'Deploying to AKS...',
};

// ---------- Chat UI (main experience) ----------
export function createChatUI(config = {}) {
  const container = document.createElement('div');
  container.className = 'chat-container';
  container.id = 'chat-ui';

  let messages = [];
  let isTyping = false;
  let currentTypingPhase = null;
  let onSend = config.onSend ?? (() => {});

  const phases = config.phases ?? [
    { id: 'discover', label: 'Discover' },
    { id: 'design', label: 'Design' },
    { id: 'generate', label: 'Generate' },
    { id: 'review', label: 'Review' },
    { id: 'handoff', label: 'Handoff' },
    { id: 'deploy', label: 'Deploy' },
  ];
  let currentPhase = 0;

  function render() {
    container.innerHTML = `
      <nav class="chat-phase" aria-label="Conversation progress">
        ${renderPhases()}
      </nav>
      <div class="chat-messages" role="log" aria-live="polite" aria-label="Chat messages">
        <div class="chat-messages-inner" id="chat-messages-inner">
          ${renderMessages()}
        </div>
      </div>
      <div class="chat-input-area">
        <div class="chat-input-inner">
          <textarea class="chat-textarea" placeholder="Tell Kickstart about your app…"
                    rows="1" aria-label="Message input"></textarea>
          <button class="chat-send-btn" aria-label="Send message" title="Send">
            <img src="assets/icons/commands/go.svg" width="16" height="16" alt="">
          </button>
        </div>
      </div>`;

    bindEvents();
    scrollToBottom();
  }

  function renderPhases() {
    return phases.map((phase, i) => {
      const status = i < currentPhase ? 'completed' : i === currentPhase ? 'active' : '';
      const connector = i < phases.length - 1
        ? `<span class="chat-phase-connector ${i < currentPhase ? 'completed' : ''}"></span>`
        : '';
      return `
        <span class="chat-phase-step">
          <span class="chat-phase-dot ${status}" aria-hidden="true"></span>
          <span>${phase.label}</span>
        </span>
        ${connector}`;
    }).join('');
  }

  function renderMessages() {
    let html = messages.map(msg => {
      const cls = msg.role === 'user' ? 'user' : 'assistant';
      let content;
      if (msg.html) {
        content = msg.html;
      } else if (cls === 'user') {
        content = escapeHtml(msg.text);
      } else {
        content = renderMarkdown(msg.text);
      }
      const modelTag = (cls === 'assistant' && msg.model)
        ? `<span class="model-indicator">${escapeHtml(msg.model)}</span>`
        : '';
      return `<div class="chat-bubble ${cls}" role="article">${content}${modelTag}</div>`;
    }).join('');

    if (isTyping) {
      const statusText = PHASE_STATUS_TEXT[currentTypingPhase] || 'Thinking...';
      html += `
        <div class="sparkle-loader" aria-label="${statusText}">
          <div class="sparkle-dots">
            <span class="sparkle-dot"></span>
            <span class="sparkle-dot"></span>
            <span class="sparkle-dot"></span>
          </div>
          <span class="sparkle-text">${statusText}</span>
        </div>`;
    }
    return html;
  }

  function bindEvents() {
    const textarea = container.querySelector('.chat-textarea');
    const sendBtn = container.querySelector('.chat-send-btn');

    textarea?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });

    textarea?.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 160) + 'px';
    });

    sendBtn?.addEventListener('click', send);
  }

  function send() {
    const textarea = container.querySelector('.chat-textarea');
    const text = textarea?.value.trim();
    if (!text) return;

    addMessage({ role: 'user', text });
    textarea.value = '';
    textarea.style.height = 'auto';
    onSend(text);
  }

  function addMessage(msg) {
    messages.push(msg);
    refreshMessages();
  }

  function refreshMessages() {
    const inner = container.querySelector('#chat-messages-inner');
    if (inner) {
      inner.innerHTML = renderMessages();
      scrollToBottom();
    }
  }

  function scrollToBottom() {
    const scrollArea = container.querySelector('.chat-messages');
    if (scrollArea) {
      requestAnimationFrame(() => {
        scrollArea.scrollTop = scrollArea.scrollHeight;
      });
    }
  }

  function setTyping(val, phase) {
    isTyping = val;
    currentTypingPhase = phase || null;
    refreshMessages();
  }

  function setPhase(index) {
    currentPhase = index;
    const phaseEl = container.querySelector('.chat-phase');
    if (phaseEl) phaseEl.innerHTML = renderPhases();
  }

  render();

  return Object.freeze({
    element: container,
    addMessage,
    setTyping,
    setPhase,
    scrollToBottom,
  });
}

// ---------- File Viewer ----------
export function createFileViewer() {
  const viewer = document.createElement('div');
  viewer.className = 'file-viewer-container';

  let files = [];
  let activeIndex = 0;

  function render() {
    viewer.innerHTML = `
      <div class="file-viewer-header">
        <span class="file-viewer-title"><svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style="vertical-align:-2px;margin-right:4px"><path d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V8a2 2 0 00-2-2h-5.586a1 1 0 01-.707-.293L8.293 4.293A1 1 0 007.586 4H4z"/></svg> Generated Files</span>
        <button class="file-viewer-close" aria-label="Close file viewer" title="Close"><svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor"><path d="M4.09 4.22a.5.5 0 01.63-.06l.07.06L10 9.44l5.22-5.22a.5.5 0 01.63-.06l.07.06a.5.5 0 01.06.63l-.06.07L10.7 10.1l5.22 5.22a.5.5 0 01-.63.76l-.07-.06L10 10.8l-5.22 5.22a.5.5 0 01-.63.06l-.07-.06a.5.5 0 01-.06-.63l.06-.07 5.22-5.22-5.22-5.22a.5.5 0 01-.06-.63l.06-.07z"/></svg></button>
      </div>
      <div class="file-viewer-tabs" id="fv-tabs">
        ${renderTabs()}
      </div>
      <div class="file-viewer-content">
        <pre class="file-viewer-code" id="fv-code">${getActiveCode()}</pre>
      </div>
      <div class="file-viewer-actions">
        <button class="file-viewer-copy-btn" id="fv-copy">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
            <path d="M4 4V1h11v11h-3v3H1V4h3zm1 0h6v7h3V2H5v2zm-1 1H2v9h9V5H4z"/>
          </svg>
          Copy
        </button>
      </div>`;

    bindEvents();
  }

  function renderTabs() {
    return files.map((f, i) =>
      `<button class="file-tab ${i === activeIndex ? 'active' : ''}" data-idx="${i}">${escapeHtml(f.name)}</button>`
    ).join('');
  }

  function getActiveCode() {
    if (files.length === 0) return '';
    return escapeHtml(files[activeIndex]?.code ?? '');
  }

  function bindEvents() {
    viewer.querySelector('.file-viewer-close')?.addEventListener('click', () => {
      EventBus.emit('fileViewer:close');
    });

    viewer.querySelectorAll('.file-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        activeIndex = parseInt(tab.dataset.idx, 10);
        updateActiveTab();
      });
    });

    viewer.querySelector('#fv-copy')?.addEventListener('click', async () => {
      const code = files[activeIndex]?.code ?? '';
      try {
        await navigator.clipboard.writeText(code);
        const btn = viewer.querySelector('#fv-copy');
        const orig = btn.innerHTML;
        btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" style="vertical-align:-1px"><path d="M7.03 13.9L3.56 10.44a.75.75 0 00-1.06 1.06l4 4a.75.75 0 001.06 0l9-9a.75.75 0 00-1.06-1.06L7.03 13.9z"/></svg> Copied';
        setTimeout(() => { btn.innerHTML = orig; }, 2000);
      } catch { /* clipboard may not be available */ }
    });
  }

  function updateActiveTab() {
    viewer.querySelectorAll('.file-tab').forEach((tab, i) => {
      tab.classList.toggle('active', i === activeIndex);
    });
    const codeEl = viewer.querySelector('#fv-code');
    if (codeEl) codeEl.textContent = files[activeIndex]?.code ?? '';
  }

  function addFile(name, code) {
    const existing = files.findIndex(f => f.name === name);
    if (existing >= 0) {
      files[existing].code = code;
    } else {
      files.push({ name, code });
    }
    activeIndex = existing >= 0 ? existing : files.length - 1;
    render();
  }

  function setFiles(fileList) {
    files = fileList.map(f => ({ name: f.name, code: f.code }));
    activeIndex = 0;
    render();
  }

  render();

  return Object.freeze({
    element: viewer,
    addFile,
    setFiles,
    get fileCount() { return files.length; },
  });
}

// ---------- Card ----------
export function createCard(config) {
  const { title, subtitle, body, footer, className = '' } = config;
  const card = document.createElement('article');
  card.className = `card ${className}`.trim();

  let html = '';
  if (title || subtitle) {
    html += `<div class="card-header">
      <div>
        ${title ? `<h3 class="card-title">${title}</h3>` : ''}
        ${subtitle ? `<p class="card-subtitle">${subtitle}</p>` : ''}
      </div>
    </div>`;
  }
  if (body) {
    html += `<div class="card-body">${typeof body === 'string' ? body : ''}</div>`;
  }
  if (footer) {
    html += `<div class="card-footer">${footer}</div>`;
  }

  card.innerHTML = html;

  if (body instanceof HTMLElement) {
    card.querySelector('.card-body')?.appendChild(body);
  }

  return card;
}

// ---------- Status badge ----------
export function createStatusBadge(status, label) {
  const badge = document.createElement('span');
  badge.className = `status-badge ${status}`;
  badge.innerHTML = `<span class="status-badge-dot" aria-hidden="true"></span>${label ?? status}`;
  return badge;
}

// ---------- Code block ----------
export function createCodeBlock(code, language = '') {
  const block = document.createElement('div');
  block.className = 'code-block';
  block.innerHTML = `
    <div class="code-block-header">
      <span>${language}</span>
      <button class="code-block-copy" aria-label="Copy code">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 4V1h11v11h-3v3H1V4h3zm1 0h6v7h3V2H5v2zm-1 1H2v9h9V5H4z"/>
        </svg>
        Copy
      </button>
    </div>
    <pre><code>${escapeHtml(code)}</code></pre>`;

  block.querySelector('.code-block-copy')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(code);
      const btn = block.querySelector('.code-block-copy');
      const orig = btn.innerHTML;
      btn.innerHTML = '<svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor" style="vertical-align:-1px"><path d="M7.03 13.9L3.56 10.44a.75.75 0 00-1.06 1.06l4 4a.75.75 0 001.06 0l9-9a.75.75 0 00-1.06-1.06L7.03 13.9z"/></svg> Copied';
      setTimeout(() => { btn.innerHTML = orig; }, 2000);
    } catch { /* clipboard API may not be available */ }
  });

  return block;
}

// ---------- Markdown renderer (lightweight) ----------

/**
 * Convert a subset of Markdown to HTML for assistant messages.
 * Supports: bold, italic, inline code, code blocks, paragraphs,
 * unordered lists, links, and line breaks.
 */
export function renderMarkdown(text) {
  if (!text) return '';

  // Escape HTML entities
  let html = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  // Extract fenced code blocks into placeholders
  const codeBlocks = [];
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(`<pre><code>${code.trimEnd()}</code></pre>`);
    return `\n\n%%CODEBLOCK_${idx}%%\n\n`;
  });

  // Inline code (before bold/italic so backtick-wrapped text isn't altered)
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');

  // Bold (**text**)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Italic (*text*) — single asterisks that aren't part of bold
  html = html.replace(/\*([^\n*]+)\*/g, '<em>$1</em>');

  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // Split into blocks on double-newlines
  const blocks = html.split(/\n{2,}/);
  html = blocks.map(block => {
    block = block.trim();
    if (!block) return '';

    // Re-insert code block placeholders
    const cbMatch = block.match(/^%%CODEBLOCK_(\d+)%%$/);
    if (cbMatch) return codeBlocks[parseInt(cbMatch[1], 10)];

    // Unordered list (all lines start with - or * )
    const lines = block.split('\n');
    const allList = lines.length > 0 && lines.every(l => /^\s*[-*]\s/.test(l));
    if (allList) {
      const items = lines.map(l => `<li>${l.replace(/^\s*[-*]\s+/, '')}</li>`).join('');
      return `<ul>${items}</ul>`;
    }

    // Regular paragraph — single newlines become <br>
    return `<p>${block.replace(/\n/g, '<br>')}</p>`;
  }).filter(Boolean).join('\n');

  return html;
}

// ---------- File Chips ----------

/**
 * Render file generation chips as an HTML string.
 * Each chip shows file icon, name, and status indicator.
 */
export function renderFileChips(files) {
  if (!files || files.length === 0) return '';

  const fileIcon = '<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414a1 1 0 00-.293-.707l-3.414-3.414A1 1 0 0011.586 3H6zm5 1.5L14.5 7H12a1 1 0 01-1-1V3.5z"/></svg>';

  const statusHtml = (status) => {
    switch (status) {
      case 'done': return '<svg width="14" height="14" viewBox="0 0 20 20" fill="var(--color-success)"><path d="M7.03 13.9L3.56 10.44a.75.75 0 00-1.06 1.06l4 4a.75.75 0 001.06 0l9-9a.75.75 0 00-1.06-1.06L7.03 13.9z"/></svg>';
      case 'generating': return '<span class="file-chip-spinner"></span>';
      default: return '<span class="file-chip-pending"></span>';
    }
  };

  return `<div class="file-chips-row">${files.map(f =>
    `<button class="file-chip" data-filename="${escapeHtml(f.name)}">` +
    `<span class="file-chip-icon">${fileIcon}</span>` +
    `<span class="file-chip-name">${escapeHtml(f.name)}</span>` +
    `<span class="file-chip-status">${statusHtml(f.status)}</span>` +
    `</button>`
  ).join('')}</div>`;
}

// ---------- Helpers ----------
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export { escapeHtml };
