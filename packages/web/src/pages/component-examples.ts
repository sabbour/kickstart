/**
 * Component preview examples for the Playground Components tab.
 *
 * Maps a fully-qualified component name (e.g. "core/Text") to a flat array of
 * A2UI component descriptors that can be passed directly as the `components`
 * array of an `updateComponents` message.  The first component MUST have
 * id="root" so the A2UI surface renders it as the tree root.
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
    { id: 'root', component: 'core/Text', text: 'Hello, world!' },
  ],

  'core/Button': [
    { id: 'root', component: 'core/Button', text: 'Click me' },
  ],

  'core/Image': [
    {
      id: 'root',
      component: 'core/Image',
      url: '/assets/icons/fluent/sparkle.svg',
      description: 'Sparkle icon',
      variant: 'icon',
    },
  ],

  'core/Icon': [
    { id: 'root', component: 'core/Icon', name: '/assets/icons/fluent/sparkle.svg' },
  ],

  'core/Link': [
    { id: 'root', component: 'core/Link', text: 'Open link', url: '#' },
  ],

  'core/Divider': [
    { id: 'root', component: 'core/Divider' },
  ],

  'core/Alert': [
    { id: 'root', component: 'core/Alert', text: 'This is an alert message.', intent: 'info' },
  ],

  'core/TextField': [
    { id: 'root', component: 'core/TextField', label: 'Name', placeholder: 'Enter your name' },
  ],

  'core/CheckBox': [
    { id: 'root', component: 'core/CheckBox', label: 'Enable feature', checked: false },
  ],

  'core/Slider': [
    { id: 'root', component: 'core/Slider', label: 'Volume', min: 0, max: 100, value: 40 },
  ],

  'core/DateTimeInput': [
    { id: 'root', component: 'core/DateTimeInput', label: 'Scheduled date' },
  ],

  'core/ChoicePicker': [
    {
      id: 'root',
      component: 'core/ChoicePicker',
      label: 'Region',
      choices: [
        { label: 'East US', value: 'eastus' },
        { label: 'West Europe', value: 'westeurope' },
      ],
    },
  ],

  'core/Row': [
    {
      id: 'root',
      component: 'core/Row',
      children: ['c1', 'c2'],
    },
    { id: 'c1', component: 'core/Text', text: 'Left' },
    { id: 'c2', component: 'core/Text', text: 'Right' },
  ],

  'core/Column': [
    {
      id: 'root',
      component: 'core/Column',
      children: ['c1', 'c2'],
    },
    { id: 'c1', component: 'core/Text', text: 'First' },
    { id: 'c2', component: 'core/Text', text: 'Second' },
  ],

  'core/Card': [
    {
      id: 'root',
      component: 'core/Card',
      children: ['c1'],
    },
    { id: 'c1', component: 'core/Text', text: 'Card content' },
  ],

  'core/List': [
    {
      id: 'root',
      component: 'core/List',
      items: ['Item one', 'Item two', 'Item three'],
    },
  ],

  'core/Table': [
    {
      id: 'root',
      component: 'core/Table',
      columns: [{ label: 'Name', key: 'name' }, { label: 'Status', key: 'status' }],
      rows: [
        { name: 'Alice', status: 'Active' },
        { name: 'Bob', status: 'Inactive' },
      ],
    },
  ],

  // ── Fluent UI overrides ───────────────────────────────────────────────────

  'core/Badge': [
    { id: 'root', component: 'core/Badge', text: 'New', color: 'brand' },
  ],

  'core/Toggle': [
    { id: 'root', component: 'core/Toggle', label: 'Dark mode', checked: true },
  ],

  'core/ComboBox': [
    {
      id: 'root',
      component: 'core/ComboBox',
      label: 'Framework',
      options: ['React', 'Vue', 'Angular'],
    },
  ],

  'core/MultiSelect': [
    {
      id: 'root',
      component: 'core/MultiSelect',
      label: 'Tags',
      options: ['production', 'staging', 'dev'],
    },
  ],

  // ── Rich components ───────────────────────────────────────────────────────

  'core/Markdown': [
    {
      id: 'root',
      component: 'core/Markdown',
      content: '## Hello\nThis is **Markdown** rendered inline.',
    },
  ],

  'core/CodeBlock': [
    {
      id: 'root',
      component: 'core/CodeBlock',
      language: 'typescript',
      code: 'const greet = (name: string) => `Hello, ${name}!`;',
    },
  ],

  'core/ProgressSteps': [
    {
      id: 'root',
      component: 'core/ProgressSteps',
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
      component: 'core/DecisionCard',
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
      component: 'core/SummaryCard',
      title: 'Deployment summary',
      items: [
        { label: 'Cluster', value: 'aks-prod' },
        { label: 'Region', value: 'East US' },
        { label: 'Nodes', value: '3' },
      ],
    },
  ],
};
