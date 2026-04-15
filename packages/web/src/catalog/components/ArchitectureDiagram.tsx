import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema } from '../../vendor/a2ui/web_core/schema/common-types';
import {
  Body2,
  Button,
  Caption1,
  Card,
  Subtitle1,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  ZoomInRegular,
  ZoomOutRegular,
  ArrowResetRegular,
} from '@fluentui/react-icons';

// Azure Portal color constants for Mermaid config (aligned with try-aks reference)
const AZURE = {
  themePrimary: '#0078d4',
  neutralPrimary: '#292827',
  neutralSecondary: '#646464',
  neutralTertiaryAlt: '#a19f9d',
  neutralLighter: '#f3f2f1',
  neutralLight: '#e1dfdd',
  neutralLighterAlt: '#faf9f8',
  white: '#ffffff',
  fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
} as const;

// Icon keyword mapping — keys are lowercase search terms, values are icon filenames
const ICON_MAP: Array<{ keywords: string[]; icon: string }> = [
  { keywords: ['aks', 'kubernetes', 'k8s'], icon: 'cloud-cube.svg' },
  { keywords: ['container', 'docker', 'pod'], icon: 'cube.svg' },
  { keywords: ['database', 'db', 'sql', 'cosmos', 'postgres', 'mysql', 'mongo'], icon: 'database.svg' },
  { keywords: ['api', 'gateway', 'endpoint', 'rest'], icon: 'globe.svg' },
  { keywords: ['storage', 'blob', 'file', 'disk'], icon: 'cloud-archive.svg' },
  { keywords: ['user', 'client', 'browser', 'customer'], icon: 'person.svg' },
  { keywords: ['monitor', 'log', 'telemetry', 'insight', 'observ'], icon: 'desktop-pulse.svg' },
  { keywords: ['network', 'vnet', 'subnet', 'dns', 'private endpoint'], icon: 'network-check.svg' },
  { keywords: ['security', 'auth', 'key vault', 'keyvault', 'identity', 'rbac'], icon: 'lock-shield.svg' },
  { keywords: ['key', 'secret', 'certificate', 'cert'], icon: 'key.svg' },
  { keywords: ['load balancer', 'traffic', 'ingress', 'balancer'], icon: 'arrow-split.svg' },
  { keywords: ['registry', 'acr', 'image registry'], icon: 'box-multiple.svg' },
  { keywords: ['cloud', 'azure'], icon: 'cloud.svg' },
];

function matchIcon(label: string): string | null {
  const lower = label.toLowerCase();
  for (const entry of ICON_MAP) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return entry.icon;
    }
  }
  return null;
}

const VIEWPORT_MIN_HEIGHT = 300;
const VIEWPORT_MAX_HEIGHT = 800;

const NodeSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.string().optional(),
});

const EdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string().optional(),
});

type DiagramNode = z.infer<typeof NodeSchema>;
type DiagramEdge = z.infer<typeof EdgeSchema>;

/** Map node type to Mermaid shape syntax */
function nodeToMermaid(node: DiagramNode): string {
  const escaped = node.label.replace(/"/g, '#quot;');
  switch (node.type) {
    case 'database':
      return `  ${node.id}[("${escaped}")]`;
    case 'network':
      return `  ${node.id}{{"${escaped}"}}`;
    case 'messaging':
      return `  ${node.id}[/"${escaped}"/]`;
    case 'storage':
      return `  ${node.id}[["${escaped}"]]`;
    case 'compute':
    default:
      return `  ${node.id}["${escaped}"]`;
  }
}

/** Convert structured nodes/edges to a Mermaid flowchart string */
function nodesToMermaid(nodes: DiagramNode[], edges: DiagramEdge[]): string {
  const lines: string[] = ['graph TD'];
  for (const node of nodes) {
    lines.push(nodeToMermaid(node));
  }
  for (const edge of edges) {
    if (edge.label) {
      lines.push(`  ${edge.from} -->|${edge.label}| ${edge.to}`);
    } else {
      lines.push(`  ${edge.from} --> ${edge.to}`);
    }
  }
  return lines.join('\n');
}

const ArchitectureDiagramApi = {
  name: 'ArchitectureDiagram',
  schema: z.object({
    diagram: DynamicStringSchema.optional(),
    nodes: z.array(NodeSchema).optional(),
    edges: z.array(EdgeSchema).optional(),
    title: DynamicStringSchema.optional(),
    description: DynamicStringSchema.optional(),
  }),
};

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    width: '100%',
    overflow: 'hidden',
    padding: '0',
  },
  header: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderBottomWidth: tokens.strokeWidthThin,
    borderBottomStyle: 'solid',
    borderBottomColor: '#e1dfdd',
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    backgroundColor: '#faf9f8',
    fontSize: '13px',
    fontWeight: '600',
    color: '#292827',
    letterSpacing: '0.01em',
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalXS,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
    backgroundColor: tokens.colorNeutralBackground2,
    borderBottomWidth: tokens.strokeWidthThin,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
  },
  viewport: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
    cursor: 'grab',
    backgroundColor: tokens.colorNeutralBackground1,
    userSelect: 'none',
    boxShadow: '0 1.6px 3.6px rgba(0,0,0,0.132), 0 0.3px 0.9px rgba(0,0,0,0.108)',
    border: '1px solid #e1dfdd',
  },
  viewportGrabbing: {
    cursor: 'grabbing',
  },
  canvas: {
    position: 'absolute',
    top: '0',
    left: '0',
    transformOrigin: '0 0',
  },
  fallback: {
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  fallbackLabel: {
    color: tokens.colorNeutralForeground3,
    marginBottom: tokens.spacingVerticalXS,
  },
  rawCode: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: '12px',
    lineHeight: '18px',
    whiteSpace: 'pre-wrap',
    color: tokens.colorNeutralForeground1,
    margin: '0',
    overflowX: 'auto',
  },
});

let mermaidInstance: typeof import('mermaid') | null = null;
let mermaidLoading = false;
let mermaidCallbacks: Array<(m: typeof import('mermaid')) => void> = [];

function loadMermaid(): Promise<typeof import('mermaid')> {
  return new Promise((resolve) => {
    if (mermaidInstance) {
      resolve(mermaidInstance);
      return;
    }
    mermaidCallbacks.push(resolve);
    if (!mermaidLoading) {
      mermaidLoading = true;
      import('mermaid').then((m) => {
        m.default.initialize({
          startOnLoad: false,
          theme: 'base',
          securityLevel: 'antiscript',
          fontFamily: AZURE.fontFamily,
          themeVariables: {
            primaryColor: AZURE.white,
            primaryBorderColor: AZURE.themePrimary,
            primaryTextColor: AZURE.neutralPrimary,
            lineColor: AZURE.neutralTertiaryAlt,
            secondaryColor: AZURE.neutralLighter,
            secondaryBorderColor: AZURE.neutralLight,
            tertiaryColor: AZURE.neutralLighterAlt,
            fontSize: '13px',
            fontFamily: AZURE.fontFamily,
            background: AZURE.white,
            mainBkg: AZURE.white,
            nodeBorder: AZURE.themePrimary,
            clusterBkg: AZURE.neutralLighter,
            clusterBorder: AZURE.neutralLight,
            titleColor: AZURE.neutralPrimary,
            edgeLabelBackground: AZURE.white,
          },
          flowchart: {
            htmlLabels: true,
            curve: 'basis',
            padding: 12,
            nodeSpacing: 80,
            rankSpacing: 90,
            useMaxWidth: false,
          },
        });
        mermaidInstance = m;
        const cbs = mermaidCallbacks;
        mermaidCallbacks = [];
        cbs.forEach((cb) => cb(m));
      });
    }
  });
}

/** Raise cluster labels above edges so they aren't occluded. */
function raiseClusterLabels(svg: SVGSVGElement): void {
  const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  overlay.setAttribute('class', 'cluster-label-overlay');
  overlay.setAttribute('pointer-events', 'none');
  svg.appendChild(overlay);
  svg.querySelectorAll('.cluster-label').forEach((el) => overlay.appendChild(el));
}

/**
 * Sanitize a raw Mermaid diagram string from an untrusted source (LLM output).
 *
 * Uses single-character encoding rather than multi-character removal to avoid
 * the incomplete-multi-character-sanitization class of bypass (e.g. a nested
 * tag like `<sc<x>ript>` that reassembles after stripping `<x>`).
 *
 * Strategy: preserve `<br/>` (needed for multi-line node labels) via a null-
 * byte placeholder, then encode every remaining `<` to `&lt;`.  Once `<` is
 * encoded, no HTML tag — and therefore no event handler or dangerous URI in
 * an attribute value — can reach Mermaid's htmlLabels renderer.
 *
 * Note: `<-->` bidirectional Mermaid arrows are not used in `graph TD`
 * architecture diagrams, so encoding `<` has no practical syntax impact.
 */
function sanitizeDiagramInput(source: string): string {
  const BR = '\u0000BR\u0000';
  return source
    .replace(/<br\s*\/?>/gi, BR)   // protect <br/> — needed for multi-line labels
    .replace(/</g, '&lt;')         // encode all other '<' (single-char, no bypass risk)
    .replace(new RegExp(BR, 'g'), '<br/>');
}

/**
 * Safely insert a Mermaid-rendered SVG string into a container element.
 *
 * Uses an inert <template> element to parse without script execution or
 * resource loading, then walks the resulting DOM to strip any remaining
 * event-handler attributes and <script> elements before appending to the
 * live document.
 */
function insertSvgSafely(container: HTMLElement, svg: string): void {
  const tpl = document.createElement('template');
  tpl.innerHTML = svg;

  // Strip <script> elements
  tpl.content.querySelectorAll('script').forEach((s) => s.remove());

  // Strip on* event-handler attributes from every element
  tpl.content.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.toLowerCase().startsWith('on')) {
        el.removeAttribute(attr.name);
      }
    });
  });

  container.innerHTML = '';
  container.appendChild(tpl.content);
}


function preprocessDiagram(source: string): string {
  let processed = source;
  // Wrap unquoted bracket labels containing parens in quotes
  processed = processed.replace(
    /\[([^\]"]*\([^\]]*)\]/g,
    (_match, label) => `["${label}"]`,
  );
  // HTML-encode parentheses inside quoted bracket labels
  processed = processed.replace(
    /\["([^"]*)"\]/g,
    (_match, label: string) => `["${label.split('(').join('&#40;').split(')').join('&#41;')}"]`,
  );
  // Fix subgraph labels with parens
  processed = processed.replace(
    /subgraph\s+(\w+)\[([^\]"]*\([^\]]*)\]/g,
    (_match, id, label: string) =>
      `subgraph ${id}["${label.split('(').join('&#40;').split(')').join('&#41;')}"]`,
  );
  return processed;
}

/** Post-process the rendered SVG: embed try-aks CSS styles, inject icons, raise cluster labels. */
function postProcessSvg(svgEl: SVGSVGElement): void {
  // Embed try-aks CSS rules as a <style> element in the SVG
  const styleEl = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  styleEl.textContent = `
    .cluster rect {
      rx: 0 !important;
      ry: 0 !important;
      stroke-dasharray: none !important;
      fill: #f3f2f1 !important;
      stroke: #e1dfdd !important;
      stroke-width: 1 !important;
    }
    .cluster-label {
      overflow: visible !important;
      white-space: nowrap;
      font-weight: 600;
      font-size: 15px;
      color: #646464;
      padding-top: 13px;
    }
    .edge path, .flowchart-link {
      stroke-width: 1.5;
      stroke: #a19f9d;
    }
    .edgeLabel {
      font-family: 'Segoe UI Light';
      font-size: 13px;
      background-color: #ffffff;
      padding: 2px 6px;
      color: #646464;
    }
    .nodeLabel, .node .label {
      font-family: 'Segoe UI';
      font-weight: 500;
      text-align: center;
    }
    .node rect {
      filter: drop-shadow(0 1px 2px rgba(0,0,0,0.06));
      stroke-width: 1.5;
    }
  `;
  svgEl.insertBefore(styleEl, svgEl.firstChild);

  // Inject Fluent icons into matching nodes
  svgEl.querySelectorAll('.node').forEach((nodeGroup) => {
    const labelEl = nodeGroup.querySelector('.nodeLabel, .label');
    if (!labelEl) return;
    const labelText = labelEl.textContent?.trim() || '';
    const iconFile = matchIcon(labelText);
    if (!iconFile) return;

    const iconUrl = `/assets/icons/fluent/${iconFile}`;
    const ICON_SIZE = 18;
    const ICON_PADDING = 4;

    const rect = nodeGroup.querySelector('rect');
    if (!rect) return;

    const rectX = parseFloat(rect.getAttribute('x') || '0');
    const rectY = parseFloat(rect.getAttribute('y') || '0');
    const rectH = parseFloat(rect.getAttribute('height') || '0');

    const iconX = rectX + ICON_PADDING + 4;
    const iconY = rectY + (rectH - ICON_SIZE) / 2;

    const ns = 'http://www.w3.org/2000/svg';
    const xlinkNs = 'http://www.w3.org/1999/xlink';
    const imageEl = document.createElementNS(ns, 'image');
    imageEl.setAttributeNS(xlinkNs, 'href', iconUrl);
    imageEl.setAttribute('x', String(iconX));
    imageEl.setAttribute('y', String(iconY));
    imageEl.setAttribute('width', String(ICON_SIZE));
    imageEl.setAttribute('height', String(ICON_SIZE));
    imageEl.setAttribute('class', 'fluent-icon');
    nodeGroup.insertBefore(imageEl, nodeGroup.firstChild);

    const rectW = parseFloat(rect.getAttribute('width') || '0');
    const extraWidth = ICON_SIZE + ICON_PADDING * 2;
    rect.setAttribute('width', String(rectW + extraWidth));
    rect.setAttribute('x', String(rectX - extraWidth / 2));

    const foreignObj = nodeGroup.querySelector('foreignObject');
    if (foreignObj) {
      const foX = parseFloat(foreignObj.getAttribute('x') || '0');
      foreignObj.setAttribute('x', String(foX + extraWidth / 2));
    }
    imageEl.setAttribute('x', String(rectX - extraWidth / 2 + ICON_PADDING + 4));
  });

  // Raise cluster labels above edges
  raiseClusterLabels(svgEl);
}

let diagramCounter = 0;

export const ArchitectureDiagram = createReactComponent(ArchitectureDiagramApi, ({ props }) => {
  const classes = useStyles();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const offsetAtDragStart = useRef({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(VIEWPORT_MIN_HEIGHT);
  const diagramSize = useRef({ width: 0, height: 0 });

  // Resolve diagram string: use `diagram` prop directly, or convert nodes/edges
  const resolvedDiagram = props.diagram
    ? props.diagram
    : props.nodes && props.edges
      ? nodesToMermaid(props.nodes, props.edges)
      : undefined;

  /** Fit the diagram to the viewport width and center it. */
  const fitAndCenter = useCallback(() => {
    const viewportEl = viewportRef.current;
    if (!viewportEl || diagramSize.current.width === 0) return;

    const vw = viewportEl.clientWidth;
    const vh = viewportEl.clientHeight || viewportHeight;
    const dw = diagramSize.current.width;
    const dh = diagramSize.current.height;

    // Scale to fit width, but cap so the diagram isn't too large vertically
    const fitScale = Math.min(vw / dw, vh / dh, 1.5);
    const clampedScale = Math.max(0.3, Math.min(3, fitScale));

    // Center the diagram in the viewport
    const scaledW = dw * clampedScale;
    const scaledH = dh * clampedScale;
    const cx = Math.max(0, (vw - scaledW) / 2);
    const cy = Math.max(0, (vh - scaledH) / 2);

    setScale(clampedScale);
    setOffset({ x: cx, y: cy });
  }, [viewportHeight]);

  useEffect(() => {
    if (!resolvedDiagram || !containerRef.current) return;

    const container = containerRef.current;
    const id = `mermaid-diagram-${++diagramCounter}`;

    loadMermaid().then(async (m) => {
      try {
        const { svg } = await m.default.render(id, preprocessDiagram(sanitizeDiagramInput(resolvedDiagram)));
        if (container) {
          insertSvgSafely(container, svg);
          const svgEl = container.querySelector('svg');
          if (svgEl) {
            // Post-process for Fluent 2 styling and icons
            postProcessSvg(svgEl);

            // Measure natural SVG dimensions for auto-sizing
            const bbox = svgEl.getBBox();
            const svgW = bbox.width + bbox.x * 2 || svgEl.viewBox?.baseVal?.width || 800;
            const svgH = bbox.height + bbox.y * 2 || svgEl.viewBox?.baseVal?.height || 400;
            diagramSize.current = { width: svgW, height: svgH };

            // Auto-size viewport height
            const naturalH = Math.min(VIEWPORT_MAX_HEIGHT, Math.max(VIEWPORT_MIN_HEIGHT, svgH + 40));
            setViewportHeight(naturalH);

            // Make SVG fill its container
            svgEl.removeAttribute('height');
            svgEl.setAttribute('width', String(svgW));
            svgEl.style.maxWidth = 'none';
            svgEl.style.height = 'auto';
            svgEl.style.overflow = 'visible';
          }
          setRenderError(false);

          // Defer fit-and-center so viewport has the updated height
          requestAnimationFrame(() => {
            fitAndCenter();
          });
        }
      } catch {
        setRenderError(true);
      }
    });
  }, [resolvedDiagram, fitAndCenter]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((s) => Math.min(3, Math.max(0.3, s + delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    offsetAtDragStart.current = { ...offset };
  }, [offset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setOffset({
      x: offsetAtDragStart.current.x + dx,
      y: offsetAtDragStart.current.y + dy,
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    dragging.current = false;
    setIsDragging(false);
  }, []);

  const zoomIn = () => setScale((s) => Math.min(3, s + 0.2));
  const zoomOut = () => setScale((s) => Math.max(0.3, s - 0.2));
  const resetView = () => fitAndCenter();

  return (
    <Card className={classes.root}>
      {(props.title || props.description) && (
        <div className={classes.header}>
          {props.title && <Subtitle1>{props.title}</Subtitle1>}
          {props.description && <Body2>{props.description}</Body2>}
        </div>
      )}

      {renderError ? (
        <div className={classes.fallback}>
          <Caption1 className={classes.fallbackLabel}>
            Diagram rendering unavailable — raw Mermaid source:
          </Caption1>
          <pre className={classes.rawCode}>{resolvedDiagram}</pre>
        </div>
      ) : (
        <>
          <div className={classes.toolbar}>
            <Button appearance="subtle" size="small" icon={<ZoomInRegular />} onClick={zoomIn} title="Zoom in" />
            <Button appearance="subtle" size="small" icon={<ZoomOutRegular />} onClick={zoomOut} title="Zoom out" />
            <Button appearance="subtle" size="small" icon={<ArrowResetRegular />} onClick={resetView} title="Reset view" />
            <Caption1>{Math.round(scale * 100)}%</Caption1>
          </div>
          <div
            ref={viewportRef}
            className={`${classes.viewport} ${isDragging ? classes.viewportGrabbing : ''}`}
            style={{ height: `${viewportHeight}px` }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div
              className={classes.canvas}
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              }}
              ref={containerRef}
            />
          </div>
        </>
      )}
    </Card>
  );
});
