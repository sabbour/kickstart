import React, { useEffect, useRef, useState, useCallback } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema } from '../../vendor/a2ui/web_core/schema/common-types';
import { Body1, Body2, Button, Caption1, Card, Subtitle2, makeStyles, tokens, } from '@fluentui/react-components';
import { ZoomInRegular, ZoomOutRegular, ArrowResetRegular, } from '@fluentui/react-icons';
// Fluent 2 light theme color constants for Mermaid config (must be static strings)
const FLUENT = {
    brandPrimary: '#0078D4',
    brandTint60: '#EBF3FC',
    brandTint40: '#B4D6FA',
    neutralBg1: '#FFFFFF',
    neutralBg3: '#F5F5F5',
    neutralFg1: '#242424',
    neutralFg2: '#424242',
    neutralFg3: '#616161',
    neutralStroke1: '#D1D1D1',
    neutralStroke2: '#E0E0E0',
    fontFamily: '"Segoe UI Variable", "Segoe UI", system-ui, sans-serif',
};
// Icon keyword mapping — keys are lowercase search terms, values are icon filenames
const ICON_MAP = [
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
function matchIcon(label) {
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
let mermaidInstance = null;
let mermaidLoading = false;
let mermaidCallbacks = [];
function loadMermaid() {
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
                    securityLevel: 'loose',
                    fontFamily: FLUENT.fontFamily,
                    themeVariables: {
                        // Node styling
                        primaryColor: FLUENT.brandTint60,
                        primaryBorderColor: FLUENT.brandTint40,
                        primaryTextColor: FLUENT.neutralFg1,
                        secondaryColor: FLUENT.neutralBg3,
                        secondaryBorderColor: FLUENT.neutralStroke2,
                        secondaryTextColor: FLUENT.neutralFg2,
                        tertiaryColor: FLUENT.neutralBg1,
                        tertiaryBorderColor: FLUENT.neutralStroke1,
                        tertiaryTextColor: FLUENT.neutralFg2,
                        // Lines and edges
                        lineColor: FLUENT.neutralFg3,
                        // Text
                        fontFamily: FLUENT.fontFamily,
                        fontSize: '13px',
                        // Background
                        background: FLUENT.neutralBg1,
                        mainBkg: FLUENT.brandTint60,
                        nodeBorder: FLUENT.brandTint40,
                        // Cluster / subgraph styling
                        clusterBkg: FLUENT.neutralBg3,
                        clusterBorder: FLUENT.neutralStroke2,
                        // Edge label
                        edgeLabelBackground: FLUENT.neutralBg1,
                        // Notes
                        noteBkgColor: '#FFF8E1',
                        noteBorderColor: '#FFB900',
                        noteTextColor: FLUENT.neutralFg1,
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
/** Post-process the rendered SVG to apply Fluent 2 styling and inject icons. */
function postProcessSvg(svgEl) {
    // Apply rounded corners to all rect elements in nodes
    svgEl.querySelectorAll('.node rect, .node polygon').forEach((el) => {
        if (el.tagName === 'rect') {
            el.setAttribute('rx', '8');
            el.setAttribute('ry', '8');
            // Soften stroke
            el.setAttribute('stroke-width', '1.5');
        }
    });
    // Clean up edges — thin, consistent strokes
    svgEl.querySelectorAll('.edge path, .flowchart-link').forEach((el) => {
        el.style.strokeWidth = '1.5';
    });
    // Inject Fluent icons into matching nodes
    svgEl.querySelectorAll('.node').forEach((nodeGroup) => {
        const labelEl = nodeGroup.querySelector('.nodeLabel, .label');
        if (!labelEl)
            return;
        const labelText = labelEl.textContent?.trim() || '';
        const iconFile = matchIcon(labelText);
        if (!iconFile)
            return;
        const iconUrl = `/assets/icons/fluent/${iconFile}`;
        const ICON_SIZE = 18;
        const ICON_PADDING = 4;
        // Find the rect to position the icon relative to it
        const rect = nodeGroup.querySelector('rect');
        if (!rect)
            return;
        const rectX = parseFloat(rect.getAttribute('x') || '0');
        const rectY = parseFloat(rect.getAttribute('y') || '0');
        const rectH = parseFloat(rect.getAttribute('height') || '0');
        // Place icon at left inside the node, vertically centered
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
        // Widen the rect to accommodate the icon and shift label text right
        const rectW = parseFloat(rect.getAttribute('width') || '0');
        const extraWidth = ICON_SIZE + ICON_PADDING * 2;
        rect.setAttribute('width', String(rectW + extraWidth));
        rect.setAttribute('x', String(rectX - extraWidth / 2));
        // Shift label text to make room
        const foreignObj = nodeGroup.querySelector('foreignObject');
        if (foreignObj) {
            const foX = parseFloat(foreignObj.getAttribute('x') || '0');
            foreignObj.setAttribute('x', String(foX + extraWidth / 2));
        }
        // Also shift image to match the updated rect
        imageEl.setAttribute('x', String(rectX - extraWidth / 2 + ICON_PADDING + 4));
    });
    // Remove default Mermaid box-shadow / filter effects for a flatter Fluent look
    svgEl.querySelectorAll('.node').forEach((node) => {
        node.style.filter = 'none';
    });
}
let diagramCounter = 0;
export const ArchitectureDiagram = createReactComponent(ArchitectureDiagramApi, ({ props }) => {
    const classes = useStyles();
    const containerRef = useRef(null);
    const viewportRef = useRef(null);
    const [renderError, setRenderError] = useState(false);
    const [scale, setScale] = useState(1);
    const [offset, setOffset] = useState({ x: 0, y: 0 });
    const dragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const offsetAtDragStart = useRef({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [viewportHeight, setViewportHeight] = useState(VIEWPORT_MIN_HEIGHT);
    const diagramSize = useRef({ width: 0, height: 0 });
    /** Fit the diagram to the viewport width and center it. */
    const fitAndCenter = useCallback(() => {
        const viewportEl = viewportRef.current;
        if (!viewportEl || diagramSize.current.width === 0)
            return;
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
        if (!props.diagram || !containerRef.current)
            return;
        const container = containerRef.current;
        const id = `mermaid-diagram-${++diagramCounter}`;
        loadMermaid().then(async (m) => {
            try {
                const { svg } = await m.default.render(id, props.diagram);
                if (container) {
                    container.innerHTML = svg;
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
            }
            catch {
                setRenderError(true);
            }
        });
    }, [props.diagram, fitAndCenter]);
    const handleWheel = useCallback((e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setScale((s) => Math.min(3, Math.max(0.3, s + delta)));
    }, []);
    const handleMouseDown = useCallback((e) => {
        dragging.current = true;
        setIsDragging(true);
        dragStart.current = { x: e.clientX, y: e.clientY };
        offsetAtDragStart.current = { ...offset };
    }, [offset]);
    const handleMouseMove = useCallback((e) => {
        if (!dragging.current)
            return;
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
    return (<Card className={classes.root}>
      {(props.title || props.description) && (<div className={classes.header}>
          {props.title && <Subtitle2>{props.title}</Subtitle2>}
          {props.description && <Body2>{props.description}</Body2>}
        </div>)}

      {renderError ? (<div className={classes.fallback}>
          <Caption1 className={classes.fallbackLabel}>
            Diagram rendering unavailable — raw Mermaid source:
          </Caption1>
          <pre className={classes.rawCode}>{props.diagram}</pre>
        </div>) : (<>
          <div className={classes.toolbar}>
            <Button appearance="subtle" size="small" icon={<ZoomInRegular />} onClick={zoomIn} title="Zoom in"/>
            <Button appearance="subtle" size="small" icon={<ZoomOutRegular />} onClick={zoomOut} title="Zoom out"/>
            <Button appearance="subtle" size="small" icon={<ArrowResetRegular />} onClick={resetView} title="Reset view"/>
            <Caption1>{Math.round(scale * 100)}%</Caption1>
          </div>
          <div ref={viewportRef} className={`${classes.viewport} ${isDragging ? classes.viewportGrabbing : ''}`} style={{ height: `${viewportHeight}px` }} onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}>
            <div className={classes.canvas} style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            }} ref={containerRef}/>
          </div>
        </>)}
    </Card>);
});
//# sourceMappingURL=ArchitectureDiagram.js.map