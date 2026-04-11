/**
 * useWidgets — Shared widget state management for the Playground.
 * Widgets are A2UI surfaces created in the "Create" tab and displayed in the "Widgets" tab.
 */
import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
const STORAGE_KEY = 'kickstart-playground-widgets';
function loadWidgets() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    }
    catch {
        return [];
    }
}
const WidgetsContext = createContext(null);
export function WidgetsProvider({ children }) {
    const [widgets, setWidgets] = useState(loadWidgets);
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets));
    }, [widgets]);
    const addWidget = useCallback((name, messages) => {
        const newWidget = {
            id: `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name,
            createdAt: Date.now(),
            messages,
        };
        setWidgets(prev => [...prev, newWidget]);
    }, []);
    const updateWidget = useCallback((id, messages) => {
        setWidgets(prev => prev.map(w => w.id === id ? { ...w, messages } : w));
    }, []);
    const deleteWidget = useCallback((id) => {
        setWidgets(prev => prev.filter(w => w.id !== id));
    }, []);
    const duplicateWidget = useCallback((id) => {
        setWidgets(prev => {
            const widget = prev.find(w => w.id === id);
            if (!widget)
                return prev;
            const newWidget = {
                id: `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                name: `${widget.name} (Copy)`,
                createdAt: Date.now(),
                messages: widget.messages,
            };
            return [...prev, newWidget];
        });
    }, []);
    return (<WidgetsContext.Provider value={{ widgets, addWidget, updateWidget, deleteWidget, duplicateWidget }}>
      {children}
    </WidgetsContext.Provider>);
}
export function useWidgets() {
    const context = useContext(WidgetsContext);
    if (!context) {
        throw new Error('useWidgets must be used within a WidgetsProvider');
    }
    return context;
}
//# sourceMappingURL=useWidgets.js.map