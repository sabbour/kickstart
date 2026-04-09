/**
 * useWidgets — Shared widget state management for the Playground.
 * Widgets are A2UI surfaces created in the "Create" tab and displayed in the "Widgets" tab.
 */

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
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

const WidgetsContext = createContext<WidgetsContextValue | null>(null);

export function WidgetsProvider({ children }: { children: ReactNode }) {
  const [widgets, setWidgets] = useState<Widget[]>([]);

  const addWidget = useCallback((name: string, messages: A2uiMsg[]) => {
    const newWidget: Widget = {
      id: `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      createdAt: Date.now(),
      messages,
    };
    setWidgets(prev => [...prev, newWidget]);
  }, []);

  const updateWidget = useCallback((id: string, messages: A2uiMsg[]) => {
    setWidgets(prev => prev.map(w => w.id === id ? { ...w, messages } : w));
  }, []);

  const deleteWidget = useCallback((id: string) => {
    setWidgets(prev => prev.filter(w => w.id !== id));
  }, []);

  const duplicateWidget = useCallback((id: string) => {
    setWidgets(prev => {
      const widget = prev.find(w => w.id === id);
      if (!widget) return prev;
      const newWidget: Widget = {
        id: `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: `${widget.name} (Copy)`,
        createdAt: Date.now(),
        messages: widget.messages,
      };
      return [...prev, newWidget];
    });
  }, []);

  return (
    <WidgetsContext.Provider value={{ widgets, addWidget, updateWidget, deleteWidget, duplicateWidget }}>
      {children}
    </WidgetsContext.Provider>
  );
}

export function useWidgets(): WidgetsContextValue {
  const context = useContext(WidgetsContext);
  if (!context) {
    throw new Error('useWidgets must be used within a WidgetsProvider');
  }
  return context;
}
