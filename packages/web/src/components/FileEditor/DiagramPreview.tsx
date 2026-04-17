import React, { useEffect, useRef, useState } from 'react';

// Inlined from the v1 catalog/components/architectureDiagramUtils — the
// original module was deleted in the v2 rewrite. Keep these minimal: load
// mermaid lazily and pass the source through untouched. The Fluent theming
// hook (`injectDiagramStyles`) was a no-op in the previous implementation.

async function loadMermaid(): Promise<typeof import('mermaid').default> {
  const mod = await import('mermaid');
  const mermaid = mod.default;
  mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'neutral' });
  return mermaid;
}

function prepareArchitectureDiagramSource(content: string): string {
  return content;
}

function injectDiagramStyles(svg: string): string {
  return svg;
}

interface DiagramPreviewProps {
  content: string;
}

let diagramPreviewCounter = 0;

function insertSvgSafely(container: HTMLElement, svg: string): void {
  const template = document.createElement('template');
  template.innerHTML = svg;
  template.content.querySelectorAll('script').forEach((s) => s.remove());
  template.content.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.toLowerCase().startsWith('on')) el.removeAttribute(attr.name);
    });
  });
  container.innerHTML = '';
  container.appendChild(template.content);
  const svgEl = container.querySelector('svg');
  if (svgEl) {
    svgEl.removeAttribute('height');
    svgEl.style.width = '100%';
    svgEl.style.height = 'auto';
    svgEl.style.maxWidth = '100%';
    svgEl.style.overflow = 'visible';
    svgEl.style.display = 'block';
  }
}

export function DiagramPreview({ content }: DiagramPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    const container = containerRef.current;
    const id = `diagram-preview-${++diagramPreviewCounter}`;

    setIsLoading(true);
    setError(null);

    loadMermaid()
      .then(async (mermaid) => {
        const { svg } = await mermaid.render(id, prepareArchitectureDiagramSource(content));
        if (cancelled) return;
        insertSvgSafely(container, injectDiagramStyles(svg));
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to render diagram');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [content]);

  if (isLoading) {
    return (
      <div className="diagram-preview diagram-preview-loading">
        <span className="generating-dot" style={{ display: 'inline-block' }} />
        <span>Rendering diagram…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="diagram-preview diagram-preview-error">
        <strong>Diagram error:</strong> {error}
        <pre className="diagram-preview-raw">{content}</pre>
      </div>
    );
  }

  return <div className="diagram-preview" ref={containerRef} />;
}
