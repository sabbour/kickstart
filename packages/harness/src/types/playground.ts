import type { A2UIMessageV09 } from './a2ui.js';

export interface PlaygroundScenario {
  id: string;
  title: string;
  description?: string;
  group?: string;
  a2ui: A2UIMessageV09[];
  initialState?: Record<string, unknown>;
  requiresUserActionStubs?: string[];
}
