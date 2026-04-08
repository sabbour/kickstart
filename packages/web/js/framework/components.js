/**
 * Component factories — Copilot panel, wizard, cards, command bar, etc.
 * @module components
 */

import { EventBus } from './core.js';

// ---------- Copilot Panel ----------
export function createCopilotPanel(config = {}) {
  const panel = document.createElement('aside');
  panel.className = 'copilot-panel';
  panel.id = 'copilot-panel';
  panel.setAttribute('role', 'complementary');
  panel.setAttribute('aria-label', 'Kickstart Copilot');

  let messages = [];
  let isTyping = false;
  let promptInspectorEnabled = false;
  let onSend = config.onSend ?? (() => {});
  let onPromptInspectorToggle = config.onPromptInspectorToggle ?? (() => {});

  const phases = config.phases ?? [
    { id: 'understand', label: 'Understand' },
    { id: 'architect', label: 'Architect' },
    { id: 'configure', label: 'Configure' },
    { id: 'deploy', label: 'Deploy' },
  ];
  let currentPhase = 0;

  function render() {
    panel.innerHTML = `
      <header class="copilot-header">
        <div class="copilot-header-title">
          <span class="copilot-icon" aria-hidden="true">✦</span>
          <span>Kickstart Copilot</span>
        </div>
        <div class="copilot-header-actions">
          <button class="copilot-inspector-btn${promptInspectorEnabled ? ' active' : ''}"
                  aria-label="Toggle prompt inspector"
                  aria-pressed="${promptInspectorEnabled}"
                  title="${promptInspectorEnabled ? 'Hide prompts' : 'Show prompts'}">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a7 7 0 110 14A7 7 0 018 1zm0 1.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM8 4a.75.75 0 01.75.75v2.5h2.5a.75.75 0 010 1.5h-2.5v2.5a.75.75 0 01-1.5 0v-2.5h-2.5a.75.75 0 010-1.5h2.5v-2.5A.75.75 0 018 4z"/>
            </svg>
            <span style="font-size:11px">Prompts</span>
          </button>
          <button class="copilot-close-btn" aria-label="Close Copilot panel" title="Close">✕</button>
        </div>
      </header>
      <nav class="copilot-phase" aria-label="Conversation progress">
        ${renderPhases()}
      </nav>
      <div class="copilot-messages" role="log" aria-live="polite" aria-label="Chat messages">
        ${renderMessages()}
      </div>
      <div class="copilot-input-area">
        <textarea class="copilot-textarea" placeholder="Ask Kickstart anything…"
                  rows="1" aria-label="Message input"></textarea>
        <button class="copilot-send-btn" aria-label="Send message" title="Send">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M1.5 1.3l13 6.7-13 6.7 1.2-5.7H8v-2H2.7z"/>
          </svg>
        </button>
      </div>`;

    bindEvents();
    scrollToBottom();
  }

  function renderPhases() {
    return phases.map((phase, i) => {
      const status = i < currentPhase ? 'completed' : i === currentPhase ? 'active' : '';
      const connector = i < phases.length - 1
        ? `<span class="copilot-phase-connector ${i < currentPhase ? 'completed' : ''}"></span>`
        : '';
      return `
        <span class="copilot-phase-step">
          <span class="copilot-phase-dot ${status}" aria-hidden="true"></span>
          <span>${phase.label}</span>
        </span>
        ${connector}`;
    }).join('');
  }

  function renderMessages() {
    let html = messages.map(msg => {
      const cls = msg.role === 'user' ? 'user' : 'assistant';
      return `<div class="chat-bubble ${cls}" role="article">${msg.html ?? escapeHtml(msg.text)}</div>`;
    }).join('');

    if (isTyping) {
      html += `
        <div class="typing-indicator" aria-label="Copilot is typing">
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
          <span class="typing-dot"></span>
        </div>`;
    }
    return html;
  }

  function bindEvents() {
    panel.querySelector('.copilot-close-btn')?.addEventListener('click', () => toggle(false));

    panel.querySelector('.copilot-inspector-btn')?.addEventListener('click', () => {
      promptInspectorEnabled = !promptInspectorEnabled;
      const btn = panel.querySelector('.copilot-inspector-btn');
      if (btn) {
        btn.classList.toggle('active', promptInspectorEnabled);
        btn.setAttribute('aria-pressed', String(promptInspectorEnabled));
        btn.title = promptInspectorEnabled ? 'Hide prompts' : 'Show prompts';
      }
      onPromptInspectorToggle(promptInspectorEnabled);
    });

    const textarea = panel.querySelector('.copilot-textarea');
    const sendBtn = panel.querySelector('.copilot-send-btn');

    textarea?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        send();
      }
    });

    // Auto-resize textarea
    textarea?.addEventListener('input', () => {
      textarea.style.height = 'auto';
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
    });

    sendBtn?.addEventListener('click', send);
  }

  function send() {
    const textarea = panel.querySelector('.copilot-textarea');
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
    const container = panel.querySelector('.copilot-messages');
    if (container) {
      container.innerHTML = renderMessages();
      scrollToBottom();
    }
  }

  function scrollToBottom() {
    const container = panel.querySelector('.copilot-messages');
    if (container) {
      requestAnimationFrame(() => {
        container.scrollTop = container.scrollHeight;
      });
    }
  }

  function setTyping(val) {
    isTyping = val;
    refreshMessages();
  }

  function setPhase(index) {
    currentPhase = index;
    const phaseEl = panel.querySelector('.copilot-phase');
    if (phaseEl) phaseEl.innerHTML = renderPhases();
  }

  function toggle(show) {
    const visible = show ?? panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !visible);
    EventBus.emit('copilot:toggled', { visible });
  }

  render();

  return Object.freeze({
    element: panel,
    addMessage,
    setTyping,
    setPhase,
    toggle,
    get isVisible() { return !panel.classList.contains('hidden'); },
    get promptInspector() { return promptInspectorEnabled; },
  });
}

// ---------- Wizard ----------
export function createWizard(config) {
  const { steps = [], onComplete, onCancel } = config;
  let currentStep = 0;
  const stepData = {};

  const container = document.createElement('div');
  container.className = 'wizard';
  container.setAttribute('role', 'form');
  container.setAttribute('aria-label', config.title ?? 'Wizard');

  function render() {
    container.innerHTML = `
      <div class="wizard-steps" role="navigation" aria-label="Wizard steps">
        ${renderStepIndicators()}
      </div>
      <div class="wizard-body" id="wizard-step-content">
      </div>
      <footer class="wizard-footer">
        <button class="wizard-btn" id="wizard-cancel" type="button">Cancel</button>
        <button class="wizard-btn" id="wizard-back" type="button"
                ${currentStep === 0 ? 'disabled' : ''}>Back</button>
        ${currentStep < steps.length - 1
          ? '<button class="wizard-btn primary" id="wizard-next" type="button">Next</button>'
          : '<button class="wizard-btn primary" id="wizard-create" type="button">Create</button>'
        }
      </footer>`;

    renderStepContent();
    bindWizardEvents();
  }

  function renderStepIndicators() {
    return steps.map((step, i) => {
      const status = i < currentStep ? 'completed' : i === currentStep ? 'active' : '';
      const checkmark = i < currentStep ? '✓' : i + 1;
      const connector = i < steps.length - 1
        ? `<span class="wizard-step-connector ${i < currentStep ? 'completed' : ''}"></span>`
        : '';
      return `
        <span class="wizard-step-indicator ${status}" role="listitem"
              aria-current="${i === currentStep ? 'step' : 'false'}">
          <span class="wizard-step-circle">${checkmark}</span>
          <span class="wizard-step-label">${step.title}</span>
        </span>
        ${connector}`;
    }).join('');
  }

  function renderStepContent() {
    const body = container.querySelector('#wizard-step-content');
    if (!body) return;

    body.innerHTML = '';
    const step = steps[currentStep];
    if (step?.render) {
      const content = step.render(stepData);
      if (typeof content === 'string') {
        body.innerHTML = content;
      } else if (content instanceof HTMLElement) {
        body.appendChild(content);
      }
    }
  }

  function bindWizardEvents() {
    container.querySelector('#wizard-cancel')?.addEventListener('click', () => {
      onCancel?.();
      EventBus.emit('wizard:cancelled', { step: currentStep });
    });

    container.querySelector('#wizard-back')?.addEventListener('click', () => {
      if (currentStep > 0) {
        currentStep--;
        render();
        EventBus.emit('wizard:step', { step: currentStep });
      }
    });

    container.querySelector('#wizard-next')?.addEventListener('click', () => {
      const step = steps[currentStep];
      if (step.validate && !step.validate(stepData)) return;
      currentStep++;
      render();
      EventBus.emit('wizard:step', { step: currentStep });
    });

    container.querySelector('#wizard-create')?.addEventListener('click', () => {
      const step = steps[currentStep];
      if (step.validate && !step.validate(stepData)) return;
      onComplete?.(stepData);
      EventBus.emit('wizard:completed', { data: stepData });
    });
  }

  render();

  return Object.freeze({
    element: container,
    getData: () => ({ ...stepData }),
    goTo(index) {
      if (index >= 0 && index < steps.length) {
        currentStep = index;
        render();
      }
    },
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

// ---------- Command bar ----------
export function createCommandBar(items = []) {
  const bar = document.createElement('div');
  bar.className = 'command-bar';
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Actions');

  bar.innerHTML = items.map(item => {
    if (item.type === 'divider') return '<span class="command-bar-divider"></span>';
    if (item.type === 'spacer') return '<span class="command-bar-spacer"></span>';

    const cls = `command-bar-btn ${item.primary ? 'primary' : ''}`.trim();
    return `
      <button class="${cls}" data-action="${item.action ?? ''}"
              aria-label="${item.label}" title="${item.label}">
        ${item.icon ? `<span aria-hidden="true">${item.icon}</span>` : ''}
        <span>${item.label}</span>
      </button>`;
  }).join('');

  // Bind click handlers
  items.forEach(item => {
    if (!item.action || !item.onClick) return;
    bar.querySelector(`[data-action="${item.action}"]`)
      ?.addEventListener('click', item.onClick);
  });

  return bar;
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
      btn.textContent = '✓ Copied';
      setTimeout(() => { btn.innerHTML = orig; }, 2000);
    } catch { /* clipboard API may not be available */ }
  });

  return block;
}

// ---------- Helpers ----------
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

export { escapeHtml };
