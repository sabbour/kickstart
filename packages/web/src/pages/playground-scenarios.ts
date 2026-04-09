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

// ---------------------------------------------------------------------------
// Control scenarios assembled
// ---------------------------------------------------------------------------

export const CONTROL_SCENARIOS: ScenarioDef[] = [
  // Layout
  { id: 'ctrl-row',      label: 'Row',           description: 'Horizontal flex layout',          group: 'Layout',          generate: layoutRow },
  { id: 'ctrl-column',   label: 'Column',        description: 'Vertical flex layout',            group: 'Layout',          generate: layoutColumn },
  { id: 'ctrl-list',     label: 'List',           description: 'Ordered list of items',           group: 'Layout',          generate: layoutList },
  { id: 'ctrl-card',     label: 'Card',           description: 'Content card wrapper',            group: 'Layout',          generate: layoutCard },
  { id: 'ctrl-tabs',     label: 'Tabs',           description: 'Tabbed content panels',           group: 'Layout',          generate: layoutTabs },
  { id: 'ctrl-divider',  label: 'Divider',        description: 'Horizontal separator',            group: 'Layout',          generate: layoutDivider },
  // Content
  { id: 'ctrl-text',     label: 'Text',           description: 'All text variants h1–overline',   group: 'Content',         generate: contentText },
  { id: 'ctrl-image',    label: 'Image',          description: 'Image with placeholder',          group: 'Content',         generate: contentImage },
  // Inputs
  { id: 'ctrl-button',   label: 'Button',         description: 'Primary / outlined / text',       group: 'Inputs',          generate: inputButton },
  { id: 'ctrl-textfield',label: 'TextField',      description: 'Text input with label',           group: 'Inputs',          generate: inputTextField },
  { id: 'ctrl-checkbox', label: 'CheckBox',       description: 'Toggle checkboxes',               group: 'Inputs',          generate: inputCheckBox },
  { id: 'ctrl-choice',   label: 'ChoicePicker',   description: 'Chips and list variants',         group: 'Inputs',          generate: inputChoicePicker },
  { id: 'ctrl-slider',   label: 'Slider',         description: 'Range slider control',            group: 'Inputs',          generate: inputSlider },
  { id: 'ctrl-datetime', label: 'DateTimeInput',  description: 'Date and time picker',            group: 'Inputs',          generate: inputDateTime },
  { id: 'ctrl-modal',    label: 'Modal',          description: 'Modal dialog with trigger',       group: 'Inputs',          generate: inputModal },
  // Custom Controls
  { id: 'ctrl-radio',    label: 'RadioGroup',     description: 'Radio options with descriptions',  group: 'Custom Controls', generate: customRadioGroup },
  { id: 'ctrl-form',     label: 'FormGroup',      description: 'Stepped form sections',            group: 'Custom Controls', generate: customFormGroup },
  { id: 'ctrl-code',     label: 'CodeBlock',      description: 'Syntax-highlighted code',          group: 'Custom Controls', generate: customCodeBlock },
  { id: 'ctrl-progress', label: 'ProgressSteps',  description: 'Multi-step progress tracker',      group: 'Custom Controls', generate: customProgressSteps },
];

/** All scenario groups in display order */
export const SCENARIO_GROUPS = [
  'Kickstart Scenarios',
  'Layout',
  'Content',
  'Inputs',
  'Custom Controls',
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
