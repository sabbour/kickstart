/**
 * Component preview examples for the Playground Components tab.
 *
 * Maps a fully-qualified component name (e.g. "core/Text") to a flat array of
 * A2UI component descriptors that can be passed directly as the `components`
 * array of an `updateComponents` message.  The first component MUST have
 * id="root" so the A2UI surface renders it as the tree root.
 *
 * IMPORTANT — naming convention:
 *   • Map KEYS use the pack-qualified id (`core/Text`) because they are matched
 *     against `comp.name` from the `/api/packs` response.
 *   • Descriptor `component` VALUES must be the bare renderer name (`Text`)
 *     because `clientRegistry` keys renderers by `impl.name` (see main.tsx
 *     and A2UIRegistryContext.tsx). Using `core/Text` here would miss the
 *     registry and render `_ErrorComponent`. See #954.
 *
 * Keep entries minimal — the goal is a recognisable thumbnail, not a full demo.
 * Components whose previews require complex setup (e.g. ArchitectureDiagram,
 * FileEditor) are intentionally omitted; ComponentCard falls back gracefully to
 * a "no preview" placeholder.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- component props are untyped by design
export type ComponentPreviewEntry = Record<string, any>[];

export const COMPONENT_PREVIEWS: Readonly<Record<string, ComponentPreviewEntry>> = {
  // ── Basic components ──────────────────────────────────────────────────────

  'core/Text': [
    { id: 'root', component: 'Text', text: 'Hello, world!' },
  ],

  'core/Button': [
    { id: 'root', component: 'Button', text: 'Click me' },
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
        { label: 'Plan', status: 'completed' },
        { label: 'Build', status: 'current' },
        { label: 'Deploy', status: 'upcoming' },
      ],
    },
  ],

  'core/DecisionCard': [
    {
      id: 'root',
      component: 'DecisionCard',
      title: 'Deploy to production?',
      description: 'This will update the live environment.',
      options: [
        { label: 'Deploy', value: 'deploy' },
        { label: 'Cancel', value: 'cancel' },
      ],
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
};
