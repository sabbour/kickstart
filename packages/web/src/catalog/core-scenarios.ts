/**
 * Core pack scenario fixtures for the Playground Ideas tab (#987).
 *
 * Each scenario is a full A2UI v0.9 adjacency list composing web-owned
 * catalog renderers and core primitives into a realistic user workflow.
 * First descriptor MUST have
 * `id: 'root'`. Descriptor `component` values are the bare renderer names
 * registered in `ClientComponentRegistry` (same convention as
 * `./core-previews.ts`).
 *
 * Pack-contributed scenarios (`azure/*`, `aks/*`, `github/*`) live in each
 * pack's `./client` subpath export and are aggregated via
 * `./component-scenarios.ts`.
 *
 * SCHEMA INVARIANT: every descriptor's `component` must resolve through the
 * sealed client registry; every `children` / `child` id reference must exist
 * in the adjacency list. Guarded by `__tests__/component-scenarios.test.ts`.
 */

export interface Scenario {
  /** Kebab-case ID, unique across all packs (pack-prefixed by the aggregator). */
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly components: ReadonlyArray<Readonly<Record<string, unknown>>>;
}

export const CORE_SCENARIOS: readonly Scenario[] = Object.freeze([
  {
    id: 'signin-form',
    title: 'Sign in form',
    description: 'Card-framed email/password form with a primary action.',
    components: [
      { id: 'root', component: 'Card', children: ['col'] },
      { id: 'col', component: 'Column', children: ['heading', 'email', 'password', 'submit'] },
      { id: 'heading', component: 'Text', text: 'Sign in to continue' },
      { id: 'email', component: 'TextField', label: 'Email' },
      { id: 'password', component: 'TextField', label: 'Password' },
      { id: 'submit', component: 'Button', child: 'submit-label' },
      { id: 'submit-label', component: 'Text', text: 'Sign in' },
    ],
  },
  {
    id: 'feedback-survey',
    title: 'Quick feedback survey',
    description: 'Rating slider plus a comments field.',
    components: [
      { id: 'root', component: 'Column', children: ['heading', 'rating', 'comments', 'submit'] },
      { id: 'heading', component: 'Text', text: 'How was your experience?' },
      { id: 'rating', component: 'Slider', label: 'Rating', min: 0, max: 10, value: 8 },
      { id: 'comments', component: 'TextField', label: 'Additional comments' },
      { id: 'submit', component: 'Button', child: 'submit-label' },
      { id: 'submit-label', component: 'Text', text: 'Submit feedback' },
    ],
  },
  {
    id: 'confirm-destructive',
    title: 'Confirm a destructive action',
    description: 'Alert with Cancel / Delete actions.',
    components: [
      { id: 'root', component: 'Card', children: ['col'] },
      { id: 'col', component: 'Column', children: ['heading', 'alert', 'actions'] },
      { id: 'heading', component: 'Text', text: 'Delete resource group' },
      {
        id: 'alert',
        component: 'Alert',
        message: 'This action cannot be undone. All resources in the group will be permanently removed.',
        severity: 'warning',
      },
      { id: 'actions', component: 'Row', children: ['cancel', 'confirm'] },
      { id: 'cancel', component: 'Button', child: 'cancel-label' },
      { id: 'cancel-label', component: 'Text', text: 'Cancel' },
      { id: 'confirm', component: 'Button', child: 'confirm-label' },
      { id: 'confirm-label', component: 'Text', text: 'Delete' },
    ],
  },
  {
    id: 'azure-auth-target-selection',
    title: 'Sign in and choose Azure resources',
    description: 'Use the playground mock toggle or real Microsoft sign-in before selecting Azure deployment targets.',
    components: [
      { id: 'root', component: 'Column', children: ['heading', 'login', 'target'] },
      { id: 'heading', component: 'Text', text: 'Test an authenticated Azure deployment flow' },
      {
        id: 'login',
        component: 'AzureLoginCard',
        displayName: 'Azure operator',
        showTokenInfo: true,
      },
      {
        id: 'target',
        component: 'AzureResourcePicker',
        label: 'Choose the subscription and resource group to test with',
      },
    ],
  },
  {
    id: 'github-auth-pr-workflow',
    title: 'Sign in and prepare a GitHub PR',
    description: 'Use the playground mock toggle or real GitHub OAuth before browsing repositories and preparing a PR.',
    components: [
      { id: 'root', component: 'Column', children: ['heading', 'login', 'repo', 'pr'] },
      { id: 'heading', component: 'Text', text: 'Test an authenticated GitHub handoff flow' },
      {
        id: 'login',
        component: 'GitHubLoginCard',
        username: 'octocat',
      },
      {
        id: 'repo',
        component: 'GitHubRepoPicker',
        placeholder: 'Select a real repository from the signed-in account',
        suggestedName: 'kickstart-sample',
        allowCreate: true,
      },
      {
        id: 'pr',
        component: 'GitHubCommit',
        repoFullName: 'kickstart-mock/kickstart-sample',
        defaultBranch: 'main',
        suggestedBranchName: 'kickstart/playground-test',
        suggestedTitle: 'feat: test Kickstart generated artifacts',
      },
    ],
  },
]);
