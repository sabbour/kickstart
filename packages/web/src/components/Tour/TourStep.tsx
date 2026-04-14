import React, { useEffect, useState, useRef } from 'react';
import {
  TeachingPopover,
  TeachingPopoverSurface,
  TeachingPopoverHeader,
  TeachingPopoverBody,
  TeachingPopoverTitle,
  TeachingPopoverFooter,
} from '@fluentui/react-components';
import type { PositioningShorthand } from '@fluentui/react-components';

interface TourStepProps {
  targetSelector: string;
  title: string;
  body: string;
  positioning: PositioningShorthand;
  stepIndex: number;
  totalSteps: number;
  onNext: () => void;
  onSkip: () => void;
  onComplete: () => void;
}

export function TourStep({
  targetSelector,
  title,
  body,
  positioning,
  stepIndex,
  totalSteps,
  onNext,
  onSkip,
  onComplete,
}: TourStepProps) {
  const [targetEl, setTargetEl] = useState<HTMLElement | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const find = (attempts: number) => {
      const el = document.querySelector<HTMLElement>(targetSelector);
      if (el) {
        setTargetEl(el);
        return;
      }
      if (attempts > 0) {
        retryRef.current = setTimeout(() => find(attempts - 1), 200);
      }
    };
    find(10);
    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [targetSelector]);

  // If target element doesn't appear within retries, skip this step gracefully
  useEffect(() => {
    skipTimerRef.current = setTimeout(() => {
      if (!targetEl) onNext();
    }, 2500);
    return () => {
      if (skipTimerRef.current) clearTimeout(skipTimerRef.current);
    };
  }, [targetEl, onNext]);

  if (!targetEl) return null;

  const isLast = stepIndex === totalSteps - 1;

  return (
    <TeachingPopover
      open
      appearance="brand"
      positioning={{ target: targetEl, position: positioning as string }}
      withArrow
    >
      <TeachingPopoverSurface
        aria-label={`Tour step ${stepIndex + 1} of ${totalSteps}`}
      >
        <TeachingPopoverHeader
          dismissButton={{ onClick: onSkip, 'aria-label': 'Dismiss tour' }}
        >
          {`Step ${stepIndex + 1} of ${totalSteps}`}
        </TeachingPopoverHeader>
        <TeachingPopoverBody>
          <TeachingPopoverTitle>{title}</TeachingPopoverTitle>
          <p>{body}</p>
        </TeachingPopoverBody>
        <TeachingPopoverFooter
          primary={{
            children: isLast ? 'Got it!' : 'Next',
            'aria-label': isLast ? 'Complete tour' : `Go to step ${stepIndex + 2}`,
            onClick: isLast ? onComplete : onNext,
          }}
          secondary={isLast ? undefined : {
            children: 'Skip tour',
            'aria-label': 'Skip tour',
            appearance: 'subtle' as const,
            onClick: onSkip,
          }}
        />
      </TeachingPopoverSurface>
    </TeachingPopover>
  );
}
