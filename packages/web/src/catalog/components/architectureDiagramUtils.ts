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
