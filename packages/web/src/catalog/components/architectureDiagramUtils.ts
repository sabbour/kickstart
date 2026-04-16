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

const TRY_AKS_SVG_CSS = `
  .cluster rect {
    rx: 0 !important;
    ry: 0 !important;
    stroke-dasharray: none !important;
    fill: #f3f2f1 !important;
    stroke: #e1dfdd !important;
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
    font-family: 'Segoe UI', system-ui, sans-serif !important;
    font-weight: 600 !important;
    font-size: 15px !important;
    color: #646464 !important;
  }
  .edgePath .path,
  .flowchart-link {
    stroke-width: 1.5;
    stroke: #a19f9d;
  }
  .edgePath marker path {
    fill: #a19f9d;
  }
  .edgeLabel {
    font-family: 'Segoe UI Light', 'Segoe UI', system-ui, sans-serif;
    font-size: 13px;
    background-color: #ffffff;
    padding: 2px 6px;
    border-radius: 2px;
    color: #646464;
  }
  .node rect,
  .node circle,
  .node polygon {
    filter: drop-shadow(0 1px 2px rgba(0,0,0,0.06));
    stroke-width: 1.5;
  }
  .nodeLabel,
  .node .label {
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-weight: 500;
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
  return sanitizeDiagramInput(preprocessDiagram(normalizeDiagramText(diagram)));
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

export function injectTryAksDiagramStyles(svg: string): string {
  return svg.replace(/<svg([^>]*)>/, `<svg$1><style>${TRY_AKS_SVG_CSS}</style>`);
}

export async function renderArchitectureDiagramSvg(
  renderSvg: (id: string, source: string) => Promise<{ svg: string }>,
  id: string,
  diagram: string,
  resolveIconUrl: IconUrlResolver,
): Promise<string> {
  const { svg } = await renderSvg(id, prepareArchitectureDiagramSource(diagram));
  return injectTryAksDiagramStyles(expandIconPlaceholders(svg, resolveIconUrl));
}
