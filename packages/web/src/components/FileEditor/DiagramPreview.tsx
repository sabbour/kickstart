import React, { useEffect, useRef, useState } from 'react';
import {
  loadMermaid,
  prepareArchitectureDiagramSource,
  injectDiagramStyles,
} from '../../catalog/components/architectureDiagramUtils';

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
      .catch((err) => {
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
