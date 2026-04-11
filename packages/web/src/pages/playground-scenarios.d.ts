/**
 * playground-scenarios.ts — All scenario definitions for the A2UI Playground.
 *
 * Two categories:
 *   1. Kickstart Scenarios — the 8 app-specific demo flows (driven by demo-scenarios.ts)
 *   2. Basic Controls     — one scenario per built-in A2UI component
 */
import type { A2uiMsg } from '../types';
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
export declare const KICKSTART_SCENARIOS: ScenarioDef[];
export declare const CONTROL_SCENARIOS: ScenarioDef[];
/** All scenario groups in display order */
export declare const SCENARIO_GROUPS: readonly ["Kickstart Scenarios", "Layout", "Content", "Inputs", "Custom Controls", "Data Binding", "Events & Actions", "Surface Lifecycle", "Dynamic Patterns"];
/** Combined list of all scenarios */
export declare const ALL_SCENARIOS: ScenarioDef[];
/** Get scenarios grouped by their group name */
export declare function getGroupedScenarios(): Map<string, ScenarioDef[]>;
//# sourceMappingURL=playground-scenarios.d.ts.map