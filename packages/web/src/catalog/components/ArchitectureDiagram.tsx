import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema } from '../../vendor/a2ui/web_core/schema/common-types';
import {
  Body1,
  Body2,
  Button,
  Caption1,
  Card,
  Subtitle2,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  ZoomInRegular,
  ZoomOutRegular,
  ArrowResetRegular,
} from '@fluentui/react-icons';

const ArchitectureDiagramApi = {
  name: 'ArchitectureDiagram',
  schema: z.object({
    diagram: DynamicStringSchema,
    title: DynamicStringSchema.optional(),
    description: DynamicStringSchema.optional(),
  }).strict(),
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
    borderBottomColor: tokens.colorNeutralStroke2,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
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
    height: '400px',
    overflow: 'hidden',
    position: 'relative',
    cursor: 'grab',
    backgroundColor: tokens.colorNeutralBackground1,
    userSelect: 'none',
  },
  viewportGrabbing: {
    cursor: 'grabbing',
  },
  canvas: {
    position: 'absolute',
    top: '0',
    left: '0',
    transformOrigin: '0 0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '100%',
    minHeight: '100%',
    padding: tokens.spacingHorizontalL,
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
          theme: 'neutral',
          securityLevel: 'loose',
          fontFamily: 'inherit',
        });
        mermaidInstance = m;
        const cbs = mermaidCallbacks;
        mermaidCallbacks = [];
        cbs.forEach((cb) => cb(m));
      });
    }
  });
}

let diagramCounter = 0;

export const ArchitectureDiagram = createReactComponent(ArchitectureDiagramApi, ({ props }) => {
  const classes = useStyles();
  const containerRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const offsetAtDragStart = useRef({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!props.diagram || !containerRef.current) return;

    const container = containerRef.current;
    const id = `mermaid-diagram-${++diagramCounter}`;

    loadMermaid().then(async (m) => {
      try {
        const { svg } = await m.default.render(id, props.diagram);
        if (container) {
          container.innerHTML = svg;
          // Make the SVG responsive
          const svgEl = container.querySelector('svg');
          if (svgEl) {
            svgEl.style.maxWidth = '100%';
            svgEl.style.height = 'auto';
          }
          setRenderError(false);
        }
      } catch {
        setRenderError(true);
      }
    });
  }, [props.diagram]);

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
  const resetView = () => { setScale(1); setOffset({ x: 0, y: 0 }); };

  return (
    <Card className={classes.root}>
      {(props.title || props.description) && (
        <div className={classes.header}>
          {props.title && <Subtitle2>{props.title}</Subtitle2>}
          {props.description && <Body2>{props.description}</Body2>}
        </div>
      )}

      {renderError ? (
        <div className={classes.fallback}>
          <Caption1 className={classes.fallbackLabel}>
            Diagram rendering unavailable — raw Mermaid source:
          </Caption1>
          <pre className={classes.rawCode}>{props.diagram}</pre>
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
            className={`${classes.viewport} ${isDragging ? classes.viewportGrabbing : ''}`}
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
