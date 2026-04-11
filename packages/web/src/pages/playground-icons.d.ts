/**
 * playground-icons.ts — Icon manifest for the A2UI Playground Icons tab.
 *
 * Auto-generated from packages/web/public/assets/icons/
 * Two sections: Azure service icons (by category) and Fluent 2 icons.
 */
export interface IconEntry {
    name: string;
    path: string;
}
export interface IconCategory {
    id: string;
    label: string;
    type: 'azure' | 'fluent' | 'ui' | 'fluent-react';
    icons: IconEntry[];
}
export declare const AZURE_ICON_CATEGORIES: IconCategory[];
export declare const UI_ICON_CATEGORIES: IconCategory[];
export declare const FLUENT_ICON_CATEGORY: IconCategory;
export declare const FLUENT_REACT_ICON_CATEGORY: IconCategory;
export declare const ALL_ICON_CATEGORIES: IconCategory[];
/** Total icon count across all categories */
export declare const TOTAL_ICON_COUNT: number;
//# sourceMappingURL=playground-icons.d.ts.map