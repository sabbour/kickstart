import type { ContributionSource } from './agent.js';

export interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  author?: string;
  license?: string;
  instructions: string;
  appliesTo: string[];
  keywords: string[];
  priority: number;
  source: ContributionSource;
}
