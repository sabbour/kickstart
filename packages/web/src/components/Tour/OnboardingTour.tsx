import React from 'react';
import { useTour } from '../../contexts/TourContext';
import { TourStep } from './TourStep';
import { TOUR_STEPS } from './tourSteps';
import type { AppMode } from '../../types';

interface OnboardingTourProps {
  /** Current app mode — controls which steps are visible */
  mode: AppMode;
}

export function OnboardingTour({ mode }: OnboardingTourProps) {
  const { isTourActive, currentStep, totalSteps, nextStep, skipTour, completeTour } = useTour();

  if (!isTourActive) return null;

  const step = TOUR_STEPS[currentStep];
  if (!step) return null;

  // Only render if the current step belongs to the active mode
  if (step.mode !== mode) return null;

  return (
    <TourStep
      key={currentStep}
      targetSelector={step.targetSelector}
      title={step.title}
      body={step.body}
      positioning={step.positioning}
      stepIndex={currentStep}
      totalSteps={totalSteps}
      onNext={nextStep}
      onSkip={skipTour}
      onComplete={completeTour}
    />
  );
}
