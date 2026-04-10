/**
 * playground-scenarios.ts — All scenario definitions for the A2UI Playground.
 *
 * Two categories:
 *   1. Kickstart Scenarios — the 8 app-specific demo flows (driven by demo-scenarios.ts)
 *   2. Basic Controls     — one scenario per built-in A2UI component
 */

import type { A2uiMsg, A2uiComponent } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CATALOG_ID = 'kickstart';
let surfaceCounter = 0;

/** Generate a unique surfaceId to avoid "Surface already exists" errors. */
function uid(base: string): string {
  return `${base}-${++surfaceCounter}`;
}

/** Create a surface with the given components. */
function surface(surfaceId: string, components: A2uiComponent[]): A2uiMsg[] {
  return [
    { version: 'v0.9', createSurface: { surfaceId, catalogId: CATALOG_ID } } as A2uiMsg,
    { version: 'v0.9', updateComponents: { surfaceId, components } } as A2uiMsg,
  ];
}

// ---------------------------------------------------------------------------
// Kickstart Scenarios (existing 8 app-specific demos)
// ---------------------------------------------------------------------------

export interface ScenarioDef {
  id: string;
  label: string;
  description: string;
  group: string;
  /** Which catalog this component originates from */
  catalog?: string;
  /** If present, this scenario is driven by demo-scenarios.ts keyword matching */
  keyword?: string;
  /** If present, this function generates the A2UI messages directly */
  generate?: () => A2uiMsg[];
}

export const KICKSTART_SCENARIOS: ScenarioDef[] = [
  { id: 'welcome',     label: 'Welcome',         description: 'Radio group track selector',   group: 'Kickstart Scenarios', keyword: '__welcome__' },
  { id: 'architecture',label: 'Architecture',     description: 'Card with architecture rows',  group: 'Kickstart Scenarios', keyword: 'architecture' },
  { id: 'detail',      label: 'Design Detail',    description: 'Tabbed service breakdown',     group: 'Kickstart Scenarios', keyword: 'detail' },
  { id: 'config',      label: 'Configure Form',   description: 'FormGroup + ProgressSteps',    group: 'Kickstart Scenarios', keyword: 'config' },
  { id: 'code',        label: 'Code Preview',     description: 'CodeBlock components',         group: 'Kickstart Scenarios', keyword: 'code' },
  { id: 'filegen',     label: 'File Generation',  description: 'File cards list',              group: 'Kickstart Scenarios', keyword: 'generate' },
  { id: 'review',      label: 'Review',           description: 'Deploy config form',           group: 'Kickstart Scenarios', keyword: 'review' },
  { id: 'deploy',      label: 'Deploy Success',   description: 'ProgressSteps + endpoints',    group: 'Kickstart Scenarios', keyword: 'deploy' },
];

// ---------------------------------------------------------------------------
// Basic Control Scenarios — one per component category
// ---------------------------------------------------------------------------

// --- Layout ---

const layoutRow = (): A2uiMsg[] => {
  const sid = uid('row-demo');
  return surface(sid, [
    { id: 'root', component: 'Column', children: ['heading', 'row1'], gap: 'medium' },
    { id: 'heading', component: 'Text', text: 'Row Layout', variant: 'h3' },
    { id: 'row1', component: 'Row', children: ['r1', 'r2', 'r3'], gap: 'medium' },
    { id: 'r1', component: 'Text', text: 'Item A', variant: 'body1' },
    { id: 'r2', component: 'Text', text: 'Item B', variant: 'body1' },
    { id: 'r3', component: 'Text', text: 'Item C', variant: 'body1' },
  ] as A2uiComponent[]);
};

const layoutColumn = (): A2uiMsg[] => {
  const sid = uid('col-demo');
  return surface(sid, [
    { id: 'root', component: 'Column', children: ['heading', 'c1', 'c2', 'c3'], gap: 'small' },
    { id: 'heading', component: 'Text', text: 'Column Layout', variant: 'h3' },
    { id: 'c1', component: 'Text', text: 'First row of content', variant: 'body1' },
    { id: 'c2', component: 'Text', text: 'Second row of content', variant: 'body1' },
    { id: 'c3', component: 'Text', text: 'Third row of content', variant: 'body1' },
  ] as A2uiComponent[]);
};

const layoutList = (): A2uiMsg[] => {
  const sid = uid('list-demo');
  return surface(sid, [
    { id: 'root', component: 'Column', children: ['heading', 'list1'], gap: 'medium' },
    { id: 'heading', component: 'Text', text: 'List Component', variant: 'h3' },
    { id: 'list1', component: 'List', children: ['li1', 'li2', 'li3'] },
    { id: 'li1', component: 'Text', text: 'Deploy to staging environment', variant: 'body1' },
    { id: 'li2', component: 'Text', text: 'Run integration tests', variant: 'body1' },
    { id: 'li3', component: 'Text', text: 'Promote to production', variant: 'body1' },
  ] as A2uiComponent[]);
};

const layoutCard = (): A2uiMsg[] => {
  const sid = uid('card-demo');
  return surface(sid, [
    { id: 'root', component: 'Column', children: ['heading', 'card1'], gap: 'medium' },
    { id: 'heading', component: 'Text', text: 'Card Component', variant: 'h3' },
    { id: 'card1', component: 'Card', child: 'card-body' },
    { id: 'card-body', component: 'Column', children: ['card-title', 'card-desc'], gap: 'small' },
    { id: 'card-title', component: 'Text', text: 'Web Application', variant: 'subtitle1' },
    { id: 'card-desc', component: 'Text', text: 'A containerized Node.js API with Redis caching and PostgreSQL storage.', variant: 'body2' },
  ] as A2uiComponent[]);
};

const layoutTabs = (): A2uiMsg[] => {
  const sid = uid('tabs-demo');
  return surface(sid, [
    { id: 'root', component: 'Column', children: ['heading', 'tabs1'], gap: 'medium' },
    { id: 'heading', component: 'Text', text: 'Tabs Component', variant: 'h3' },
    { id: 'tabs1', component: 'Tabs', tabs: [
      { title: 'Overview', child: 'tab-overview' },
      { title: 'Configuration', child: 'tab-config' },
      { title: 'Logs', child: 'tab-logs' },
    ] },
    { id: 'tab-overview', component: 'Text', text: 'Application overview — 3 services running, 2 replicas each.', variant: 'body1' },
    { id: 'tab-config', component: 'Text', text: 'Environment: production | Region: East US 2 | SKU: Standard', variant: 'body1' },
    { id: 'tab-logs', component: 'Text', text: '[2025-07-28 10:15:03] Deployment succeeded in 42s.', variant: 'body2' },
  ] as A2uiComponent[]);
};

const layoutDivider = (): A2uiMsg[] => {
  const sid = uid('divider-demo');
  return surface(sid, [
    { id: 'root', component: 'Column', children: ['heading', 'above', 'div1', 'below'], gap: 'small' },
    { id: 'heading', component: 'Text', text: 'Divider Component', variant: 'h3' },
    { id: 'above', component: 'Text', text: 'Content above the divider', variant: 'body1' },
    { id: 'div1', component: 'Divider' },
    { id: 'below', component: 'Text', text: 'Content below the divider', variant: 'body1' },
  ] as A2uiComponent[]);
};

// --- Content ---

const contentText = (): A2uiMsg[] => {
  const sid = uid('text-demo');
  return surface(sid, [
    { id: 'root', component: 'Column', children: ['t-h1', 't-h2', 't-h3', 't-sub1', 't-sub2', 't-body1', 't-body2', 't-cap', 't-over'], gap: 'small' },
    { id: 't-h1', component: 'Text', text: 'Heading 1', variant: 'h1' },
    { id: 't-h2', component: 'Text', text: 'Heading 2', variant: 'h2' },
    { id: 't-h3', component: 'Text', text: 'Heading 3', variant: 'h3' },
    { id: 't-sub1', component: 'Text', text: 'Subtitle 1', variant: 'subtitle1' },
    { id: 't-sub2', component: 'Text', text: 'Subtitle 2', variant: 'subtitle2' },
    { id: 't-body1', component: 'Text', text: 'Body 1 — The quick brown fox jumps over the lazy dog.', variant: 'body1' },
    { id: 't-body2', component: 'Text', text: 'Body 2 — Secondary body text with less emphasis.', variant: 'body2' },
    { id: 't-cap', component: 'Text', text: 'Caption text', variant: 'caption' },
    { id: 't-over', component: 'Text', text: 'OVERLINE TEXT', variant: 'overline' },
  ] as A2uiComponent[]);
};

const contentImage = (): A2uiMsg[] => {
  const sid = uid('image-demo');
  return surface(sid, [
    { id: 'root', component: 'Column', children: ['heading', 'img1'], gap: 'medium' },
    { id: 'heading', component: 'Text', text: 'Image Component', variant: 'h3' },
    { id: 'img1', component: 'Image', src: 'https://via.placeholder.com/300x200', alt: 'Placeholder image' },
  ] as A2uiComponent[]);
};

// --- Inputs ---

const inputButton = (): A2uiMsg[] => {
  const sid = uid('button-demo');
  return surface(sid, [
    { id: 'root', component: 'Column', children: ['heading', 'btn-row'], gap: 'medium' },
    { id: 'heading', component: 'Text', text: 'Button Variants', variant: 'h3' },
    { id: 'btn-row', component: 'Row', children: ['btn-primary', 'btn-outlined', 'btn-text'], gap: 'medium' },
    { id: 'btn-primary', component: 'Button', child: 'bp-label', variant: 'primary', action: { event: { name: 'deploy' } } },
    { id: 'bp-label', component: 'Text', text: 'Deploy Now' },
    { id: 'btn-outlined', component: 'Button', child: 'bo-label', variant: 'outlined', action: { event: { name: 'preview' } } },
    { id: 'bo-label', component: 'Text', text: 'Preview' },
    { id: 'btn-text', component: 'Button', child: 'bt-label', variant: 'text', action: { event: { name: 'cancel' } } },
    { id: 'bt-label', component: 'Text', text: 'Cancel' },
  ] as A2uiComponent[]);
};

const inputTextField = (): A2uiMsg[] => {
  const sid = uid('textfield-demo');
  return surface(sid, [
    { id: 'root', component: 'Column', children: ['heading', 'tf1', 'tf2'], gap: 'medium' },
    { id: 'heading', component: 'Text', text: 'TextField Component', variant: 'h3' },
    { id: 'tf1', component: 'TextField', label: 'Application name', placeholder: 'e.g. my-web-app' },
    { id: 'tf2', component: 'TextField', label: 'Region', value: 'East US 2' },
  ] as A2uiComponent[]);
};

const inputCheckBox = (): A2uiMsg[] => {
  const sid = uid('checkbox-demo');
  return surface(sid, [
    { id: 'root', component: 'Column', children: ['heading', 'cb1', 'cb2', 'cb3'], gap: 'small' },
    { id: 'heading', component: 'Text', text: 'CheckBox Component', variant: 'h3' },
    { id: 'cb1', component: 'CheckBox', label: 'Enable auto-scaling', value: true },
    { id: 'cb2', component: 'CheckBox', label: 'Enable HTTPS only', value: true },
    { id: 'cb3', component: 'CheckBox', label: 'Enable preview environments', value: false },
  ] as A2uiComponent[]);
};

const inputChoicePicker = (): A2uiMsg[] => {
  const sid = uid('choice-demo');
  return surface(sid, [
    { id: 'root', component: 'Column', children: ['heading', 'cp-chips', 'cp-list'], gap: 'medium' },
    { id: 'heading', component: 'Text', text: 'ChoicePicker Variants', variant: 'h3' },
    { id: 'cp-chips', component: 'ChoicePicker', label: 'Runtime (chips)', options: [
      { value: 'node', label: 'Node.js 20' },
      { value: 'python', label: 'Python 3.12' },
      { value: 'go', label: 'Go 1.22' },
      { value: 'dotnet', label: '.NET 8' },
    ], value: ['node'], displayStyle: 'chips' },
    { id: 'cp-list', component: 'ChoicePicker', label: 'Region (list, exclusive)', options: [
      { value: 'eastus', label: 'East US' },
      { value: 'westus', label: 'West US 2' },
      { value: 'westeu', label: 'West Europe' },
    ], value: ['eastus'], variant: 'mutuallyExclusive', displayStyle: 'list' },
  ] as A2uiComponent[]);
};

const inputSlider = (): A2uiMsg[] => {
  const sid = uid('slider-demo');
  return surface(sid, [
    { id: 'root', component: 'Column', children: ['heading', 'sl1', 'sl2'], gap: 'medium' },
    { id: 'heading', component: 'Text', text: 'Slider Component', variant: 'h3' },
    { id: 'sl1', component: 'Slider', label: 'CPU cores', value: 2, min: 1, max: 8 },
    { id: 'sl2', component: 'Slider', label: 'Memory (GB)', value: 4, min: 1, max: 32 },
  ] as A2uiComponent[]);
};

const inputDateTime = (): A2uiMsg[] => {
  const sid = uid('datetime-demo');
  return surface(sid, [
    { id: 'root', component: 'Column', children: ['heading', 'dt1', 'dt2'], gap: 'medium' },
    { id: 'heading', component: 'Text', text: 'DateTimeInput Component', variant: 'h3' },
    { id: 'dt1', component: 'DateTimeInput', label: 'Deployment date', enableDate: true, enableTime: false },
    { id: 'dt2', component: 'DateTimeInput', label: 'Maintenance window', enableDate: true, enableTime: true },
  ] as A2uiComponent[]);
};

const inputModal = (): A2uiMsg[] => {
  const sid = uid('modal-demo');
  return surface(sid, [
    { id: 'root', component: 'Column', children: ['heading', 'modal1'], gap: 'medium' },
    { id: 'heading', component: 'Text', text: 'Modal Component', variant: 'h3' },
    { id: 'modal1', component: 'Modal', trigger: 'modal-trigger', content: 'modal-content' },
    { id: 'modal-trigger', component: 'Button', child: 'trigger-label', variant: 'primary' },
    { id: 'trigger-label', component: 'Text', text: 'Open confirmation' },
    { id: 'modal-content', component: 'Column', children: ['mc-title', 'mc-body', 'mc-actions'], gap: 'medium' },
    { id: 'mc-title', component: 'Text', text: 'Confirm deployment', variant: 'h3' },
    { id: 'mc-body', component: 'Text', text: 'This will deploy your application to the production environment. Are you sure?', variant: 'body1' },
    { id: 'mc-actions', component: 'Row', children: ['mc-confirm', 'mc-cancel'], gap: 'medium' },
    { id: 'mc-confirm', component: 'Button', child: 'mc-confirm-label', variant: 'primary', action: { event: { name: 'confirm-deploy' } } },
    { id: 'mc-confirm-label', component: 'Text', text: 'Deploy' },
    { id: 'mc-cancel', component: 'Button', child: 'mc-cancel-label', variant: 'outlined' },
    { id: 'mc-cancel-label', component: 'Text', text: 'Cancel' },
  ] as A2uiComponent[]);
};

// --- Custom Controls ---

const customRadioGroup = (): A2uiMsg[] => {
  const sid = uid('radio-demo');
  return surface(sid, [
    { id: 'root', component: 'Column', children: ['heading', 'rg1'], gap: 'medium' },
    { id: 'heading', component: 'Text', text: 'RadioGroup (Custom)', variant: 'h3' },
    { id: 'rg1', component: 'RadioGroup', options: [
      { id: 'web', label: 'Web Application', description: 'Containerized web app with auto-scaling', recommended: true },
      { id: 'api', label: 'REST API', description: 'Backend service with OpenAPI docs' },
      { id: 'agent', label: 'AI Agent', description: 'LangChain-powered autonomous agent' },
    ], value: 'web' },
  ] as A2uiComponent[]);
};

const customFormGroup = (): A2uiMsg[] => {
  const sid = uid('form-demo');
  return surface(sid, [
    { id: 'root', component: 'Column', children: ['heading', 'fg1', 'fg2'], gap: 'medium' },
    { id: 'heading', component: 'Text', text: 'FormGroup (Custom)', variant: 'h3' },
    { id: 'fg1', component: 'FormGroup', title: 'Application Settings', step: 1, child: 'fg1-body' },
    { id: 'fg1-body', component: 'Column', children: ['fg1-name', 'fg1-region'], gap: 'small' },
    { id: 'fg1-name', component: 'TextField', label: 'App name', placeholder: 'my-app' },
    { id: 'fg1-region', component: 'ChoicePicker', label: 'Region', options: [
      { value: 'eastus', label: 'East US' },
      { value: 'westeu', label: 'West Europe' },
    ], value: ['eastus'], variant: 'mutuallyExclusive', displayStyle: 'chips' },
    { id: 'fg2', component: 'FormGroup', title: 'Scaling', step: 2, child: 'fg2-body' },
    { id: 'fg2-body', component: 'Slider', label: 'Replicas', value: 3, min: 1, max: 10 },
  ] as A2uiComponent[]);
};

const customCodeBlock = (): A2uiMsg[] => {
  const sid = uid('code-demo');
  return surface(sid, [
    { id: 'root', component: 'Column', children: ['heading', 'cb1'], gap: 'medium' },
    { id: 'heading', component: 'Text', text: 'CodeBlock (Custom)', variant: 'h3' },
    { id: 'cb1', component: 'CodeBlock', code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: web-app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: web-app
  template:
    spec:
      containers:
        - name: web
          image: myregistry.azurecr.io/web-app:latest
          ports:
            - containerPort: 8080`, language: 'yaml', filename: 'deployment.yaml' },
  ] as A2uiComponent[]);
};

const customProgressSteps = (): A2uiMsg[] => {
  const sid = uid('progress-demo');
  return surface(sid, [
    { id: 'root', component: 'Column', children: ['heading', 'ps1'], gap: 'medium' },
    { id: 'heading', component: 'Text', text: 'ProgressSteps (Custom)', variant: 'h3' },
    { id: 'ps1', component: 'ProgressSteps', steps: [
      { id: 'discover', label: 'Discover', status: 'complete' },
      { id: 'design', label: 'Design', status: 'complete' },
      { id: 'generate', label: 'Generate', status: 'active' },
      { id: 'review', label: 'Review', status: 'pending' },
      { id: 'deploy', label: 'Deploy', status: 'pending' },
    ] },
  ] as A2uiComponent[]);
};

const customArchitectureDiagram = (): A2uiMsg[] => {
  const sid = uid('arch-diagram-demo');
  return surface(sid, [
    { id: 'root', component: 'Column', children: ['heading', 'ad1'], gap: 'medium' },
    { id: 'heading', component: 'Text', text: 'Architecture Diagram', variant: 'h3' },
    { id: 'ad1', component: 'ArchitectureDiagram',
      title: 'AKS Application Architecture',
      description: 'Typical microservice deployment on Azure Kubernetes Service',
      diagram: `graph LR
  Client([Client]) --> Ingress[Ingress Controller]
  Ingress --> FE[Frontend Pod]
  Ingress --> API[API Pod]
  API --> DB[(Azure SQL)]
  API --> Cache[(Redis Cache)]
  API --> Queue[Service Bus]
  Queue --> Worker[Worker Pod]
  Worker --> Storage[(Blob Storage)]
  subgraph AKS Cluster
    Ingress
    FE
    API
    Worker
  end
  subgraph Azure Services
    DB
    Cache
    Queue
    Storage
  end` },
  ] as A2uiComponent[]);
};

// ---------------------------------------------------------------------------
// Advanced Scenarios — Data Binding, Events, Lifecycle, Dynamic Patterns
// ---------------------------------------------------------------------------

// --- Data Binding ---

const dataBindingBasic = (): A2uiMsg[] => {
  const sid = uid('databind-basic');
  return [
    { version: 'v0.9', createSurface: { surfaceId: sid, catalogId: CATALOG_ID } } as A2uiMsg,
    { version: 'v0.9', updateDataModel: { surfaceId: sid, path: '/app/name', value: 'My Web App' } } as A2uiMsg,
    { version: 'v0.9', updateDataModel: { surfaceId: sid, path: '/app/region', value: 'East US 2' } } as A2uiMsg,
    { version: 'v0.9', updateComponents: { surfaceId: sid, components: [
      { id: 'root', component: 'Column', children: ['heading', 'name-display', 'region-display'], gap: 'medium' },
      { id: 'heading', component: 'Text', text: 'Data Binding Demo', variant: 'h3' },
      { id: 'name-display', component: 'Text', text: { path: '/app/name' }, variant: 'body1' },
      { id: 'region-display', component: 'Text', text: { path: '/app/region' }, variant: 'body2' },
    ] } } as A2uiMsg,
  ];
};

const dataBindingForm = (): A2uiMsg[] => {
  const sid = uid('databind-form');
  return [
    { version: 'v0.9', createSurface: { surfaceId: sid, catalogId: CATALOG_ID } } as A2uiMsg,
    { version: 'v0.9', updateDataModel: { surfaceId: sid, path: '/config/appName', value: 'web-api' } } as A2uiMsg,
    { version: 'v0.9', updateDataModel: { surfaceId: sid, path: '/config/replicas', value: 3 } } as A2uiMsg,
    { version: 'v0.9', updateDataModel: { surfaceId: sid, path: '/config/region', value: 'westus2' } } as A2uiMsg,
    { version: 'v0.9', updateComponents: { surfaceId: sid, components: [
      { id: 'root', component: 'Column', children: ['heading', 'form-card', 'summary-card'], gap: 'medium' },
      { id: 'heading', component: 'Text', text: 'Data-Bound Form', variant: 'h3' },
      { id: 'form-card', component: 'Card', children: ['form-col'], title: 'Configuration' },
      { id: 'form-col', component: 'Column', children: ['app-input', 'region-input', 'replica-slider'], gap: 'medium' },
      { id: 'app-input', component: 'TextField', label: 'App Name', value: { path: '/config/appName' } },
      { id: 'region-input', component: 'TextField', label: 'Region', value: { path: '/config/region' } },
      { id: 'replica-slider', component: 'Slider', label: 'Replicas', min: 1, max: 10, value: { path: '/config/replicas' } },
      { id: 'summary-card', component: 'Card', children: ['summary-col'], title: 'Summary' },
      { id: 'summary-col', component: 'Column', children: ['summary-app', 'summary-region', 'summary-replicas'], gap: 'small' },
      { id: 'summary-app', component: 'Text', text: { path: '/config/appName' }, variant: 'body1' },
      { id: 'summary-region', component: 'Text', text: { path: '/config/region' }, variant: 'body2' },
      { id: 'summary-replicas', component: 'Text', text: { path: '/config/replicas' }, variant: 'body2' },
    ] } } as A2uiMsg,
  ];
};

/**
 * B-22: JSON Pointer Live Binding — verifies that:
 *  1. updateDataModel with a JSON Pointer path (e.g. /data/name) sets initial state
 *  2. A TextField bound to { path: '/data/name' } reactively reflects the data model value
 *  3. Typing in the TextField calls setValue → DataContext.set('/data/name', …) which
 *     notifies all components subscribed to /data/name (including the Text mirror below)
 *  4. sendDataModel: true causes the surface to emit data model snapshots back to the server
 *
 * Result: Typing in the TextField immediately updates the Text display — no server round-trip.
 * JSON Pointer data binding is confirmed working end-to-end.
 */
const dataBindingJsonPointerLive = (): A2uiMsg[] => {
  const sid = uid('jsonptr-live');
  return [
    {
      version: 'v0.9',
      createSurface: { surfaceId: sid, catalogId: CATALOG_ID, sendDataModel: true },
    } as A2uiMsg,
    { version: 'v0.9', updateDataModel: { surfaceId: sid, path: '/data/name', value: 'my-aks-app' } } as A2uiMsg,
    { version: 'v0.9', updateDataModel: { surfaceId: sid, path: '/data/selectedResource', value: 'aks-cluster-prod' } } as A2uiMsg,
    {
      version: 'v0.9',
      updateComponents: {
        surfaceId: sid,
        components: [
          { id: 'root', component: 'Column', children: ['heading', 'desc', 'input-card', 'mirror-card'], gap: 'medium' },
          { id: 'heading', component: 'Text', text: 'JSON Pointer Live Binding', variant: 'h3' },
          {
            id: 'desc',
            component: 'Text',
            text: 'Type in the fields below — the mirror section updates immediately via JSON Pointer reactive binding.',
            variant: 'body2',
          },
          { id: 'input-card', component: 'Card', children: ['input-col'], title: 'Inputs (bound to /data/*)' },
          { id: 'input-col', component: 'Column', children: ['name-field', 'resource-field'], gap: 'medium' },
          { id: 'name-field', component: 'TextField', label: 'App Name  →  /data/name', value: { path: '/data/name' } },
          {
            id: 'resource-field',
            component: 'TextField',
            label: 'Selected Resource  →  /data/selectedResource',
            value: { path: '/data/selectedResource' },
          },
          { id: 'mirror-card', component: 'Card', children: ['mirror-col'], title: 'Live Mirror (reads same /data/* paths)' },
          { id: 'mirror-col', component: 'Column', children: ['mirror-name', 'mirror-resource'], gap: 'small' },
          { id: 'mirror-name', component: 'Text', text: { path: '/data/name' }, variant: 'h4' },
          { id: 'mirror-resource', component: 'Text', text: { path: '/data/selectedResource' }, variant: 'body1' },
        ],
      },
    } as A2uiMsg,
  ];
};

const dataBindingSequence = (): A2uiMsg[] => {
  const sid = uid('databind-sequence');
  return [
    { version: 'v0.9', createSurface: { surfaceId: sid, catalogId: CATALOG_ID } } as A2uiMsg,
    { version: 'v0.9', updateComponents: { surfaceId: sid, components: [
      { id: 'root', component: 'Column', children: ['heading', 'status-card'], gap: 'medium' },
      { id: 'heading', component: 'Text', text: 'Progressive Updates', variant: 'h3' },
      { id: 'status-card', component: 'Card', children: ['status-col'], title: 'Deployment Status' },
      { id: 'status-col', component: 'Column', children: ['status-text', 'progress-text'], gap: 'medium' },
      { id: 'status-text', component: 'Text', text: { path: '/deployment/status' }, variant: 'h4' },
      { id: 'progress-text', component: 'Text', text: { path: '/deployment/progress' }, variant: 'body1' },
    ] } } as A2uiMsg,
    { version: 'v0.9', updateDataModel: { surfaceId: sid, path: '/deployment/status', value: 'Initializing' } } as A2uiMsg,
    { version: 'v0.9', updateDataModel: { surfaceId: sid, path: '/deployment/progress', value: '0%' } } as A2uiMsg,
    { version: 'v0.9', updateDataModel: { surfaceId: sid, path: '/deployment/status', value: 'Building' } } as A2uiMsg,
    { version: 'v0.9', updateDataModel: { surfaceId: sid, path: '/deployment/progress', value: '40%' } } as A2uiMsg,
    { version: 'v0.9', updateDataModel: { surfaceId: sid, path: '/deployment/status', value: 'Deploying' } } as A2uiMsg,
    { version: 'v0.9', updateDataModel: { surfaceId: sid, path: '/deployment/progress', value: '80%' } } as A2uiMsg,
  ];
};

// --- Events & Actions ---

const eventsButtonActions = (): A2uiMsg[] => {
  const sid = uid('events-buttons');
  return [
    { version: 'v0.9', createSurface: { surfaceId: sid, catalogId: CATALOG_ID } } as A2uiMsg,
    { version: 'v0.9', updateDataModel: { surfaceId: sid, path: '/app/name', value: 'kickstart-demo' } } as A2uiMsg,
    { version: 'v0.9', updateComponents: { surfaceId: sid, components: [
      { id: 'root', component: 'Column', children: ['heading', 'button-row'], gap: 'medium' },
      { id: 'heading', component: 'Text', text: 'Button Events', variant: 'h3' },
      { id: 'button-row', component: 'Row', children: ['deploy-btn', 'config-btn', 'cancel-btn'], gap: 'medium' },
      { id: 'deploy-btn', component: 'Button', label: 'Deploy', variant: 'primary', action: { event: { name: 'deploy', context: { environment: 'production', appName: { path: '/app/name' } } } } },
      { id: 'config-btn', component: 'Button', label: 'Configure', variant: 'outlined', action: { event: { name: 'configure', context: { step: 'networking' } } } },
      { id: 'cancel-btn', component: 'Button', label: 'Cancel', variant: 'text', action: { event: { name: 'cancel' } } },
    ] } } as A2uiMsg,
  ];
};

const eventsFormSubmit = (): A2uiMsg[] => {
  const sid = uid('events-form');
  return [
    { version: 'v0.9', createSurface: { surfaceId: sid, catalogId: CATALOG_ID } } as A2uiMsg,
    { version: 'v0.9', updateDataModel: { surfaceId: sid, path: '/form/name', value: 'John Doe' } } as A2uiMsg,
    { version: 'v0.9', updateDataModel: { surfaceId: sid, path: '/form/email', value: 'john@example.com' } } as A2uiMsg,
    { version: 'v0.9', updateDataModel: { surfaceId: sid, path: '/form/message', value: 'I need help with AKS deployment' } } as A2uiMsg,
    { version: 'v0.9', updateComponents: { surfaceId: sid, components: [
      { id: 'root', component: 'Column', children: ['heading', 'form-card'], gap: 'medium' },
      { id: 'heading', component: 'Text', text: 'Contact Form', variant: 'h3' },
      { id: 'form-card', component: 'Card', children: ['form-col'], title: 'Send a message' },
      { id: 'form-col', component: 'Column', children: ['name-field', 'email-field', 'msg-field', 'submit-btn'], gap: 'medium' },
      { id: 'name-field', component: 'TextField', label: 'Name', value: { path: '/form/name' } },
      { id: 'email-field', component: 'TextField', label: 'Email', value: { path: '/form/email' } },
      { id: 'msg-field', component: 'TextField', label: 'Message', value: { path: '/form/message' }, multiline: true },
      { id: 'submit-btn', component: 'Button', label: 'Submit', variant: 'primary', action: { event: { name: 'submit_contact', context: { name: { path: '/form/name' }, email: { path: '/form/email' }, message: { path: '/form/message' } } } } },
    ] } } as A2uiMsg,
  ];
};

const eventsFunctionCall = (): A2uiMsg[] => {
  const sid = uid('events-func');
  return surface(sid, [
    { id: 'root', component: 'Column', children: ['heading', 'func-card'], gap: 'medium' },
    { id: 'heading', component: 'Text', text: 'Function Call Action', variant: 'h3' },
    { id: 'func-card', component: 'Card', children: ['func-col'], title: 'Date Formatter' },
    { id: 'func-col', component: 'Column', children: ['desc-text', 'format-btn'], gap: 'medium' },
    { id: 'desc-text', component: 'Text', text: 'This button triggers a functionCall action (not executed in playground)', variant: 'body2' },
    { id: 'format-btn', component: 'Button', label: 'Format Date', variant: 'primary', action: { functionCall: { call: 'formatDate', args: { date: '2025-07-28', format: 'long' } } } },
  ] as A2uiComponent[]);
};

// --- Surface Lifecycle ---

const lifecycleMultiSurface = (): A2uiMsg[] => {
  const sidA = uid('multi-surface-a');
  const sidB = uid('multi-surface-b');
  const sidC = uid('multi-surface-c');
  return [
    // Surface A - simple card
    { version: 'v0.9', createSurface: { surfaceId: sidA, catalogId: CATALOG_ID } } as A2uiMsg,
    { version: 'v0.9', updateComponents: { surfaceId: sidA, components: [
      { id: 'root', component: 'Card', children: ['title'], title: 'Surface A' },
      { id: 'title', component: 'Text', text: 'This is the first surface', variant: 'body1' },
    ] } } as A2uiMsg,
    // Surface B - form
    { version: 'v0.9', createSurface: { surfaceId: sidB, catalogId: CATALOG_ID } } as A2uiMsg,
    { version: 'v0.9', updateComponents: { surfaceId: sidB, components: [
      { id: 'root', component: 'Card', children: ['col'], title: 'Surface B' },
      { id: 'col', component: 'Column', children: ['input1', 'input2'], gap: 'medium' },
      { id: 'input1', component: 'TextField', label: 'Field 1' },
      { id: 'input2', component: 'TextField', label: 'Field 2' },
    ] } } as A2uiMsg,
    // Surface C - status
    { version: 'v0.9', createSurface: { surfaceId: sidC, catalogId: CATALOG_ID } } as A2uiMsg,
    { version: 'v0.9', updateComponents: { surfaceId: sidC, components: [
      { id: 'root', component: 'Card', children: ['status'], title: 'Surface C' },
      { id: 'status', component: 'Text', text: 'Status: All systems operational', variant: 'body1' },
    ] } } as A2uiMsg,
  ];
};

const lifecycleSurfaceUpdate = (): A2uiMsg[] => {
  const sid = uid('surface-update');
  return [
    { version: 'v0.9', createSurface: { surfaceId: sid, catalogId: CATALOG_ID } } as A2uiMsg,
    { version: 'v0.9', updateComponents: { surfaceId: sid, components: [
      { id: 'root', component: 'Column', children: ['loading'], gap: 'medium' },
      { id: 'loading', component: 'Text', text: 'Loading deployment status...', variant: 'h4' },
    ] } } as A2uiMsg,
    { version: 'v0.9', updateComponents: { surfaceId: sid, components: [
      { id: 'root', component: 'Column', children: ['heading', 'content-card'], gap: 'medium' },
      { id: 'heading', component: 'Text', text: 'Deployment Complete', variant: 'h3' },
      { id: 'content-card', component: 'Card', children: ['content-col'], title: 'Status' },
      { id: 'content-col', component: 'Column', children: ['status-text', 'endpoint-text'], gap: 'medium' },
      { id: 'status-text', component: 'Text', text: 'All services running', variant: 'body1' },
      { id: 'endpoint-text', component: 'Text', text: 'https://my-app.azurewebsites.net', variant: 'body2' },
    ] } } as A2uiMsg,
  ];
};

const lifecycleDeleteSurface = (): A2uiMsg[] => {
  const sidA = uid('delete-surface-a');
  const sidB = uid('delete-surface-b');
  return [
    // Create surface A
    { version: 'v0.9', createSurface: { surfaceId: sidA, catalogId: CATALOG_ID } } as A2uiMsg,
    { version: 'v0.9', updateComponents: { surfaceId: sidA, components: [
      { id: 'root', component: 'Card', children: ['text'], title: 'Surface A (will be deleted)' },
      { id: 'text', component: 'Text', text: 'This surface will be removed', variant: 'body1' },
    ] } } as A2uiMsg,
    // Create surface B
    { version: 'v0.9', createSurface: { surfaceId: sidB, catalogId: CATALOG_ID } } as A2uiMsg,
    { version: 'v0.9', updateComponents: { surfaceId: sidB, components: [
      { id: 'root', component: 'Card', children: ['text'], title: 'Surface B (remains)' },
      { id: 'text', component: 'Text', text: 'This surface stays visible', variant: 'body1' },
    ] } } as A2uiMsg,
    // Delete surface A
    { version: 'v0.9', deleteSurface: { surfaceId: sidA } } as A2uiMsg,
  ];
};

// --- Dynamic Patterns ---

const dynamicNestedScopes = (): A2uiMsg[] => {
  const sid = uid('dynamic-nested');
  return [
    { version: 'v0.9', createSurface: { surfaceId: sid, catalogId: CATALOG_ID } } as A2uiMsg,
    { version: 'v0.9', updateDataModel: { surfaceId: sid, path: '/services/0', value: { name: 'Web API', status: 'Running', port: 8080 } } } as A2uiMsg,
    { version: 'v0.9', updateDataModel: { surfaceId: sid, path: '/services/1', value: { name: 'Worker', status: 'Stopped', port: 8081 } } } as A2uiMsg,
    { version: 'v0.9', updateComponents: { surfaceId: sid, components: [
      { id: 'root', component: 'Column', children: ['heading', 'service0', 'service1'], gap: 'medium' },
      { id: 'heading', component: 'Text', text: 'Service Status', variant: 'h3' },
      { id: 'service0', component: 'Card', children: ['s0-col'], title: 'Service 0' },
      { id: 's0-col', component: 'Column', children: ['s0-name', 's0-status', 's0-port'], gap: 'small' },
      { id: 's0-name', component: 'Text', text: { path: '/services/0/name' }, variant: 'h4' },
      { id: 's0-status', component: 'Text', text: { path: '/services/0/status' }, variant: 'body1' },
      { id: 's0-port', component: 'Text', text: { path: '/services/0/port' }, variant: 'body2' },
      { id: 'service1', component: 'Card', children: ['s1-col'], title: 'Service 1' },
      { id: 's1-col', component: 'Column', children: ['s1-name', 's1-status', 's1-port'], gap: 'small' },
      { id: 's1-name', component: 'Text', text: { path: '/services/1/name' }, variant: 'h4' },
      { id: 's1-status', component: 'Text', text: { path: '/services/1/status' }, variant: 'body1' },
      { id: 's1-port', component: 'Text', text: { path: '/services/1/port' }, variant: 'body2' },
    ] } } as A2uiMsg,
  ];
};

const dynamicConditionalContent = (): A2uiMsg[] => {
  const sid = uid('dynamic-conditional');
  return [
    { version: 'v0.9', createSurface: { surfaceId: sid, catalogId: CATALOG_ID } } as A2uiMsg,
    { version: 'v0.9', updateDataModel: { surfaceId: sid, path: '/feature/enabled', value: true } } as A2uiMsg,
    { version: 'v0.9', updateDataModel: { surfaceId: sid, path: '/feature/name', value: 'Auto-scaling' } } as A2uiMsg,
    { version: 'v0.9', updateComponents: { surfaceId: sid, components: [
      { id: 'root', component: 'Column', children: ['heading', 'feature-card'], gap: 'medium' },
      { id: 'heading', component: 'Text', text: 'Feature Flags', variant: 'h3' },
      { id: 'feature-card', component: 'Card', children: ['feature-col'], title: 'Feature Status' },
      { id: 'feature-col', component: 'Column', children: ['feature-name', 'feature-enabled'], gap: 'medium' },
      { id: 'feature-name', component: 'Text', text: { path: '/feature/name' }, variant: 'h4' },
      { id: 'feature-enabled', component: 'Text', text: { path: '/feature/enabled' }, variant: 'body1' },
    ] } } as A2uiMsg,
  ];
};

const dynamicComplexDashboard = (): A2uiMsg[] => {
  const sid = uid('dynamic-dashboard');
  return [
    { version: 'v0.9', createSurface: { surfaceId: sid, catalogId: CATALOG_ID } } as A2uiMsg,
    { version: 'v0.9', updateDataModel: { surfaceId: sid, path: '/deployment/name', value: 'production-cluster' } } as A2uiMsg,
    { version: 'v0.9', updateDataModel: { surfaceId: sid, path: '/deployment/status', value: 'Healthy' } } as A2uiMsg,
    { version: 'v0.9', updateDataModel: { surfaceId: sid, path: '/deployment/replicas', value: 5 } } as A2uiMsg,
    { version: 'v0.9', updateDataModel: { surfaceId: sid, path: '/deployment/region', value: 'eastus2' } } as A2uiMsg,
    { version: 'v0.9', updateDataModel: { surfaceId: sid, path: '/deployment/tier', value: 'Standard_D4s_v3' } } as A2uiMsg,
    { version: 'v0.9', updateComponents: { surfaceId: sid, components: [
      { id: 'root', component: 'Column', children: ['heading', 'dashboard-card'], gap: 'medium' },
      { id: 'heading', component: 'Text', text: 'Deployment Dashboard', variant: 'h3' },
      { id: 'dashboard-card', component: 'Card', children: ['tabs'], title: { path: '/deployment/name' } },
      { id: 'tabs', component: 'Tabs', children: ['tab-overview', 'tab-config', 'tab-logs'] },
      { id: 'tab-overview', component: 'Card', children: ['overview-col'], title: 'Overview' },
      { id: 'overview-col', component: 'Column', children: ['status-text', 'replicas-text'], gap: 'medium' },
      { id: 'status-text', component: 'Text', text: { path: '/deployment/status' }, variant: 'h4' },
      { id: 'replicas-text', component: 'Text', text: { path: '/deployment/replicas' }, variant: 'body1' },
      { id: 'tab-config', component: 'Card', children: ['config-col'], title: 'Configuration' },
      { id: 'config-col', component: 'Column', children: ['region-field', 'tier-field', 'replica-slider'], gap: 'medium' },
      { id: 'region-field', component: 'TextField', label: 'Region', value: { path: '/deployment/region' } },
      { id: 'tier-field', component: 'TextField', label: 'VM Tier', value: { path: '/deployment/tier' } },
      { id: 'replica-slider', component: 'Slider', label: 'Replicas', min: 1, max: 10, value: { path: '/deployment/replicas' } },
      { id: 'tab-logs', component: 'Card', children: ['logs-code'], title: 'Logs' },
      { id: 'logs-code', component: 'CodeBlock', code: `[2025-07-28 14:23:45] Deployment started
[2025-07-28 14:24:12] Scaling to 5 replicas
[2025-07-28 14:25:01] Health check passed
[2025-07-28 14:25:30] Deployment complete`, language: 'text', filename: 'deployment.log' },
    ] } } as A2uiMsg,
  ];
};

// ---------------------------------------------------------------------------
// Control scenarios assembled
// ---------------------------------------------------------------------------

export const CONTROL_SCENARIOS: ScenarioDef[] = [
  // Layout
  { id: 'ctrl-row',      label: 'Row',           description: 'Horizontal flex layout',          group: 'Layout',          catalog: 'a2ui',      generate: layoutRow },
  { id: 'ctrl-column',   label: 'Column',        description: 'Vertical flex layout',            group: 'Layout',          catalog: 'a2ui',      generate: layoutColumn },
  { id: 'ctrl-list',     label: 'List',           description: 'Ordered list of items',           group: 'Layout',          catalog: 'a2ui',      generate: layoutList },
  { id: 'ctrl-card',     label: 'Card',           description: 'Content card wrapper',            group: 'Layout',          catalog: 'a2ui',      generate: layoutCard },
  { id: 'ctrl-tabs',     label: 'Tabs',           description: 'Tabbed content panels',           group: 'Layout',          catalog: 'a2ui',      generate: layoutTabs },
  { id: 'ctrl-divider',  label: 'Divider',        description: 'Horizontal separator',            group: 'Layout',          catalog: 'a2ui',      generate: layoutDivider },
  // Content
  { id: 'ctrl-text',     label: 'Text',           description: 'All text variants h1–overline',   group: 'Content',         catalog: 'a2ui',      generate: contentText },
  { id: 'ctrl-image',    label: 'Image',          description: 'Image with placeholder',          group: 'Content',         catalog: 'a2ui',      generate: contentImage },
  // Inputs
  { id: 'ctrl-button',   label: 'Button',         description: 'Primary / outlined / text',       group: 'Inputs',          catalog: 'a2ui',      generate: inputButton },
  { id: 'ctrl-textfield',label: 'TextField',      description: 'Text input with label',           group: 'Inputs',          catalog: 'a2ui',      generate: inputTextField },
  { id: 'ctrl-checkbox', label: 'CheckBox',       description: 'Toggle checkboxes',               group: 'Inputs',          catalog: 'a2ui',      generate: inputCheckBox },
  { id: 'ctrl-choice',   label: 'ChoicePicker',   description: 'Chips and list variants',         group: 'Inputs',          catalog: 'a2ui',      generate: inputChoicePicker },
  { id: 'ctrl-slider',   label: 'Slider',         description: 'Range slider control',            group: 'Inputs',          catalog: 'a2ui',      generate: inputSlider },
  { id: 'ctrl-datetime', label: 'DateTimeInput',  description: 'Date and time picker',            group: 'Inputs',          catalog: 'a2ui',      generate: inputDateTime },
  { id: 'ctrl-modal',    label: 'Modal',          description: 'Modal dialog with trigger',       group: 'Inputs',          catalog: 'a2ui',      generate: inputModal },
  // Custom Controls
  { id: 'ctrl-radio',    label: 'RadioGroup',     description: 'Radio options with descriptions',  group: 'Custom Controls', catalog: 'kickstart', generate: customRadioGroup },
  { id: 'ctrl-form',     label: 'FormGroup',      description: 'Stepped form sections',            group: 'Custom Controls', catalog: 'kickstart', generate: customFormGroup },
  { id: 'ctrl-code',     label: 'CodeBlock',      description: 'Syntax-highlighted code',          group: 'Custom Controls', catalog: 'kickstart', generate: customCodeBlock },
  { id: 'ctrl-progress', label: 'ProgressSteps',  description: 'Multi-step progress tracker',      group: 'Custom Controls', catalog: 'kickstart', generate: customProgressSteps },
  { id: 'ctrl-arch',     label: 'ArchitectureDiagram', description: 'Mermaid-powered architecture diagram', group: 'Custom Controls', catalog: 'kickstart', generate: customArchitectureDiagram },
  // Data Binding
  { id: 'data-basic',    label: 'Basic Data Binding',     description: 'Text components bound to data paths',        group: 'Data Binding',    generate: dataBindingBasic },
  { id: 'data-form',     label: 'Data-Bound Form',        description: 'Form fields with path bindings',             group: 'Data Binding',    generate: dataBindingForm },
  { id: 'data-sequence', label: 'Data Update Sequence',   description: 'Progressive data model updates',             group: 'Data Binding',    generate: dataBindingSequence },
  { id: 'data-jsonptr',  label: 'JSON Pointer Live Binding', description: 'TextField ↔ Text via /data/* JSON Pointer paths (B-22 verification)', group: 'Data Binding', generate: dataBindingJsonPointerLive },
  // Events & Actions
  { id: 'event-buttons', label: 'Button Events',          description: 'Actions with event context data',            group: 'Events & Actions', generate: eventsButtonActions },
  { id: 'event-form',    label: 'Form Submit Action',     description: 'Submit with context path bindings',          group: 'Events & Actions', generate: eventsFormSubmit },
  { id: 'event-func',    label: 'Function Call Action',   description: 'Button with functionCall action',            group: 'Events & Actions', generate: eventsFunctionCall },
  // Surface Lifecycle
  { id: 'life-multi',    label: 'Multi-Surface',          description: 'Three parallel surfaces',                    group: 'Surface Lifecycle', generate: lifecycleMultiSurface },
  { id: 'life-update',   label: 'Surface Update',         description: 'Replace components on existing surface',     group: 'Surface Lifecycle', generate: lifecycleSurfaceUpdate },
  { id: 'life-delete',   label: 'Delete Surface',         description: 'Create and delete surfaces',                 group: 'Surface Lifecycle', generate: lifecycleDeleteSurface },
  // Dynamic Patterns
  { id: 'dyn-nested',    label: 'Nested Data Scopes',     description: 'Components with nested path bindings',       group: 'Dynamic Patterns', generate: dynamicNestedScopes },
  { id: 'dyn-conditional', label: 'Conditional Content',  description: 'Feature flags with data binding',            group: 'Dynamic Patterns', generate: dynamicConditionalContent },
  { id: 'dyn-dashboard', label: 'Complex Dashboard',      description: 'Multi-tab dashboard with data binding',      group: 'Dynamic Patterns', generate: dynamicComplexDashboard },
];

/** All scenario groups in display order */
export const SCENARIO_GROUPS = [
  'Kickstart Scenarios',
  'Layout',
  'Content',
  'Inputs',
  'Custom Controls',
  'Data Binding',
  'Events & Actions',
  'Surface Lifecycle',
  'Dynamic Patterns',
] as const;

/** Combined list of all scenarios */
export const ALL_SCENARIOS: ScenarioDef[] = [...KICKSTART_SCENARIOS, ...CONTROL_SCENARIOS];

/** Get scenarios grouped by their group name */
export function getGroupedScenarios(): Map<string, ScenarioDef[]> {
  const groups = new Map<string, ScenarioDef[]>();
  for (const group of SCENARIO_GROUPS) {
    groups.set(group, ALL_SCENARIOS.filter(s => s.group === group));
  }
  return groups;
}
