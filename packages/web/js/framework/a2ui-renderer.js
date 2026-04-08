/**
 * A2UI JSON → DOM renderer
 *
 * Takes A2UI component descriptors (from the Kickstart Catalog) and renders
 * them into DOM elements styled with Portal Prototyper CSS classes.
 *
 * @module a2ui-renderer
 */

import { createCodeBlock, createCard, createStatusBadge, escapeHtml, renderMarkdown, renderFileChips } from './components.js';

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

  // GitHub & app-overview components
  RepoPicker:         renderRepoPicker,
  WorkflowStatus:     renderWorkflowStatus,
  CodespaceLink:      renderCodespaceLink,
  AppOverview:        renderAppOverview,

  // File generation chips
  FileGeneration:     renderFileGeneration,
};

// --- Standard A2UI ---

function renderText(schema) {
  const tag = schema.variant === 'heading' ? 'h3' : 'div';
  const el = document.createElement(tag);
  el.innerHTML = renderMarkdown(schema.text ?? '');
  if (schema.style) Object.assign(el.style, schema.style);
  if (schema.className) el.className = schema.className;
  return el;
}

function renderButton(schema, ctx) {
  const btn = document.createElement('button');
  btn.className = `btn ${schema.primary ? 'primary' : ''} ${schema.className ?? ''}`.trim();
  btn.textContent = schema.label ?? 'Button';
  if (schema.disabled) btn.disabled = true;

  // Use data attributes for event delegation (survives innerHTML serialization)
  if (schema.action) {
    btn.dataset.a2uiAction = schema.action;
    btn.dataset.a2uiData = JSON.stringify(schema.data || {});
  }

  // Also attach direct listener for DOM-node rendering paths
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

  // Normalize: phases may be strings (demo) or objects (API: {id, label, status})
  const normalizedPhases = phases.map(p =>
    typeof p === 'string' ? { label: p, status: '' } : p
  );

  // Determine active index: currentPhase may be a number or a phase id string
  let activeIndex;
  if (typeof schema.currentPhase === 'number') {
    activeIndex = schema.currentPhase;
  } else if (typeof schema.currentPhase === 'string') {
    activeIndex = normalizedPhases.findIndex(p => p.id === schema.currentPhase);
    if (activeIndex === -1) activeIndex = 0;
  } else {
    activeIndex = 0;
  }

  el.innerHTML = normalizedPhases.map((phase, i) => {
    // Use phase.status if provided (API), otherwise infer from index
    let status;
    if (phase.status === 'complete' || phase.status === 'completed') {
      status = 'completed';
    } else if (phase.status === 'active') {
      status = 'active';
    } else {
      status = i < activeIndex ? 'completed' : i === activeIndex ? 'active' : '';
    }
    const connector = i < normalizedPhases.length - 1
      ? `<span class="copilot-phase-connector ${i < activeIndex ? 'completed' : ''}"></span>`
      : '';
    return `
      <span class="copilot-phase-step">
        <span class="copilot-phase-dot ${status}"></span>
        <span>${escapeHtml(phase.label ?? phase)}</span>
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
            <div style="font-size:24px;margin-bottom:var(--spacing-xs)">${comp.icon ?? '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M21 16.5c0 .38-.21.71-.53.88l-7.9 4.44c-.36.2-.82.2-1.14 0l-7.9-4.44A.991.991 0 013 16.5v-9c0-.38.21-.71.53-.88l7.9-4.44a.99.99 0 011.14 0l7.9 4.44c.32.17.53.5.53.88v9zM12 4.15L5 8.09v7.82l7 3.94 7-3.94V8.09l-7-3.94z"/></svg>'}</div>
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

// --- GitHub & App-overview components ---

function renderRepoPicker(schema, ctx) {
  const group = document.createElement('div');
  group.className = 'form-group';

  const label = document.createElement('label');
  label.className = 'form-label';
  label.textContent = schema.label ?? 'Repository';
  group.appendChild(label);

  const wrapper = document.createElement('div');
  wrapper.style.position = 'relative';

  const input = document.createElement('input');
  input.className = 'form-input';
  input.placeholder = schema.placeholder ?? 'Search repositories…';
  input.setAttribute('autocomplete', 'off');
  input.value = schema.value ?? '';

  const dropdown = document.createElement('ul');
  dropdown.style.cssText =
    'list-style:none;margin:0;padding:0;position:absolute;left:0;right:0;top:100%;' +
    'max-height:200px;overflow-y:auto;background:var(--color-neutral-background-1);' +
    'border:1px solid var(--color-neutral-stroke-1);border-radius:var(--radius-medium);' +
    'display:none;z-index:10;box-shadow:var(--shadow-4)';

  const repos = schema.options ?? [];
  function buildItems(filter) {
    dropdown.innerHTML = '';
    const lf = filter.toLowerCase();
    const matched = repos.filter(r => (r.fullName ?? r.label ?? '').toLowerCase().includes(lf));
    matched.forEach(repo => {
      const li = document.createElement('li');
      li.style.cssText = 'padding:var(--spacing-s) var(--spacing-m);cursor:pointer;display:flex;align-items:center;gap:var(--spacing-s)';
      li.innerHTML = `<span aria-hidden="true"><svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style="vertical-align:-3px"><path d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V8a2 2 0 00-2-2h-5.586a1 1 0 01-.707-.293L8.293 4.293A1 1 0 007.586 4H4z"/></svg></span><span>${escapeHtml(repo.fullName ?? repo.label)}</span>`;
      li.addEventListener('mousedown', () => {
        input.value = repo.fullName ?? repo.label;
        dropdown.style.display = 'none';
        ctx.onDataChange?.(schema.name ?? 'repo', repo.value ?? repo.fullName);
      });
      li.addEventListener('mouseenter', () => { li.style.background = 'var(--color-neutral-background-1-hover)'; });
      li.addEventListener('mouseleave', () => { li.style.background = ''; });
      dropdown.appendChild(li);
    });

    // "or create new" option
    const createLi = document.createElement('li');
    createLi.style.cssText =
      'padding:var(--spacing-s) var(--spacing-m);cursor:pointer;display:flex;align-items:center;gap:var(--spacing-s);' +
      'border-top:1px solid var(--color-neutral-stroke-2);font-weight:var(--font-weight-semibold);color:var(--color-brand-foreground-1)';
    createLi.innerHTML = '<span aria-hidden="true">＋</span><span>Create new repository…</span>';
    createLi.addEventListener('mousedown', () => {
      dropdown.style.display = 'none';
      ctx.onAction?.('repo:create', { name: filter || 'new-repo' });
    });
    dropdown.appendChild(createLi);

    dropdown.style.display = 'block';
  }

  input.addEventListener('focus', () => buildItems(input.value));
  input.addEventListener('input', () => buildItems(input.value));
  input.addEventListener('blur', () => { setTimeout(() => { dropdown.style.display = 'none'; }, 150); });

  wrapper.appendChild(input);
  wrapper.appendChild(dropdown);
  group.appendChild(wrapper);

  if (schema.hint) {
    const hint = document.createElement('span');
    hint.className = 'form-hint';
    hint.textContent = schema.hint;
    group.appendChild(hint);
  }

  return group;
}

function renderWorkflowStatus(schema) {
  const card = document.createElement('article');
  card.className = 'card';

  const statusColor = (s) => {
    switch (s) {
      case 'success':     return 'var(--color-success, #0e7a0d)';
      case 'in_progress': return 'var(--color-warning, #c4a000)';
      case 'failure':     return 'var(--color-error, #d13438)';
      case 'queued':
      default:            return 'var(--color-neutral-foreground-disabled, #888)';
    }
  };
  const statusLabel = (s) => s.replace(/_/g, ' ');

  const runs = schema.runs ?? [];
  card.innerHTML = `
    <div class="card-header"><h3 class="card-title">${escapeHtml(schema.title ?? 'Workflow Runs')}</h3></div>
    <div class="card-body">
      <div style="display:flex;flex-direction:column;gap:var(--spacing-s)">
        ${runs.map(run => `
          <a href="${run.url ?? '#'}" target="_blank" rel="noopener"
             style="display:flex;align-items:center;gap:var(--spacing-s);padding:var(--spacing-s);
                    border-radius:var(--radius-medium);text-decoration:none;color:inherit;
                    border:1px solid var(--color-neutral-stroke-2)">
            <span style="width:10px;height:10px;border-radius:50%;flex-shrink:0;
                         background:${statusColor(run.status)}"></span>
            <span style="flex:1;font-weight:var(--font-weight-semibold)">${escapeHtml(run.name)}</span>
            <span style="font-size:var(--font-size-200);color:var(--color-neutral-foreground-3)">
              ${escapeHtml(run.branch ?? '')}${run.sha ? ` · ${escapeHtml(run.sha.slice(0, 7))}` : ''}
            </span>
            <span style="font-size:var(--font-size-200);text-transform:capitalize;color:${statusColor(run.status)}">
              ${statusLabel(run.status)}
            </span>
          </a>
        `).join('')}
      </div>
    </div>`;

  return card;
}

function renderCodespaceLink(schema) {
  const card = document.createElement('article');
  card.className = 'card';
  card.style.cssText = 'border:2px solid var(--color-brand-stroke-1, #0078d4);background:var(--color-brand-background-2, #deecf9)';

  card.innerHTML = `
    <div class="card-body" style="text-align:center;padding:var(--spacing-xl)">
      <div style="margin-bottom:var(--spacing-m)" aria-hidden="true"><svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5c-1.1 0-4.5 2.9-4.5 9 0 1.5.2 2.8.5 3.9l-2.2 1.3c-.5.3-.8.8-.8 1.4v2.4l3.5-1.8c1 .9 2.1 1.3 3.5 1.3s2.5-.4 3.5-1.3l3.5 1.8v-2.4c0-.6-.3-1.1-.8-1.4l-2.2-1.3c.3-1.1.5-2.4.5-3.9 0-6.1-3.4-9-4.5-9zm0 11a1.5 1.5 0 110-3 1.5 1.5 0 010 3z"/></svg></div>
      <h3 style="margin-bottom:var(--spacing-xs);font-size:var(--font-size-500)">${escapeHtml(schema.repoFullName ?? 'repository')}</h3>
      <p style="font-size:var(--font-size-200);color:var(--color-neutral-foreground-3);margin-bottom:var(--spacing-l)">
        Branch: <strong>${escapeHtml(schema.branch ?? 'main')}</strong>
      </p>
      <div style="display:flex;gap:var(--spacing-m);justify-content:center;flex-wrap:wrap">
        <a href="${schema.codespaceUrl ?? '#'}" target="_blank" rel="noopener"
           class="btn primary" style="text-decoration:none;display:inline-flex;align-items:center;gap:var(--spacing-xs)">
          <span aria-hidden="true"><svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style="vertical-align:-2px"><path d="M7.65 3.15a.5.5 0 01-.3.64l-.1.03-2.75.69a1.5 1.5 0 00-1.1 1.3l-.01.14v8.1a1.5 1.5 0 001 1.41l.11.03 2.75.69a.5.5 0 01-.14.98l-.1.01-2.76-.69A2.5 2.5 0 012.5 14.1V5.95a2.5 2.5 0 011.65-2.35l.1-.03 2.76-.69a.5.5 0 01.64.27zM12.35 3.15a.5.5 0 01.64-.3l.1.03 2.76.69A2.5 2.5 0 0117.5 5.95v8.1a2.5 2.5 0 01-1.65 2.35l-.1.03-2.76.69a.5.5 0 01-.34-.95l.1-.03 2.75-.69a1.5 1.5 0 001.1-1.3l.01-.14V5.95a1.5 1.5 0 00-1-1.41l-.11-.03-2.75-.69a.5.5 0 01-.4-.67zM7.15 7.35a.5.5 0 01.7 0L10 9.5l2.15-2.15a.5.5 0 11.7.7L10.71 10.2l2.14 2.15a.5.5 0 11-.7.7L10 10.91l-2.15 2.14a.5.5 0 11-.7-.7l2.14-2.15-2.14-2.15a.5.5 0 010-.7z"/></svg></span> Open in Codespaces
        </a>
        <a href="${schema.vscodeUrl ?? '#'}" target="_blank" rel="noopener"
           class="btn" style="text-decoration:none;display:inline-flex;align-items:center;gap:var(--spacing-xs)">
          <span aria-hidden="true"><svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" style="vertical-align:-2px"><path d="M2 5.5A2.5 2.5 0 014.5 3h11A2.5 2.5 0 0118 5.5v7a2.5 2.5 0 01-2.5 2.5h-11A2.5 2.5 0 012 12.5v-7zM5 7a1 1 0 100 2 1 1 0 000-2zm3 0a1 1 0 100 2 1 1 0 000-2zm4 1a1 1 0 10-2 0 1 1 0 002 0zm2-1a1 1 0 100 2 1 1 0 000-2zm-8 4h8a.5.5 0 010 1H6a.5.5 0 010-1z"/></svg></span> Open in vscode.dev
        </a>
      </div>
    </div>`;

  return card;
}

function renderAppOverview(schema) {
  const card = document.createElement('article');
  card.className = 'card';

  const statusColor = {
    draft:    'var(--color-neutral-foreground-3)',
    running:  'var(--color-success, #0e7a0d)',
    stopped:  'var(--color-error, #d13438)',
    deploying:'var(--color-warning, #c4a000)',
  };

  const services = schema.services ?? [];
  const color = statusColor[schema.status] ?? statusColor.draft;

  card.innerHTML = `
    <div class="card-header" style="display:flex;align-items:center;justify-content:space-between">
      <div>
        <h3 class="card-title" style="display:flex;align-items:center;gap:var(--spacing-s)">
          <span aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M21 16.5c0 .38-.21.71-.53.88l-7.9 4.44c-.36.2-.82.2-1.14 0l-7.9-4.44A.991.991 0 013 16.5v-9c0-.38.21-.71.53-.88l7.9-4.44a.99.99 0 011.14 0l7.9 4.44c.32.17.53.5.53.88v9zM12 4.15L5 8.09v7.82l7 3.94 7-3.94V8.09l-7-3.94z"/></svg></span>
          ${escapeHtml(schema.appName ?? 'App')}
        </h3>
        ${schema.description ? `<p class="card-subtitle" style="margin-top:var(--spacing-xxs)">${escapeHtml(schema.description)}</p>` : ''}
      </div>
      <span style="display:inline-flex;align-items:center;gap:var(--spacing-xs);font-size:var(--font-size-200)">
        <span style="width:8px;height:8px;border-radius:50%;background:${color}"></span>
        ${escapeHtml(schema.status ?? 'draft')}
      </span>
    </div>
    <div class="card-body">
      <div style="display:flex;flex-wrap:wrap;gap:var(--spacing-s);align-items:center">
        ${schema.runtime ? `<span style="display:inline-block;padding:2px var(--spacing-s);border-radius:var(--radius-small);
          background:var(--color-brand-background-2, #deecf9);color:var(--color-brand-foreground-1, #0078d4);
          font-size:var(--font-size-200);font-weight:var(--font-weight-semibold)">${escapeHtml(schema.runtime)}</span>` : ''}
        ${services.map(s => `<span style="display:inline-block;padding:2px var(--spacing-s);border-radius:var(--radius-small);
          background:var(--color-neutral-background-3);font-size:var(--font-size-200)">${escapeHtml(s)}</span>`).join('')}
      </div>
      ${schema.url ? `<div style="margin-top:var(--spacing-m)">
        <a href="${schema.url}" target="_blank" rel="noopener" style="font-size:var(--font-size-200);color:var(--color-brand-foreground-1)">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" style="vertical-align:-2px;margin-right:2px"><path d="M7.47 12.41a4.5 4.5 0 01-.34-6l.34-.37 2.12-2.12a4.5 4.5 0 016.72 5.97l-.35.39-1.06 1.06a.5.5 0 01-.76-.64l.05-.07 1.06-1.06a3.5 3.5 0 00-4.86-5.03l-.09.08-2.12 2.12a3.5 3.5 0 00-.08 4.87l.08.08a.5.5 0 01-.71.71zm5.06-4.82a.5.5 0 01.71.71 4.5 4.5 0 01-.34 6l-.37.37-2.12 2.12a4.5 4.5 0 01-6.72-5.97l.35-.39 1.06-1.06a.5.5 0 01.76.64l-.05.07-1.06 1.06a3.5 3.5 0 004.86 5.03l.09-.08 2.12-2.12a3.5 3.5 0 00.08-4.87l-.08-.08a.5.5 0 010-.71z"/></svg> ${escapeHtml(schema.url)}
        </a>
      </div>` : ''}
    </div>`;

  return card;
}

// --- File generation chips ---

function renderFileGeneration(schema) {
  const el = document.createElement('div');
  el.className = 'a2ui-component file-generation';
  el.innerHTML = renderFileChips(schema.files ?? []);
  return el;
}

// --- Helpers ---

function statusIcon(status) {
  switch (status) {
    case 'completed': return '<span style="color:var(--color-success)"><svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" style="vertical-align:-2px"><path d="M7.03 13.9L3.56 10.44a.75.75 0 00-1.06 1.06l4 4a.75.75 0 001.06 0l9-9a.75.75 0 00-1.06-1.06L7.03 13.9z"/></svg></span>';
    case 'running':   return '<span class="spinner" style="width:14px;height:14px;border-width:2px"></span>';
    case 'error':     return '<span style="color:var(--color-error)"><svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor" style="vertical-align:-2px"><path d="M4.09 4.22a.5.5 0 01.63-.06l.07.06L10 9.44l5.22-5.22a.5.5 0 01.63-.06l.07.06a.5.5 0 01.06.63l-.06.07L10.7 10.1l5.22 5.22a.5.5 0 01-.63.76l-.07-.06L10 10.8l-5.22 5.22a.5.5 0 01-.63.06l-.07-.06a.5.5 0 01-.06-.63l.06-.07 5.22-5.22-5.22-5.22a.5.5 0 01-.06-.63l.06-.07z"/></svg></span>';
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
