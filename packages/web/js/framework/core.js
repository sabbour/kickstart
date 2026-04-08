/**
 * Framework Core — SPA router, navigation engine, breadcrumb manager
 * @module core
 */

// ---------- Event bus (lightweight pub/sub) ----------
const EventBus = (() => {
  const listeners = {};

  return Object.freeze({
    on(event, fn) {
      (listeners[event] ??= []).push(fn);
    },
    off(event, fn) {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter(f => f !== fn);
    },
    emit(event, data) {
      (listeners[event] ?? []).forEach(fn => fn(data));
    },
  });
})();

// ---------- Router ----------
const Router = (() => {
  const routes = new Map();
  let currentRoute = null;
  let contentEl = null;

  function register(path, handler) {
    routes.set(path, handler);
  }

  function navigate(path) {
    if (window.location.hash !== `#${path}`) {
      window.location.hash = path;
    }
  }

  async function resolve() {
    const hash = window.location.hash.slice(1) || '/';
    const path = hash.split('?')[0];

    if (path === currentRoute) return;
    currentRoute = path;

    const handler = routes.get(path) ?? routes.get('*');
    if (!handler) {
      console.warn(`[Router] No handler for ${path}`);
      return;
    }

    if (!contentEl) {
      contentEl = document.getElementById('content-area');
    }

    if (contentEl) {
      contentEl.innerHTML = '';
      contentEl.setAttribute('aria-busy', 'true');
    }

    try {
      await handler(contentEl, path);
      Breadcrumbs.updateFromRoute(path);
      Navigation.setActive(path);
      EventBus.emit('route:changed', { path });
    } catch (err) {
      console.error(`[Router] Error rendering ${path}:`, err);
      if (contentEl) {
        contentEl.innerHTML = `
          <div class="card" style="margin:var(--spacing-xl) auto;max-width:480px;text-align:center">
            <h2 style="margin-bottom:var(--spacing-m)">Something went wrong</h2>
            <p>${err.message}</p>
          </div>`;
      }
    } finally {
      contentEl?.setAttribute('aria-busy', 'false');
    }
  }

  function init(containerSelector = '#content-area') {
    contentEl = document.querySelector(containerSelector);
    window.addEventListener('hashchange', resolve);
    resolve();
  }

  return Object.freeze({ register, navigate, init, resolve });
})();

// ---------- Navigation pane ----------
const Navigation = (() => {
  let navEl = null;
  let items = [];
  let collapsed = false;

  function init(config) {
    navEl = document.getElementById('nav-pane');
    if (!navEl) return;

    items = config.items ?? [];
    render();

    // Collapse toggle
    const toggle = navEl.querySelector('.nav-toggle');
    toggle?.addEventListener('click', () => {
      collapsed = !collapsed;
      navEl.classList.toggle('collapsed', collapsed);
      toggle.setAttribute('aria-expanded', String(!collapsed));
      EventBus.emit('nav:toggled', { collapsed });
    });
  }

  function render() {
    if (!navEl) return;

    const listHtml = items.map(item => {
      if (item.divider) return '<li class="nav-divider" role="separator"></li>';
      return `
        <li>
          <a class="nav-item" href="#${item.path}" data-path="${item.path}"
             role="menuitem" aria-label="${item.label}">
            <span class="nav-item-icon" aria-hidden="true">${item.icon ?? ''}</span>
            <span class="nav-item-label">${item.label}</span>
          </a>
        </li>`;
    }).join('');

    navEl.innerHTML = `
      <button class="nav-toggle" aria-label="Toggle navigation" aria-expanded="true">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 4h12v1H2zm0 3.5h12v1H2zM2 11h12v1H2z"/>
        </svg>
      </button>
      <ul class="nav-items" role="menu">${listHtml}</ul>`;

    // Re-bind toggle
    navEl.querySelector('.nav-toggle')?.addEventListener('click', () => {
      collapsed = !collapsed;
      navEl.classList.toggle('collapsed', collapsed);
    });
  }

  function setActive(path) {
    if (!navEl) return;
    navEl.querySelectorAll('.nav-item').forEach(el => {
      const match = el.dataset.path === path ||
        (path === '/' && el.dataset.path === '/overview') ||
        (el.dataset.path === '/' && path === '/overview');
      el.classList.toggle('active', match);
      el.setAttribute('aria-current', match ? 'page' : 'false');
    });
  }

  return Object.freeze({ init, setActive, render });
})();

// ---------- Breadcrumbs ----------
const Breadcrumbs = (() => {
  let barEl = null;
  const routeLabels = new Map();

  function init(labels = {}) {
    barEl = document.getElementById('breadcrumb-bar');
    Object.entries(labels).forEach(([k, v]) => routeLabels.set(k, v));
  }

  function updateFromRoute(path) {
    if (!barEl) return;

    const segments = path.split('/').filter(Boolean);
    const crumbs = [{ label: 'Kickstart', path: '/' }];

    let accumulated = '';
    for (const seg of segments) {
      accumulated += `/${seg}`;
      crumbs.push({
        label: routeLabels.get(accumulated) ?? formatSegment(seg),
        path: accumulated,
      });
    }

    render(crumbs);
  }

  function render(crumbs) {
    if (!barEl) return;
    barEl.innerHTML = crumbs.map((c, i) => {
      const isLast = i === crumbs.length - 1;
      if (isLast) {
        return `<span class="breadcrumb-current" aria-current="page">${c.label}</span>`;
      }
      return `<a class="breadcrumb-link" href="#${c.path}">${c.label}</a>
              <span class="breadcrumb-separator" aria-hidden="true">›</span>`;
    }).join(' ');
  }

  function formatSegment(seg) {
    return seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');
  }

  return Object.freeze({ init, updateFromRoute, render });
})();

export { EventBus, Router, Navigation, Breadcrumbs };
