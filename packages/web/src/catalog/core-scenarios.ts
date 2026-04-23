/**
 * Core pack scenario fixtures for the Playground Ideas tab (#987).
 *
 * Each scenario is a full A2UI v0.9 adjacency list composing 2–4 `core/*`
 * primitives into a realistic user workflow. First descriptor MUST have
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
]);
