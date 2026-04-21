// Minimal diagram helpers shared between the ArchitectureDiagram catalog
// component and the FileEditor DiagramPreview. Kept intentionally small —
// the v1 full-fat renderer (icon registry, strict sanitization) will return
// with the architecture-diagram fluent work; this module only needs to
// satisfy the Mermaid loading / source-prep / styling contract DiagramPreview
// consumes today.

export interface MermaidModule {
  render(id: string, source: string): Promise<{ svg: string }>;
  initialize?: (config: Record<string, unknown>) => void;
}

/**
 * Lazy-load the Mermaid library. Separated out so the heavy renderer isn't
 * pulled into the main bundle.
 */
export async function loadMermaid(): Promise<MermaidModule> {
  const mod = await import(/* @vite-ignore */ 'mermaid');
  const mermaid = (mod as { default?: MermaidModule }).default ?? (mod as unknown as MermaidModule);
  mermaid.initialize?.({ startOnLoad: false, securityLevel: 'antiscript' });
  return mermaid;
}

/**
 * Strip unsupported inline `%%icon:name%%` placeholders before handing the
 * source to Mermaid. Downstream renderers may post-process these separately.
 */
export function prepareArchitectureDiagramSource(source: string): string {
  return source.replace(/%%icon:[a-zA-Z0-9_-]+%%/g, '');
}

/**
 * Inject defensive stylesheet overrides into the rendered SVG so group
 * backgrounds and label typography render correctly in light/dark themes.
 */
export function injectDiagramStyles(svg: string): string {
  const style = `<style>
    .cluster rect { fill: var(--diagram-cluster-fill, #f3f4f6); stroke: var(--diagram-cluster-stroke, #9ca3af); }
    .node rect, .node polygon { stroke-width: 1.25px; }
    .edgeLabel { background: transparent; }
  </style>`;
  return svg.replace('<svg ', `${style}<svg `);
}

const XLINK_NS = 'http://www.w3.org/1999/xlink';

/**
 * Normalize a URL value for `javascript:` prefix detection. Strips leading
 * whitespace/control characters and attempts to percent-decode before
 * comparing against the dangerous scheme. This catches obfuscated vectors
 * like `"  javascript:"`, `"java\tscript:"`, and `"%6Aavascript:..."`.
 */
function hasJavaScriptScheme(raw: string): boolean {
  if (!raw) return false;
  const candidates = new Set<string>();
  candidates.add(raw);
  try {
    candidates.add(decodeURIComponent(raw));
  } catch {
    // malformed percent-encoding — fall back to raw
  }
  for (const candidate of candidates) {
    // Strip whitespace and C0 control characters (tab, newline, CR, etc.)
    // and lower-case before comparing. The URL parser itself strips these
    // when resolving `href`, so an attacker can smuggle them in.
    // eslint-disable-next-line no-control-regex
    const stripped = candidate.replace(/[\s\u0000-\u001f]+/g, '').toLowerCase();
    if (stripped.startsWith('javascript:')) return true;
  }
  return false;
}

/**
 * A `<use>` reference is external if it points anywhere other than a same-
 * document fragment (`#id`). Anything containing a scheme (`:`) or starting
 * with `//` (protocol-relative) is treated as external and removed.
 */
function isExternalUseReference(href: string): boolean {
  if (!href) return false;
  const trimmed = href.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('#')) return false;
  if (trimmed.startsWith('//')) return true;
  return trimmed.includes(':');
}

/**
 * Harden an SVG string before it is inserted into the DOM. Applies three
 * defensive strips in addition to the existing `<script>`/`on*` removal:
 *
 *   1. `javascript:` URLs (including whitespace/percent-decoded variants)
 *      on `href`/`xlink:href` of `<a>`, `<image>`, and `<use>` elements.
 *   2. `<use>` elements whose `href` points at an external document
 *      (data:, http:, //host/…). Same-document `#fragment` refs are kept.
 *   3. `<foreignObject>` elements are removed wholesale — they embed
 *      arbitrary HTML which is an easy XSS escape hatch.
 *
 * The function parses the SVG with `DOMParser` (image/svg+xml) so traversal
 * happens on real DOM nodes — never on the raw string. On parse failure the
 * original input is returned unchanged (Mermaid output is trusted to parse;
 * a failure here indicates upstream corruption, not an attack payload we
 * can sanitize).
 */
export function sanitizeSvgMarkup(svg: string): string {
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
    return svg;
  }

  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    return svg;
  }

  doc.querySelectorAll('script').forEach((el) => el.remove());
  doc.querySelectorAll('foreignObject').forEach((el) => el.remove());

  doc.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      const lname = attr.name.toLowerCase();
      if (lname.startsWith('on')) {
        el.removeAttribute(attr.name);
      }
    });
  });

  doc.querySelectorAll('a, image, use').forEach((el) => {
    const href = el.getAttribute('href');
    if (href !== null && hasJavaScriptScheme(href)) {
      el.removeAttribute('href');
    }
    const xlinkHref =
      el.getAttributeNS(XLINK_NS, 'href') ?? el.getAttribute('xlink:href');
    if (xlinkHref !== null && hasJavaScriptScheme(xlinkHref)) {
      el.removeAttributeNS(XLINK_NS, 'href');
      el.removeAttribute('xlink:href');
    }
  });

  doc.querySelectorAll('use').forEach((el) => {
    const href =
      el.getAttribute('href') ??
      el.getAttributeNS(XLINK_NS, 'href') ??
      el.getAttribute('xlink:href') ??
      '';
    if (isExternalUseReference(href)) {
      el.remove();
    }
  });

  return new XMLSerializer().serializeToString(doc.documentElement);
}
