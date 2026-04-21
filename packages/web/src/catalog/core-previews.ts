/**
 * Core pack preview fixtures. Keys are pack-qualified component names
 * (e.g. `core/Text`); descriptor `component` values are the bare renderer
 * names registered in `ClientComponentRegistry` (see A2UIRegistryContext
 * and main.tsx). Consumed via the aggregator in `./component-previews.ts`.
 *
 * Pack-contributed previews for azure/*, aks/*, and github/* live in
 * each pack's ./client subpath export (@aks-kickstart/pack-NAME/client).
 *
 * SCHEMA INVARIANT: descriptor props must match the component's Zod schema
 * exactly. `__tests__/component-previews.test.ts` is the render-time guard.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- component props are untyped by design
export type ComponentPreviewEntry = Record<string, any>[];

export const COMPONENT_PREVIEWS: Readonly<Record<string, ComponentPreviewEntry>> = {
  // ── Basic components ──────────────────────────────────────────────────────

  'core/Text': [
    { id: 'root', component: 'Text', text: 'Hello, world!' },
  ],

  'core/Button': [
    { id: 'root', component: 'Button', child: 'btn-label' },
    { id: 'btn-label', component: 'Text', text: 'Click me' },
  ],

  'core/Image': [
    {
      id: 'root',
      component: 'Image',
      url: '/assets/icons/fluent/sparkle.svg',
      description: 'Sparkle icon',
      variant: 'icon',
    },
  ],

  'core/Icon': [
    { id: 'root', component: 'Icon', name: { path: '/assets/icons/fluent/sparkle.svg' } },
  ],

  'core/Link': [
    { id: 'root', component: 'Link', text: 'Open link', url: '#' },
  ],

  'core/Divider': [
    { id: 'root', component: 'Divider' },
  ],

  'core/Alert': [
    { id: 'root', component: 'Alert', message: 'This is an alert message.', severity: 'info' },
  ],

  'core/TextField': [
    { id: 'root', component: 'TextField', label: 'Name' },
  ],

  'core/CheckBox': [
    { id: 'root', component: 'CheckBox', label: 'Enable feature', value: false },
  ],

  'core/Slider': [
    { id: 'root', component: 'Slider', label: 'Volume', min: 0, max: 100, value: 40 },
  ],

  'core/DateTimeInput': [
    { id: 'root', component: 'DateTimeInput', label: 'Scheduled date', value: '' },
  ],

  'core/ChoicePicker': [
    {
      id: 'root',
      component: 'ChoicePicker',
      label: 'Region',
      options: [
        { label: 'East US', value: 'eastus' },
        { label: 'West Europe', value: 'westeurope' },
      ],
      value: [],
    },
  ],

  'core/Row': [
    {
      id: 'root',
      component: 'Row',
      children: ['c1', 'c2'],
    },
    { id: 'c1', component: 'Text', text: 'Left' },
    { id: 'c2', component: 'Text', text: 'Right' },
  ],

  'core/Column': [
    {
      id: 'root',
      component: 'Column',
      children: ['c1', 'c2'],
    },
    { id: 'c1', component: 'Text', text: 'First' },
    { id: 'c2', component: 'Text', text: 'Second' },
  ],

  'core/Card': [
    {
      id: 'root',
      component: 'Card',
      children: ['c1'],
    },
    { id: 'c1', component: 'Text', text: 'Card content' },
  ],

  'core/List': [
    {
      id: 'root',
      component: 'List',
      children: ['li1', 'li2', 'li3'],
    },
    { id: 'li1', component: 'Text', text: 'Item one' },
    { id: 'li2', component: 'Text', text: 'Item two' },
    { id: 'li3', component: 'Text', text: 'Item three' },
  ],

  'core/Table': [
    {
      id: 'root',
      component: 'Table',
      columns: ['Name', 'Status'],
      rows: [
        ['Alice', 'Active'],
        ['Bob', 'Inactive'],
      ],
    },
  ],

  'core/Tabs': [
    {
      id: 'root',
      component: 'Tabs',
      tabs: [
        { label: 'Overview', children: ['tab-overview'] },
        { label: 'Details', children: ['tab-details'] },
      ],
    },
    { id: 'tab-overview', component: 'Text', text: 'Overview content' },
    { id: 'tab-details', component: 'Text', text: 'Details content' },
  ],

  'core/Modal': [
    { id: 'root', component: 'Modal', trigger: 'modal-trigger', content: 'modal-content' },
    { id: 'modal-trigger', component: 'Button', child: 'modal-trigger-label' },
    { id: 'modal-trigger-label', component: 'Text', text: 'Open modal' },
    { id: 'modal-content', component: 'Text', text: 'Modal body content' },
  ],

  'core/Accordion': [
    {
      id: 'root',
      component: 'Accordion',
      items: [
        { title: 'Section one', children: ['acc-1'] },
        { title: 'Section two', children: ['acc-2'] },
      ],
    },
    { id: 'acc-1', component: 'Text', text: 'First section body' },
    { id: 'acc-2', component: 'Text', text: 'Second section body' },
  ],

  'core/Video': [
    { id: 'root', component: 'Video', url: 'https://www.w3schools.com/html/mov_bbb.mp4' },
  ],

  'core/AudioPlayer': [
    {
      id: 'root',
      component: 'AudioPlayer',
      url: 'https://www.w3schools.com/html/horse.mp3',
      description: 'Audio preview',
    },
  ],

  // ── Fluent UI overrides ───────────────────────────────────────────────────

  'core/Badge': [
    { id: 'root', component: 'Badge', text: 'New', color: 'brand' },
  ],

  'core/Toggle': [
    { id: 'root', component: 'Toggle', label: 'Dark mode', checked: true },
  ],

  'core/ComboBox': [
    {
      id: 'root',
      component: 'ComboBox',
      label: 'Framework',
      options: [
        { text: 'React', value: 'react' },
        { text: 'Vue', value: 'vue' },
        { text: 'Angular', value: 'angular' },
      ],
    },
  ],

  'core/MultiSelect': [
    {
      id: 'root',
      component: 'MultiSelect',
      label: 'Tags',
      options: [
        { text: 'production', value: 'production' },
        { text: 'staging', value: 'staging' },
        { text: 'dev', value: 'dev' },
      ],
    },
  ],

  // ── Rich components ───────────────────────────────────────────────────────

  'core/Markdown': [
    {
      id: 'root',
      component: 'Markdown',
      content: '## Hello\nThis is **Markdown** rendered inline.',
    },
  ],

  'core/CodeBlock': [
    {
      id: 'root',
      component: 'CodeBlock',
      language: 'typescript',
      code: 'const greet = (name: string) => `Hello, ${name}!`;',
    },
  ],

  'core/ProgressSteps': [
    {
      id: 'root',
      component: 'ProgressSteps',
      steps: [
        { id: 's1', label: 'Plan', status: 'complete' },
        { id: 's2', label: 'Build', status: 'active' },
        { id: 's3', label: 'Deploy', status: 'pending' },
      ],
    },
  ],

  'core/DecisionCard': [
    {
      id: 'root',
      component: 'DecisionCard',
      title: 'Which tier?',
      recommendation: 'Standard',
      rationale: 'Balances cost and performance for most workloads.',
      badge: 'recommended',
    },
  ],

  'core/SummaryCard': [
    {
      id: 'root',
      component: 'SummaryCard',
      title: 'Deployment summary',
      items: [
        { label: 'Cluster', value: 'aks-prod' },
        { label: 'Region', value: 'East US' },
        { label: 'Nodes', value: '3' },
      ],
    },
  ],

  // ── Rich auth / form / progress components ────────────────────────────────

  'core/AuthCard': [
    { id: 'root', component: 'AuthCard', provider: 'azure' },
  ],

  'core/FormGroup': [
    {
      id: 'root',
      component: 'FormGroup',
      title: 'Cluster configuration',
      step: 1,
      child: 'c1',
    },
    { id: 'c1', component: 'TextField', label: 'Cluster name' },
  ],

  'core/GenerationProgress': [
    {
      id: 'root',
      component: 'GenerationProgress',
      title: 'Deploying resources',
      overallStatus: 'running',
      steps: [
        { id: 's1', label: 'Generating Bicep', status: 'complete' },
        { id: 's2', label: 'Validating template', status: 'complete' },
        { id: 's3', label: 'Provisioning cluster', status: 'running' },
        { id: 's4', label: 'Configuring node pools', status: 'pending' },
      ],
    },
  ],

  'core/RadioGroup': [
    {
      id: 'root',
      component: 'RadioGroup',
      options: [
        { id: 'free', label: 'Free', description: 'Dev/test only', recommended: false },
        { id: 'standard', label: 'Standard', description: 'Production workloads', recommended: true },
        { id: 'premium', label: 'Premium', description: 'Mission critical', recommended: false },
      ],
      value: 'standard',
      action: { event: { name: 'tier-selected' } },
    },
  ],

  'core/SteppedCarousel': [
    {
      id: 'root',
      component: 'SteppedCarousel',
      activeStep: 0,
      steps: [
        { title: 'Choose region', child: 'step1' },
        { title: 'Pick node size', child: 'step2' },
        { title: 'Review', child: 'step3' },
      ],
    },
    { id: 'step1', component: 'Text', text: 'Select the Azure region for your cluster.' },
    { id: 'step2', component: 'Text', text: 'Choose a VM size for your system node pool.' },
    { id: 'step3', component: 'Text', text: 'Review your configuration before creating.' },
  ],

  'core/CostEstimate': [
    {
      id: 'root',
      component: 'CostEstimate',
      title: 'Monthly estimate',
      items: [
        { name: 'AKS cluster (Standard_D2s_v3 × 3)', sku: 'Standard', monthlyCost: 219 },
        { name: 'Container Registry (Basic)', monthlyCost: 5 },
        { name: 'Load Balancer', monthlyCost: 18 },
      ],
      currency: 'USD',
    },
  ],
};
