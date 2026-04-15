import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema } from '../../vendor/a2ui/web_core/schema/common-types';
import {
  Body2,
  Caption1,
  Card,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { getDiagramIconRegistry } from '@sabbour/adaptive-ui-core';
import { registerAzureDiagramIcons } from '@sabbour/adaptive-ui-azure-pack/diagram-icons';
import buildingCloudIcon from '@sabbour/adaptive-ui-core/icons/fluent/building-cloud.svg?url';
import designIdeasIcon from '@sabbour/adaptive-ui-core/icons/fluent/design-ideas.svg?url';
import {
  DiagramEdge,
  DiagramNode,
  nodesToMermaid,
  renderArchitectureDiagramSvg,
} from './architectureDiagramUtils';

const AZURE = {
  themePrimary: '#0078d4',
  neutralPrimary: '#292827',
  neutralSecondary: '#646464',
  neutralTertiaryAlt: '#a19f9d',
  neutralLight: '#e1dfdd',
  neutralLighter: '#f3f2f1',
  neutralLighterAlt: '#faf9f8',
  white: '#ffffff',
  fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
} as const;

const VIEWPORT_MIN_HEIGHT = 320;
const VIEWPORT_MAX_HEIGHT = 800;
const MIN_SCALE = 0.2;
const MAX_SCALE = 5;

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
    backgroundColor: '#ffffff',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: tokens.spacingHorizontalM,
    padding: '14px 20px',
    borderBottomWidth: tokens.strokeWidthThin,
    borderBottomStyle: 'solid',
    borderBottomColor: '#e1dfdd',
    backgroundColor: '#faf9f8',
    letterSpacing: '0.01em',
  },
  titleGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
    minWidth: '0',
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
    filter: 'brightness(0) saturate(100%) invert(28%) sepia(98%) saturate(1624%) hue-rotate(196deg) brightness(96%) contrast(101%)',
  },
  title: {
    fontSize: '16px',
    fontWeight: 600,
    lineHeight: '22px',
    color: '#292827',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  description: {
    color: '#646464',
    marginLeft: '24px',
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flexShrink: 0,
  },
  controlButton: {
    width: '28px',
    height: '28px',
    border: '1px solid #e1dfdd',
    borderRadius: '2px',
    backgroundColor: '#ffffff',
    color: '#646464',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    lineHeight: 1,
    padding: 0,
    ':disabled': {
      cursor: 'not-allowed',
      opacity: 0.6,
    },
  },
  actionButton: {
    minWidth: '0',
    width: 'auto',
    paddingLeft: '8px',
    paddingRight: '8px',
    fontSize: '12px',
  },
  percentage: {
    minWidth: '36px',
    textAlign: 'center',
    fontSize: '11px',
    lineHeight: '16px',
    color: '#646464',
    fontFamily: tokens.fontFamilyMonospace,
  },
  diagramArea: {
    padding: '24px',
    backgroundColor: '#ffffff',
  },
  viewport: {
    width: '100%',
    overflow: 'hidden',
    position: 'relative',
    cursor: 'grab',
    userSelect: 'none',
    border: '1px solid #e1dfdd',
    backgroundColor: '#ffffff',
    boxShadow: '0 1.6px 3.6px rgba(0,0,0,0.132), 0 0.3px 0.9px rgba(0,0,0,0.108)',
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
    padding: '16px 20px',
    backgroundColor: '#fdd8db',
    border: '1px solid #a4262c',
    borderRadius: '2px',
    color: '#a4262c',
    lineHeight: 1.5,
  },
  fallbackTitle: {
    display: 'block',
    marginBottom: tokens.spacingVerticalXS,
    color: '#a4262c',
  },
  rawCode: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: '12px',
    lineHeight: '18px',
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
    color: '#646464',
    textAlign: 'center',
  },
  emptyStateIcon: {
    width: '32px',
    height: '32px',
    opacity: 0.5,
    filter: 'brightness(0) saturate(100%) invert(28%) sepia(98%) saturate(1624%) hue-rotate(196deg) brightness(96%) contrast(101%)',
  },
});

type MermaidModule = typeof import('mermaid');
type MermaidApi = MermaidModule['default'];

let mermaidPromise: Promise<MermaidApi> | null = null;
let iconsRegistered = false;
let diagramCounter = 0;

function ensureDiagramIconsRegistered() {
  if (!iconsRegistered) {
    registerAzureDiagramIcons();
    iconsRegistered = true;
  }
}

function loadMermaid(): Promise<MermaidApi> {
  if (!mermaidPromise) {
    mermaidPromise = Promise.all([
      import('mermaid'),
      import('@mermaid-js/layout-elk'),
    ])
      .then(([mermaidModule, elkModule]) => {
        const mermaid = mermaidModule.default as MermaidApi & {
          registerLayoutLoaders?: (loaders: unknown) => void;
        };

        mermaid.registerLayoutLoaders?.(elkModule.default);
        mermaid.initialize({
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
            defaultRenderer: 'elk',
          },
        });

        return mermaid;
      })
      .catch((error) => {
        mermaidPromise = null;
        throw error;
      });
  }

  return mermaidPromise;
}

function raiseClusterLabels(svg: SVGSVGElement): void {
  const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  overlay.setAttribute('class', 'cluster-label-overlay');
  overlay.setAttribute('pointer-events', 'none');
  svg.appendChild(overlay);

  svg.querySelectorAll('.cluster-label').forEach((element) => {
    overlay.appendChild(element);
  });
}

function insertSvgSafely(container: HTMLElement, svg: string): void {
  const template = document.createElement('template');
  template.innerHTML = svg;

  template.content.querySelectorAll('script').forEach((script) => script.remove());
  template.content.querySelectorAll('*').forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      if (attribute.name.toLowerCase().startsWith('on')) {
        element.removeAttribute(attribute.name);
      }
    });
  });

  container.innerHTML = '';
  container.appendChild(template.content);
}

function measureSvg(svg: SVGSVGElement): { width: number; height: number } {
  try {
    const bounds = svg.getBBox();
    if (bounds.width > 0 && bounds.height > 0) {
      return {
        width: bounds.width + bounds.x * 2,
        height: bounds.height + bounds.y * 2,
      };
    }
  } catch {
    // Ignore measurement fallback and use the SVG viewBox/attributes below.
  }

  const width = parseFloat(svg.getAttribute('width') || '0') || svg.viewBox.baseVal.width || 800;
  const height = parseFloat(svg.getAttribute('height') || '0') || svg.viewBox.baseVal.height || 400;
  return { width, height };
}

export const ArchitectureDiagram = createReactComponent(ArchitectureDiagramApi, ({ props }) => {
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
    ensureDiagramIconsRegistered();
    return getDiagramIconRegistry().get(key) ?? null;
  }, []);

  const fitAndCenter = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport || diagramSize.current.width === 0 || diagramSize.current.height === 0) {
      return;
    }

    const viewportWidth = viewport.clientWidth;
    const viewportHeightValue = viewport.clientHeight || viewportHeight;
    const { width, height } = diagramSize.current;
    const fitScale = Math.min((viewportWidth - 48) / width, (viewportHeightValue - 48) / height, 1);
    const clampedScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, fitScale));
    const scaledWidth = width * clampedScale;
    const scaledHeight = height * clampedScale;

    setScale(clampedScale);
    setOffset({
      x: Math.max(0, (viewportWidth - scaledWidth) / 2),
      y: Math.max(0, (viewportHeightValue - scaledHeight) / 2),
    });
  }, [viewportHeight]);

  useEffect(() => {
    if (!hasDiagram || !resolvedDiagram || !containerRef.current) {
      return;
    }

    let cancelled = false;
    const container = containerRef.current;
    const id = `mermaid-diagram-${++diagramCounter}`;

    setIsRendering(true);

    loadMermaid()
      .then(async (mermaid) => {
        const svgMarkup = await renderArchitectureDiagramSvg(
          mermaid.render.bind(mermaid),
          id,
          resolvedDiagram,
          resolveIconUrl,
        );

        if (cancelled) {
          return;
        }

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
        requestAnimationFrame(() => {
          if (!cancelled) {
            fitAndCenter();
          }
        });
      })
      .catch((error) => {
        if (!cancelled) {
          setRenderError(error instanceof Error ? error.message : 'Failed to render diagram');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsRendering(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fitAndCenter, hasDiagram, renderVersion, resolveIconUrl, resolvedDiagram]);

  const handleWheel = useCallback((event: React.WheelEvent) => {
    event.preventDefault();
    const factor = event.deltaY > 0 ? 0.9 : 1.1;
    setScale((currentScale) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, currentScale * factor)));
  }, []);

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (event.button !== 0) {
      return;
    }

    dragging.current = true;
    setIsDragging(true);
    dragStart.current = { x: event.clientX, y: event.clientY };
    offsetAtDragStart.current = { ...offset };
  }, [offset]);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!dragging.current) {
      return;
    }

    setOffset({
      x: offsetAtDragStart.current.x + (event.clientX - dragStart.current.x),
      y: offsetAtDragStart.current.y + (event.clientY - dragStart.current.y),
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    dragging.current = false;
    setIsDragging(false);
  }, []);

  const zoomOut = () => setScale((currentScale) => Math.max(MIN_SCALE, currentScale * 0.8));
  const zoomIn = () => setScale((currentScale) => Math.min(MAX_SCALE, currentScale * 1.2));
  const resetView = () => fitAndCenter();
  const regenerateDiagram = () => setRenderVersion((currentVersion) => currentVersion + 1);

  return (
    <Card className={classes.root}>
      <div className={classes.header}>
        <div className={classes.titleGroup}>
          <div className={classes.titleRow}>
            <img src={buildingCloudIcon} alt="" className={classes.headerIcon} />
            <div className={classes.title}>{headerTitle}</div>
          </div>
          {props.description && <Body2 className={classes.description}>{props.description}</Body2>}
        </div>
        <div className={classes.controls}>
          <button type="button" className={classes.controlButton} onClick={zoomOut} aria-label="Zoom out" title="Zoom out">
            −
          </button>
          <div className={classes.percentage}>{Math.round(scale * 100)}%</div>
          <button type="button" className={classes.controlButton} onClick={zoomIn} aria-label="Zoom in" title="Zoom in">
            +
          </button>
          <button type="button" className={`${classes.controlButton} ${classes.actionButton}`} onClick={resetView} aria-label="Reset view" title="Reset view">
            Reset
          </button>
          <button
            type="button"
            className={`${classes.controlButton} ${classes.actionButton}`}
            onClick={regenerateDiagram}
            aria-label="Regenerate layout"
            title="Regenerate layout"
            disabled={isRendering || !hasDiagram}
          >
            {isRendering ? 'Rendering' : 'Regenerate'}
          </button>
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
            className={`${classes.viewport} ${isDragging ? classes.viewportGrabbing : ''}`}
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
            <img src={designIdeasIcon} alt="" className={classes.emptyStateIcon} />
            <Body2>Architecture diagram will appear here as you design your solution.</Body2>
          </div>
        )}
      </div>
    </Card>
  );
});
