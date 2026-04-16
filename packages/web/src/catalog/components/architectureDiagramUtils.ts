import { webLightTheme } from '@fluentui/react-components';

export interface DiagramNode {
  id: string;
  label: string;
  type?: string;
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
}

export type IconUrlResolver = (key: string) => string | null;

export const ALLOWED_ICON_KEYS = [
  'azure/aks',
  'azure/aks-automatic',
  'azure/acr',
  'azure/postgresql',
  'azure/mysql',
  'azure/sql',
  'azure/cosmos-db',
  'azure/redis',
  'azure/storage',
  'azure/key-vault',
  'azure/cognitive-services',
  'azure/app-gateway',
  'azure/front-door',
  'azure/monitor',
  'azure/log-analytics',
  'azure/api-management',
  'azure/event-grid',
  'azure/resource-group',
  'k8s/deploy',
  'k8s/svc',
  'k8s/sa',
  'k8s/ns',
  'k8s/hpa',
  'k8s/pod',
  'k8s/ing',
  'k8s/secret',
  'k8s/pvc',
  'k8s/cm',
  'k8s/crd',
  'k8s/job',
  'k8s/sts',
  'k8s/ds',
  'k8s/netpol',
  'k8s/gateway',
  'k8s/httproute',
  'k8s/pdb',
  'k8s/vpa',
  'k8s/cronjob',
  'k8s/role',
  'k8s/rb',
  'k8s/deviceclass',
  'k8s/resourceclaim',
  'k8s/resourceclaimtemplate',
  'k8s/resourceslice',
  'k8s/inferencepool',
  'k8s/inferenceobjective',
  'k8s/endpointpicker',
] as const;

const ALLOWED_ICON_KEY_SET = new Set<string>(ALLOWED_ICON_KEYS);
const ICON_KEY_PATTERN = /^[a-z0-9]+\/[a-z0-9-]+$/;
const ICON_PLACEHOLDER_PATTERN = /%%icon:([^%]+)%%/gi;

export const FLUENT_DIAGRAM_PALETTE = {
  brandForeground1: webLightTheme.colorBrandForeground1,
  neutralForeground1: webLightTheme.colorNeutralForeground1,
  neutralForeground2: webLightTheme.colorNeutralForeground2,
  neutralForeground3: webLightTheme.colorNeutralForeground3,
  neutralStroke1: webLightTheme.colorNeutralStroke1,
  neutralStroke2: webLightTheme.colorNeutralStroke2,
  neutralBackground1: webLightTheme.colorNeutralBackground1,
  neutralBackground2: webLightTheme.colorNeutralBackground2,
  neutralBackground3: webLightTheme.colorNeutralBackground3,
  neutralBackground4: webLightTheme.colorNeutralBackground4,
  borderRadiusMedium: webLightTheme.borderRadiusMedium,
  fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
  fontSizeCaption1: '12px',
  fontSizeBody1: '14px',
  nodeShadow: 'drop-shadow(0 2px 4px rgba(0,0,0,0.04))',
} as const;

export const FLUENT_DIAGRAM_SVG_CSS = `
  .cluster rect {
    rx: ${FLUENT_DIAGRAM_PALETTE.borderRadiusMedium} !important;
    ry: ${FLUENT_DIAGRAM_PALETTE.borderRadiusMedium} !important;
    stroke-dasharray: none !important;
    fill: ${FLUENT_DIAGRAM_PALETTE.neutralBackground3} !important;
    stroke: ${FLUENT_DIAGRAM_PALETTE.neutralStroke2} !important;
    stroke-width: 1 !important;
  }
  .cluster-label,
  .cluster .label {
    overflow: visible !important;
  }
  .cluster-label foreignObject,
  .cluster .label foreignObject {
    overflow: visible !important;
    width: 200% !important;
    margin-left: -50% !important;
  }
  .cluster-label foreignObject div,
  .cluster .label foreignObject div {
    overflow: visible !important;
    white-space: nowrap !important;
    width: auto !important;
    padding-top: 13px !important;
    font-family: ${FLUENT_DIAGRAM_PALETTE.fontFamily} !important;
    font-weight: 600 !important;
    font-size: ${FLUENT_DIAGRAM_PALETTE.fontSizeBody1} !important;
    color: ${FLUENT_DIAGRAM_PALETTE.neutralForeground2} !important;
  }
  .edgePath .path {
    stroke-width: 1 !important;
    stroke: ${FLUENT_DIAGRAM_PALETTE.neutralStroke1} !important;
  }
  .flowchart-link {
    stroke-width: 1 !important;
    stroke: ${FLUENT_DIAGRAM_PALETTE.neutralStroke1} !important;
  }
  .edgePath marker path {
    fill: ${FLUENT_DIAGRAM_PALETTE.neutralStroke1} !important;
  }
  .edgeLabel {
    font-family: ${FLUENT_DIAGRAM_PALETTE.fontFamily};
    font-size: ${FLUENT_DIAGRAM_PALETTE.fontSizeCaption1};
    background-color: ${FLUENT_DIAGRAM_PALETTE.neutralBackground1};
    padding: 2px 6px;
    border-radius: ${FLUENT_DIAGRAM_PALETTE.borderRadiusMedium};
    color: ${FLUENT_DIAGRAM_PALETTE.neutralForeground3};
  }
  .node rect,
  .node circle,
  .node polygon {
    filter: ${FLUENT_DIAGRAM_PALETTE.nodeShadow};
    stroke-width: 1 !important;
  }
  .node rect {
    rx: ${FLUENT_DIAGRAM_PALETTE.borderRadiusMedium};
    ry: ${FLUENT_DIAGRAM_PALETTE.borderRadiusMedium};
  }
  .nodeLabel,
  .node .label {
    font-family: ${FLUENT_DIAGRAM_PALETTE.fontFamily};
    font-size: ${FLUENT_DIAGRAM_PALETTE.fontSizeBody1};
    font-weight: 600;
    text-align: center;
    line-height: normal !important;
  }
  .label foreignObject {
    text-align: center;
    overflow: visible !important;
  }
  .label foreignObject div {
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    line-height: normal !important;
    gap: 0;
  }
  .label foreignObject div img {
    flex-shrink: 0;
  }
  .node .label foreignObject div {
    overflow: visible !important;
  }
  .node .label {
    text-align: center;
  }
`;

export function isAllowedIconKey(key: string): boolean {
  return ICON_KEY_PATTERN.test(key) && ALLOWED_ICON_KEY_SET.has(key);
}

function escapeMermaidText(value: string): string {
  return value.replace(/"/g, '&quot;');
}

function nodeToMermaid(node: DiagramNode): string {
  const escaped = escapeMermaidText(node.label);
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

export function nodesToMermaid(nodes: DiagramNode[], edges: DiagramEdge[]): string {
  const lines: string[] = ['graph TD'];
  for (const node of nodes) {
    lines.push(nodeToMermaid(node));
  }
  for (const edge of edges) {
    if (edge.label) {
      lines.push(`  ${edge.from} -->|${escapeMermaidText(edge.label)}| ${edge.to}`);
    } else {
      lines.push(`  ${edge.from} --> ${edge.to}`);
    }
  }
  return lines.join('\n');
}

export function normalizeDiagramText(source: string): string {
  return source.replace(/\\n/g, '<br/>');
}

/**
 * Strips HTML artefacts that the LLM sometimes emits in raw Mermaid source:
 * - `<br/>` / `<br>` used as line separators → real newlines
 * - All HTML tags (complete and incomplete) to prevent injection
 *
 * This runs before any other pipeline step so the normalisation functions
 * that follow receive clean Mermaid text.
 */
export function sanitizeMermaidSource(source: string): string {
  if (!source) return source;

  // Replace <br/>, <br />, <br> (case-insensitive) with newlines first
  // so structural line breaks are preserved before tag stripping.
  let result = source.replace(/<br\s*\/?>/gi, '\n');

  // Use DOMParser to strip all remaining HTML tags — handles malformed/unclosed
  // tags safely without regex edge cases. DOMParser is available in all browsers.
  try {
    const doc = new DOMParser().parseFromString(result, 'text/html');
    result = doc.body.textContent ?? result;
  } catch {
    // Fallback for SSR/test environments: the `?` makes `>` optional so unclosed
    // tags like `<script>alert(1)` (no closing `>`) are also stripped.
    result = result.replace(/<[^>]*>?/gm, '');
  }

  return result;
}

export function preprocessDiagram(source: string): string {
  let processed = source;

  processed = processed.replace(
    /\[([^\]"]*\([^\]]*)\]/g,
    (_match, label) => `["${label}"]`,
  );

  processed = processed.replace(
    /\["([^"]*)"\]/g,
    (_match, label: string) => `["${label.split('(').join('&#40;').split(')').join('&#41;')}"]`,
  );

  processed = processed.replace(
    /subgraph\s+(\w+)\[([^\]"]*\([^\]]*)\]/g,
    (_match, id, label: string) =>
      `subgraph ${id}["${label.split('(').join('&#40;').split(')').join('&#41;')}"]`,
  );

  return processed;
}

export function sanitizeDiagramInput(source: string): string {
  const preservedLineBreak = '\u0000BR\u0000';
  return source
    .replace(/<br\s*\/?>/gi, preservedLineBreak)
    .replace(/</g, '&lt;')
    .replace(new RegExp(preservedLineBreak, 'g'), '<br/>');
}

export function prepareArchitectureDiagramSource(diagram: string): string {
  return sanitizeDiagramInput(preprocessDiagram(normalizeDiagramText(sanitizeMermaidSource(diagram))));
}

export function expandIconPlaceholders(svg: string, resolveIconUrl: IconUrlResolver): string {
  return svg.replace(ICON_PLACEHOLDER_PATTERN, (_match, rawKey: string) => {
    const key = rawKey.trim().toLowerCase();
    if (!isAllowedIconKey(key)) {
      return '';
    }

    const iconUrl = resolveIconUrl(key);
    if (!iconUrl) {
      return '';
    }

    return `<img src="${iconUrl}" width="20" height="20" style="vertical-align:middle;margin-right:6px;flex-shrink:0;" alt="" />`;
  });
}

export function injectDiagramStyles(svg: string): string {
  return svg.replace(/<svg([^>]*)>/, `<svg$1><style>${FLUENT_DIAGRAM_SVG_CSS}</style>`);
}

export async function renderArchitectureDiagramSvg(
  renderSvg: (id: string, source: string) => Promise<{ svg: string }>,
  id: string,
  diagram: string,
  resolveIconUrl: IconUrlResolver,
): Promise<string> {
  const { svg } = await renderSvg(id, prepareArchitectureDiagramSource(diagram));
  return injectDiagramStyles(expandIconPlaceholders(svg, resolveIconUrl));
}

type MermaidModule = typeof import('mermaid');
type MermaidApi = MermaidModule['default'];

let mermaidPromise: Promise<MermaidApi> | null = null;

/**
 * Loads and initialises the Mermaid library (singleton — safe to call many times).
 * Shared by ArchitectureDiagram (catalog/chat) and DiagramPreview (file editor).
 */
export function loadMermaid(): Promise<MermaidApi> {
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
          fontFamily: FLUENT_DIAGRAM_PALETTE.fontFamily,
          themeVariables: {
            primaryColor: FLUENT_DIAGRAM_PALETTE.neutralBackground1,
            primaryBorderColor: FLUENT_DIAGRAM_PALETTE.brandForeground1,
            primaryTextColor: FLUENT_DIAGRAM_PALETTE.neutralForeground1,
            lineColor: FLUENT_DIAGRAM_PALETTE.neutralStroke1,
            secondaryColor: FLUENT_DIAGRAM_PALETTE.neutralBackground3,
            secondaryBorderColor: FLUENT_DIAGRAM_PALETTE.neutralStroke2,
            tertiaryColor: FLUENT_DIAGRAM_PALETTE.neutralBackground4,
            fontSize: FLUENT_DIAGRAM_PALETTE.fontSizeBody1,
            fontFamily: FLUENT_DIAGRAM_PALETTE.fontFamily,
            background: FLUENT_DIAGRAM_PALETTE.neutralBackground1,
            mainBkg: FLUENT_DIAGRAM_PALETTE.neutralBackground1,
            nodeBorder: FLUENT_DIAGRAM_PALETTE.brandForeground1,
            clusterBkg: FLUENT_DIAGRAM_PALETTE.neutralBackground3,
            clusterBorder: FLUENT_DIAGRAM_PALETTE.neutralStroke2,
            titleColor: FLUENT_DIAGRAM_PALETTE.neutralForeground1,
            edgeLabelBackground: FLUENT_DIAGRAM_PALETTE.neutralBackground1,
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
