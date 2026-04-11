/**
 * fluent-icons.ts — Fluent UI React icon registry for A2UI Icon components.
 *
 * Registers the top ~30 most useful Fluent UI icons so they can be used
 * by name in A2UI Icon components: { "component": "Icon", "name": "document" }
 *
 * These live alongside Material Symbols (used via the material-symbols-outlined
 * CSS font class in the vendor A2UI renderer).
 */
import React from 'react';
import type { FluentIcon } from '@fluentui/react-icons';
/** Map of icon name → Fluent UI React icon component. */
export declare const FLUENT_REACT_ICON_REGISTRY: Record<string, FluentIcon>;
export type FluentIconName = keyof typeof FLUENT_REACT_ICON_REGISTRY;
/**
 * Looks up a Fluent UI React icon component by name.
 * Returns null if the name is not registered.
 */
export declare function getFluentIcon(name: string): FluentIcon | null;
/**
 * Renders a Fluent UI React icon as a React element.
 * Returns null if the name is not registered.
 */
export declare function renderFluentIcon(name: string, props?: {
    className?: string;
    style?: React.CSSProperties;
}): React.ReactElement | null;
//# sourceMappingURL=fluent-icons.d.ts.map