import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';

const STORAGE_KEY = 'kickstart-tour';

/** Bump only when steps are added, removed, or reordered — not for copy edits. */
const CURRENT_VERSION = 1;

interface TourState {
  completed: boolean;
  version: number;
  dismissedAt?: string;
}

interface TourContextValue {
  /** Is the tour currently running? */
  isTourActive: boolean;
  /** 0-indexed current step */
  currentStep: number;
  /** Total step count */
  totalSteps: number;
  /** Begin or restart tour */
  startTour: () => void;
  /** Advance to next step */
  nextStep: () => void;
  /** Dismiss tour entirely */
  skipTour: () => void;
  /** Mark tour as done (after last step) */
  completeTour: () => void;
  /** Has user seen the tour before? */
  hasCompletedTour: boolean;
}

const TOTAL_STEPS = 4;

const TourContext = createContext<TourContextValue | null>(null);

function readTourState(): TourState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof parsed.completed === 'boolean' &&
      typeof parsed.version === 'number'
    ) {
      return parsed as TourState;
    }
    return null;
  } catch {
    return null;
  }
}

function writeTourState(state: TourState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

export function TourProvider({ children }: { children: ReactNode }) {
  const [isTourActive, setIsTourActive] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [hasCompletedTour, setHasCompletedTour] = useState(() => {
    const saved = readTourState();
    return saved !== null && saved.completed && saved.version >= CURRENT_VERSION;
  });

  // Auto-start tour for first-time users via requestIdleCallback
  useEffect(() => {
    const saved = readTourState();
    const shouldAutoStart = !saved || !saved.completed || saved.version < CURRENT_VERSION;
    if (!shouldAutoStart) return;

    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(() => {
        setIsTourActive(true);
        setCurrentStep(0);
      });
      return () => window.cancelIdleCallback(id);
    } else {
      // Fallback for Safari — requestAnimationFrame
      const id = window.requestAnimationFrame(() => {
        setIsTourActive(true);
        setCurrentStep(0);
      });
      return () => window.cancelAnimationFrame(id);
    }
  }, []); // Run once on mount

  const startTour = useCallback(() => {
    setCurrentStep(0);
    setIsTourActive(true);
  }, []);

  const nextStep = useCallback(() => {
    setCurrentStep(prev => {
      const next = prev + 1;
      if (next >= TOTAL_STEPS) {
        setIsTourActive(false);
        setHasCompletedTour(true);
        writeTourState({
          completed: true,
          version: CURRENT_VERSION,
          dismissedAt: new Date().toISOString(),
        });
        return prev;
      }
      return next;
    });
  }, []);

  const skipTour = useCallback(() => {
    setIsTourActive(false);
    setHasCompletedTour(true);
    writeTourState({
      completed: true,
      version: CURRENT_VERSION,
      dismissedAt: new Date().toISOString(),
    });
  }, []);

  const completeTour = useCallback(() => {
    setIsTourActive(false);
    setHasCompletedTour(true);
    writeTourState({
      completed: true,
      version: CURRENT_VERSION,
      dismissedAt: new Date().toISOString(),
    });
  }, []);

  return (
    <TourContext.Provider value={{
      isTourActive,
      currentStep,
      totalSteps: TOTAL_STEPS,
      startTour,
      nextStep,
      skipTour,
      completeTour,
      hasCompletedTour,
    }}>
      {children}
    </TourContext.Provider>
  );
}

export function useTour(): TourContextValue {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error('useTour must be used within a TourProvider');
  return ctx;
}
