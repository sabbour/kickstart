import React, { useCallback, useEffect, useRef, useState } from 'react';
import { z } from 'zod';
import {
  Body2,
  Button,
  Caption1,
  Card,
  makeStyles,
  mergeClasses,
  shorthands,
  Subtitle2,
  tokens,
} from '@fluentui/react-components';
import type { ComponentContribution } from '@aks-kickstart/harness';
import {
  type DiagramEdge,
  type DiagramNode,
  loadMermaid,
  nodesToMermaid,
  renderArchitectureDiagramSvg,
  sanitizeSvgMarkup,
} from './architectureDiagramUtils.js';
import {
  ARCHITECTURE_DIAGRAM_EMPTY_STATE_ICON_URL,
  ARCHITECTURE_DIAGRAM_HEADER_ICON_URL,
  getArchitectureDiagramIconRegistry,
} from './architectureDiagramIconRegistry.js';

const VIEWPORT_MIN_HEIGHT = 320;
const VIEWPORT_MAX_HEIGHT = 800;
const MIN_SCALE = 0.2;
const MAX_SCALE = 5;
const FLUENT_DIAGRAM_ICON_FILTER =
  'brightness(0) saturate(100%) invert(30%) sepia(91%) saturate(1523%) hue-rotate(191deg) brightness(92%) contrast(88%)';

export const ArchitectureDiagramSchema = z.object({
  diagram: z.string().optional().describe('Mermaid diagram source'),
  nodes: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        type: z.string().optional(),
      })
    )
    .optional()
    .describe('Diagram nodes (used when diagram is not provided)'),
  edges: z
    .array(
      z.object({
        from: z.string(),
        to: z.string(),
        label: z.string().optional(),
      })
    )
    .optional()
    .describe('Diagram edges (used when diagram is not provided)'),
  title: z.string().optional().describe('Diagram title'),
  description: z.string().optional().describe('Diagram description'),
});

type ArchitectureDiagramProps = z.infer<typeof ArchitectureDiagramSchema>;

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    width: '100%',
    overflow: 'hidden',
    padding: 0,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalM,
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalL),
    ...shorthands.borderBottom(tokens.strokeWidthThin, 'solid', tokens.colorNeutralStroke2),
    backgroundColor: tokens.colorNeutralBackground2,
  },
  titleGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
    minWidth: '0',
    flex: '1 1 auto',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    minWidth: '0',
  },
  headerIcon: {
    width: '16px',
    height: '16px',
    flexShrink: 0,
    filter: FLUENT_DIAGRAM_ICON_FILTER,
  },
  title: {
    color: tokens.colorNeutralForeground1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  description: {
    color: tokens.colorNeutralForeground2,
    paddingLeft: `calc(16px + ${tokens.spacingHorizontalXS})`,
  },
  controls: {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalXXS,
    flexShrink: 0,
  },
  controlButton: {
    minWidth: '28px',
    fontSize: tokens.fontSizeBase300,
  },
  actionButton: {
    minWidth: 'fit-content',
  },
  percentage: {
    minWidth: '40px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
    fontFamily: tokens.fontFamilyMonospace,
  },
  diagramArea: {
    padding: tokens.spacingHorizontalXXL,
    backgroundColor: tokens.colorNeutralBackground1,
  },
  viewport: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
    cursor: 'grab',
    userSelect: 'none',
    ...shorthands.border(tokens.strokeWidthThin, 'solid', tokens.colorNeutralStroke2),
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow4,
  },
  viewportGrabbing: {
    cursor: 'grabbing',
  },
  canvas: {
    position: 'absolute',
    top: 0,
    left: 0,
    transformOrigin: '0 0',
  },
  fallback: {
    ...shorthands.padding(tokens.spacingVerticalM, tokens.spacingHorizontalL),
    ...shorthands.border(tokens.strokeWidthThin, 'solid', tokens.colorPaletteRedBorder1),
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorPaletteRedBackground1,
    color: tokens.colorPaletteRedForeground1,
    lineHeight: 1.5,
  },
  fallbackTitle: {
    display: 'block',
    marginBottom: tokens.spacingVerticalXS,
    color: tokens.colorPaletteRedForeground1,
  },
  rawCode: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase300,
    whiteSpace: 'pre-wrap',
    margin: 0,
    overflowX: 'auto',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: tokens.spacingVerticalXS,
    minHeight: '220px',
    ...shorthands.padding(tokens.spacingHorizontalXXL),
    ...shorthands.border(tokens.strokeWidthThin, 'solid', tokens.colorNeutralStroke2),
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground3,
    textAlign: 'center',
  },
  emptyStateIcon: {
    width: '32px',
    height: '32px',
    opacity: 0.72,
    filter: FLUENT_DIAGRAM_ICON_FILTER,
  },
});

let diagramCounter = 0;

function raiseClusterLabels(svg: SVGSVGElement): void {
  const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  overlay.setAttribute('class', 'cluster-label-overlay');
  overlay.setAttribute('pointer-events', 'none');
  svg.appendChild(overlay);
  svg.querySelectorAll('.cluster-label').forEach((el) => overlay.appendChild(el));
}

function insertSvgSafely(container: HTMLElement, svg: string): void {
  const hardened = sanitizeSvgMarkup(svg);
  const template = document.createElement('template');
  template.innerHTML = hardened;
  template.content.querySelectorAll('script').forEach((s) => s.remove());
  template.content.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.toLowerCase().startsWith('on')) el.removeAttribute(attr.name);
    });
  });
  container.innerHTML = '';
  container.appendChild(template.content);
}

function measureSvg(svg: SVGSVGElement): { width: number; height: number } {
  try {
    const bounds = svg.getBBox();
    if (bounds.width > 0 && bounds.height > 0) {
      return { width: bounds.width + bounds.x * 2, height: bounds.height + bounds.y * 2 };
    }
  } catch {
    // fall through to attribute fallback
  }
  const width = parseFloat(svg.getAttribute('width') || '0') || svg.viewBox.baseVal.width || 800;
  const height = parseFloat(svg.getAttribute('height') || '0') || svg.viewBox.baseVal.height || 400;
  return { width, height };
}

export const ArchitectureDiagramRenderer: React.FC<{ props: ArchitectureDiagramProps }> = ({
  props,
}) => {
  const classes = useStyles();
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isRendering, setIsRendering] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(VIEWPORT_MIN_HEIGHT);
  const [renderVersion, setRenderVersion] = useState(0);
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const offsetAtDragStart = useRef({ x: 0, y: 0 });
  const diagramSize = useRef({ width: 0, height: 0 });

  const resolvedDiagram = props.diagram
    ? props.diagram
    : props.nodes && props.edges
      ? nodesToMermaid(props.nodes as DiagramNode[], props.edges as DiagramEdge[])
      : undefined;

  const hasDiagram = Boolean(resolvedDiagram?.trim());
  const headerTitle = props.title || 'Solution Architecture';

  const resolveIconUrl = useCallback((key: string) => {
    return getArchitectureDiagramIconRegistry().get(key.toLowerCase()) ?? null;
  }, []);

  const fitAndCenter = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || diagramSize.current.width === 0 || diagramSize.current.height === 0) return;
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight || viewportHeight;
    const { width, height } = diagramSize.current;
    const fitScale = Math.min((vw - 48) / width, (vh - 48) / height, 1);
    const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, fitScale));
    setScale(clampedScale);
    setOffset({
      x: Math.max(0, (vw - width * clampedScale) / 2),
      y: Math.max(0, (vh - height * clampedScale) / 2),
    });
  }, [viewportHeight]);

  useEffect(() => {
    if (!hasDiagram || !resolvedDiagram || !containerRef.current) return;
    let cancelled = false;
    const container = containerRef.current;
    const id = `aks-diagram-${++diagramCounter}`;
    setIsRendering(true);

    loadMermaid()
      .then(async (mermaid) => {
        const svgMarkup = await renderArchitectureDiagramSvg(
          mermaid.render.bind(mermaid),
          id,
          resolvedDiagram,
          resolveIconUrl
        );
        if (cancelled) return;
        insertSvgSafely(container, svgMarkup);
        const svg = container.querySelector('svg');
        if (svg instanceof SVGSVGElement) {
          raiseClusterLabels(svg);
          const { width, height } = measureSvg(svg);
          diagramSize.current = { width, height };
          setViewportHeight(Math.min(VIEWPORT_MAX_HEIGHT, Math.max(VIEWPORT_MIN_HEIGHT, height + 48)));
          svg.removeAttribute('height');
          svg.setAttribute('width', String(width));
          svg.style.maxWidth = 'none';
          svg.style.height = 'auto';
          svg.style.overflow = 'visible';
        }
        setRenderError(null);
        requestAnimationFrame(() => { if (!cancelled) fitAndCenter(); });
      })
      .catch((err) => {
        if (!cancelled) setRenderError(err instanceof Error ? err.message : 'Failed to render diagram');
      })
      .finally(() => { if (!cancelled) setIsRendering(false); });

    return () => { cancelled = true; };
  }, [fitAndCenter, hasDiagram, renderVersion, resolveIconUrl, resolvedDiagram]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((s) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s * factor)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    dragging.current = true;
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    offsetAtDragStart.current = { ...offset };
  }, [offset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    setOffset({
      x: offsetAtDragStart.current.x + (e.clientX - dragStart.current.x),
      y: offsetAtDragStart.current.y + (e.clientY - dragStart.current.y),
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    dragging.current = false;
    setIsDragging(false);
  }, []);

  return (
    <Card appearance="outline" className={classes.root}>
      <div className={classes.header}>
        <div className={classes.titleGroup}>
          <div className={classes.titleRow}>
            <img src={ARCHITECTURE_DIAGRAM_HEADER_ICON_URL} alt="" className={classes.headerIcon} />
            <Subtitle2 className={classes.title}>{headerTitle}</Subtitle2>
          </div>
          {props.description && <Body2 className={classes.description}>{props.description}</Body2>}
        </div>
        <div className={classes.controls} role="group" aria-label="Architecture diagram controls">
          <Button type="button" size="small" appearance="subtle" className={classes.controlButton}
            onClick={() => setScale((s) => Math.max(MIN_SCALE, s * 0.8))} aria-label="Zoom out">−</Button>
          <Caption1 className={classes.percentage}>{Math.round(scale * 100)}%</Caption1>
          <Button type="button" size="small" appearance="subtle" className={classes.controlButton}
            onClick={() => setScale((s) => Math.min(MAX_SCALE, s * 1.2))} aria-label="Zoom in">+</Button>
          <Button type="button" size="small" appearance="transparent"
            className={mergeClasses(classes.controlButton, classes.actionButton)}
            onClick={fitAndCenter} aria-label="Reset view">Reset</Button>
          <Button type="button" size="small" appearance="transparent"
            className={mergeClasses(classes.controlButton, classes.actionButton)}
            onClick={() => setRenderVersion((v) => v + 1)}
            disabled={isRendering || !hasDiagram}>
            {isRendering ? 'Rendering' : 'Regenerate'}
          </Button>
        </div>
      </div>

      <div className={classes.diagramArea}>
        {renderError ? (
          <div className={classes.fallback}>
            <Caption1 className={classes.fallbackTitle}>Diagram error: {renderError}</Caption1>
            {resolvedDiagram && <pre className={classes.rawCode}>{resolvedDiagram}</pre>}
          </div>
        ) : hasDiagram ? (
          <div
            ref={viewportRef}
            className={mergeClasses(classes.viewport, isDragging && classes.viewportGrabbing)}
            style={{ height: `${viewportHeight}px` }}
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div
              ref={containerRef}
              className={classes.canvas}
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                transition: isDragging ? 'none' : 'transform 0.1s ease-out',
              }}
            />
          </div>
        ) : (
          <div className={classes.emptyState}>
            <img src={ARCHITECTURE_DIAGRAM_EMPTY_STATE_ICON_URL} alt="" className={classes.emptyStateIcon} />
            <Body2>Architecture diagram will appear here as you design your solution.</Body2>
          </div>
        )}
      </div>
    </Card>
  );
};

export const architectureDiagramContribution: ComponentContribution = {
  name: 'aks/ArchitectureDiagram',
  propertySchema: ArchitectureDiagramSchema,
  renderer: ArchitectureDiagramRenderer,
};
