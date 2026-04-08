/**
 * A2UI JSON → DOM renderer
 *
 * Takes A2UI component descriptors (from the Kickstart Catalog) and renders
 * them into DOM elements styled with Portal Prototyper CSS classes.
 *
 * @module a2ui-renderer
 */

import { createCodeBlock, createCard, createStatusBadge, escapeHtml } from './components.js';

/**
 * Render an A2UI JSON component tree to a DOM element.
 * @param {Object|Array} schema - A2UI component descriptor(s)
 * @param {Object} [ctx] - Render context (callbacks, state)
 * @returns {HTMLElement}
 */
export function renderA2UI(schema, ctx = {}) {
  if (Array.isArray(schema)) {
    const frag = document.createDocumentFragment();
    schema.forEach(child => frag.appendChild(renderA2UI(child, ctx)));
    const wrapper = document.createElement('div');
    wrapper.appendChild(frag);
    return wrapper;
  }

  const renderer = RENDERERS[schema?.type];
  if (!renderer) {
    console.warn(`[A2UI] Unknown component type: ${schema?.type}`);
    return createFallback(schema);
  }

  return renderer(schema, ctx);
}

// ---------- Built-in renderers ----------

const RENDERERS = {
  Text:               renderText,
  Button:             renderButton,
  TextField:          renderTextField,
  Row:                renderRow,
  Column:             renderColumn,
  Card:               renderCardA2UI,
  Tabs:               renderTabs,

  // Custom Kickstart components
  ConversationPhase:  renderConversationPhase,
  CodeBlock:          renderCodeBlockA2UI,
  ResourcePicker:     renderResourcePicker,
  DeploymentProgress: renderDeploymentProgress,
  ArchitectureDiagram:renderArchitectureDiagram,
  CostEstimate:       renderCostEstimate,
  HandoffCard:        renderHandoffCard,
};

// --- Standard A2UI ---

function renderText(schema) {
  const el = document.createElement(schema.variant === 'heading' ? 'h3' : 'p');
  el.textContent = schema.text ?? '';
  if (schema.style) Object.assign(el.style, schema.style);
  if (schema.className) el.className = schema.className;
  return el;
}

function renderButton(schema, ctx) {
  const btn = document.createElement('button');
  btn.className = `btn ${schema.primary ? 'primary' : ''} ${schema.className ?? ''}`.trim();
  btn.textContent = schema.label ?? 'Button';
  if (schema.disabled) btn.disabled = true;

  if (schema.action && ctx.onAction) {
    btn.addEventListener('click', () => ctx.onAction(schema.action, schema.data));
  }

  return btn;
}

function renderTextField(schema, ctx) {
  const group = document.createElement('div');
  group.className = 'form-group';

  if (schema.label) {
    const label = document.createElement('label');
    label.className = 'form-label';
    label.textContent = schema.label;
    if (schema.required) {
      const star = document.createElement('span');
      star.className = 'required';
      star.textContent = ' *';
      label.appendChild(star);
    }
    group.appendChild(label);
  }

  const input = document.createElement(schema.multiline ? 'textarea' : 'input');
  input.className = 'form-input';
  input.placeholder = schema.placeholder ?? '';
  input.value = schema.value ?? '';
  if (schema.name) input.name = schema.name;
  if (schema.required) input.required = true;
  if (schema.multiline) input.rows = schema.rows ?? 3;

  if (ctx.onDataChange) {
    input.addEventListener('input', () => {
      ctx.onDataChange(schema.name ?? schema.id, input.value);
    });
  }

  group.appendChild(input);

  if (schema.hint) {
    const hint = document.createElement('span');
    hint.className = 'form-hint';
    hint.textContent = schema.hint;
    group.appendChild(hint);
  }

  return group;
}

function renderRow(schema, ctx) {
  const row = document.createElement('div');
  row.style.display = 'flex';
  row.style.gap = schema.gap ?? 'var(--spacing-l)';
  row.style.alignItems = schema.align ?? 'flex-start';
  if (schema.wrap) row.style.flexWrap = 'wrap';

  (schema.children ?? []).forEach(child => {
    row.appendChild(renderA2UI(child, ctx));
  });

  return row;
}

function renderColumn(schema, ctx) {
  const col = document.createElement('div');
  col.style.display = 'flex';
  col.style.flexDirection = 'column';
  col.style.gap = schema.gap ?? 'var(--spacing-m)';
  col.style.flex = schema.flex ?? '1';

  (schema.children ?? []).forEach(child => {
    col.appendChild(renderA2UI(child, ctx));
  });

  return col;
}

function renderCardA2UI(schema, ctx) {
  const bodyEl = document.createElement('div');
  (schema.children ?? []).forEach(child => {
    bodyEl.appendChild(renderA2UI(child, ctx));
  });

  return createCard({
    title: schema.title,
    subtitle: schema.subtitle,
    body: bodyEl,
    className: schema.className,
  });
}

function renderTabs(schema, ctx) {
  const wrapper = document.createElement('div');

  const tabBar = document.createElement('div');
  tabBar.className = 'tabs';
  tabBar.setAttribute('role', 'tablist');

  const contentArea = document.createElement('div');
  contentArea.className = 'tab-content';

  const tabs = schema.tabs ?? [];
  let activeIndex = schema.activeTab ?? 0;

  function renderTab(index) {
    tabBar.innerHTML = '';
    contentArea.innerHTML = '';

    tabs.forEach((tab, i) => {
      const btn = document.createElement('button');
      btn.className = `tab-item ${i === index ? 'active' : ''}`;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', String(i === index));
      btn.textContent = tab.label;
      btn.addEventListener('click', () => renderTab(i));
      tabBar.appendChild(btn);
    });

    const activeTab = tabs[index];
    if (activeTab?.children) {
      activeTab.children.forEach(child => {
        contentArea.appendChild(renderA2UI(child, ctx));
      });
    }
  }

  renderTab(activeIndex);
  wrapper.appendChild(tabBar);
  wrapper.appendChild(contentArea);
  return wrapper;
}

// --- Custom Kickstart components ---

function renderConversationPhase(schema) {
  const el = document.createElement('div');
  el.className = 'copilot-phase';
  el.setAttribute('aria-label', 'Conversation phase');

  const phases = schema.phases ?? [];
  el.innerHTML = phases.map((phase, i) => {
    const status = i < schema.currentPhase ? 'completed' : i === schema.currentPhase ? 'active' : '';
    const connector = i < phases.length - 1
      ? `<span class="copilot-phase-connector ${i < schema.currentPhase ? 'completed' : ''}"></span>`
      : '';
    return `
      <span class="copilot-phase-step">
        <span class="copilot-phase-dot ${status}"></span>
        <span>${phase}</span>
      </span>
      ${connector}`;
  }).join('');

  return el;
}

function renderCodeBlockA2UI(schema) {
  return createCodeBlock(schema.code ?? '', schema.language ?? '');
}

function renderResourcePicker(schema, ctx) {
  const group = document.createElement('div');
  group.className = 'form-group';

  const label = document.createElement('label');
  label.className = 'form-label';
  label.textContent = schema.label ?? 'Select resource';
  group.appendChild(label);

  const select = document.createElement('select');
  select.className = 'form-input';
  select.name = schema.name ?? 'resource';

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = schema.placeholder ?? '-- Select --';
  placeholder.disabled = true;
  placeholder.selected = true;
  select.appendChild(placeholder);

  (schema.options ?? []).forEach(opt => {
    const option = document.createElement('option');
    option.value = opt.value ?? opt.id;
    option.textContent = opt.label ?? opt.name;
    select.appendChild(option);
  });

  if (ctx.onDataChange) {
    select.addEventListener('change', () => {
      ctx.onDataChange(schema.name ?? 'resource', select.value);
    });
  }

  group.appendChild(select);

  if (schema.hint) {
    const hint = document.createElement('span');
    hint.className = 'form-hint';
    hint.textContent = schema.hint;
    group.appendChild(hint);
  }

  return group;
}

function renderDeploymentProgress(schema) {
  const card = document.createElement('article');
  card.className = 'card';

  const steps = schema.steps ?? [];
  card.innerHTML = `
    <div class="card-header">
      <h3 class="card-title">${schema.title ?? 'Deployment Progress'}</h3>
      ${schema.status ? createStatusBadge(schema.status, schema.statusLabel).outerHTML : ''}
    </div>
    <div class="card-body">
      <div style="display:flex;flex-direction:column;gap:var(--spacing-s)">
        ${steps.map(step => `
          <div style="display:flex;align-items:center;gap:var(--spacing-s)">
            <span style="width:20px;text-align:center">${statusIcon(step.status)}</span>
            <span style="flex:1">${escapeHtml(step.label)}</span>
            <span style="font-size:var(--font-size-200);color:var(--color-neutral-foreground-3)">
              ${step.duration ?? ''}
            </span>
          </div>
        `).join('')}
      </div>
    </div>`;

  return card;
}

function renderArchitectureDiagram(schema) {
  const card = document.createElement('article');
  card.className = 'card';
  card.innerHTML = `
    <div class="card-header"><h3 class="card-title">${schema.title ?? 'Architecture'}</h3></div>
    <div class="card-body" style="text-align:center;padding:var(--spacing-xl)">
      <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:var(--spacing-l)">
        ${(schema.components ?? []).map(comp => `
          <div class="card" style="min-width:120px;text-align:center;padding:var(--spacing-l)">
            <div style="font-size:24px;margin-bottom:var(--spacing-xs)">${comp.icon ?? '📦'}</div>
            <div style="font-weight:var(--font-weight-semibold)">${escapeHtml(comp.name)}</div>
            <div style="font-size:var(--font-size-200);color:var(--color-neutral-foreground-3)">
              ${escapeHtml(comp.description ?? '')}
            </div>
          </div>
        `).join('')}
      </div>
    </div>`;

  return card;
}

function renderCostEstimate(schema) {
  const items = schema.items ?? [];
  const total = schema.total ?? items.reduce((s, it) => s + (it.cost ?? 0), 0);

  const card = document.createElement('article');
  card.className = 'card';
  card.innerHTML = `
    <div class="card-header"><h3 class="card-title">${schema.title ?? 'Estimated Monthly Cost'}</h3></div>
    <div class="card-body">
      <table style="width:100%;border-collapse:collapse">
        <thead>
          <tr style="border-bottom:1px solid var(--color-neutral-stroke-2)">
            <th style="text-align:left;padding:var(--spacing-s)">Resource</th>
            <th style="text-align:left;padding:var(--spacing-s)">SKU</th>
            <th style="text-align:right;padding:var(--spacing-s)">$/mo</th>
          </tr>
        </thead>
        <tbody>
          ${items.map(it => `
            <tr style="border-bottom:1px solid var(--color-neutral-stroke-2)">
              <td style="padding:var(--spacing-s)">${escapeHtml(it.name)}</td>
              <td style="padding:var(--spacing-s);color:var(--color-neutral-foreground-3)">${escapeHtml(it.sku ?? '')}</td>
              <td style="text-align:right;padding:var(--spacing-s)">$${(it.cost ?? 0).toFixed(2)}</td>
            </tr>
          `).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2" style="padding:var(--spacing-s);font-weight:var(--font-weight-semibold)">Total</td>
            <td style="text-align:right;padding:var(--spacing-s);font-weight:var(--font-weight-semibold)">$${total.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
    </div>`;

  return card;
}

function renderHandoffCard(schema, ctx) {
  const card = document.createElement('article');
  card.className = 'card';
  card.innerHTML = `
    <div class="card-header"><h3 class="card-title">${schema.title ?? 'Next Steps'}</h3></div>
    <div class="card-body">
      <p style="margin-bottom:var(--spacing-l)">${escapeHtml(schema.description ?? '')}</p>
      <div style="display:flex;flex-wrap:wrap;gap:var(--spacing-s)">
        ${(schema.actions ?? []).map(action => `
          <button class="btn ${action.primary ? 'primary' : ''}" data-action="${action.id ?? ''}">
            ${escapeHtml(action.label)}
          </button>
        `).join('')}
      </div>
    </div>`;

  (schema.actions ?? []).forEach(action => {
    if (action.id && ctx.onAction) {
      card.querySelector(`[data-action="${action.id}"]`)
        ?.addEventListener('click', () => ctx.onAction(action.id, action.data));
    }
  });

  return card;
}

// --- Helpers ---

function statusIcon(status) {
  switch (status) {
    case 'completed': return '<span style="color:var(--color-success)">✓</span>';
    case 'running':   return '<span class="spinner" style="width:14px;height:14px;border-width:2px"></span>';
    case 'error':     return '<span style="color:var(--color-error)">✕</span>';
    case 'pending':
    default:          return '<span style="color:var(--color-neutral-foreground-disabled)">○</span>';
  }
}

function createFallback(schema) {
  const el = document.createElement('div');
  el.style.padding = 'var(--spacing-s)';
  el.style.border = '1px dashed var(--color-warning)';
  el.style.borderRadius = 'var(--radius-medium)';
  el.style.fontSize = 'var(--font-size-200)';
  el.style.color = 'var(--color-neutral-foreground-3)';
  el.textContent = `Unknown component: ${schema?.type ?? 'null'}`;
  return el;
}

/**
 * Register a custom A2UI renderer.
 * @param {string} type - Component type name
 * @param {Function} renderer - (schema, ctx) => HTMLElement
 */
export function registerRenderer(type, renderer) {
  RENDERERS[type] = renderer;
}
