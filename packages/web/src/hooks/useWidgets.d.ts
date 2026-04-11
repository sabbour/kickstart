/**
 * useWidgets — Shared widget state management for the Playground.
 * Widgets are A2UI surfaces created in the "Create" tab and displayed in the "Widgets" tab.
 */
import React, { ReactNode } from 'react';
import type { A2uiMsg } from '../types';
export interface Widget {
    id: string;
    name: string;
    createdAt: number;
    messages: A2uiMsg[];
}
interface WidgetsContextValue {
    widgets: Widget[];
    addWidget: (name: string, messages: A2uiMsg[]) => void;
    updateWidget: (id: string, messages: A2uiMsg[]) => void;
    deleteWidget: (id: string) => void;
    duplicateWidget: (id: string) => void;
}
export declare function WidgetsProvider({ children }: {
    children: ReactNode;
}): React.JSX.Element;
export declare function useWidgets(): WidgetsContextValue;
export {};
//# sourceMappingURL=useWidgets.d.ts.map