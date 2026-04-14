import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

const STORAGE_KEY = 'kickstart-onboarding-complete';

interface TourStep {
  selector: string;
  title: string;
  body: string;
  position: 'bottom' | 'top' | 'left' | 'right';
}

const TOUR_RESTART_EVENT = 'kickstart-tour-restart';

const STEPS: TourStep[] = [
  {
    selector: '.landing-hero-input-wrap',
    title: 'Describe your app idea',
    body: 'Type what you want to build — a web app, API, or AI agent. Kickstart will guide you through designing, deploying, and running it on Azure.',
    position: 'bottom',
  },
  {
    selector: '.landing-tracks',
    title: 'Pick a track',
    body: "Not sure where to start? Choose a track like Web App or AI Agent to jump into a tailored journey.",
    position: 'bottom',
  },
  {
    selector: '.framework-pills',
    title: 'Start with a framework',
    body: 'Already know your stack? Click a framework pill to skip the discovery step and dive straight in.',
    position: 'top',
  },
  {
    selector: '.landing-ide',
    title: 'Use your IDE with MCP',
    body: 'Use Visual Studio Code to create your apps using the MCP server. Click the VS Code button to install the Kickstart MCP extension.',
    position: 'top',
  },
];

function getTooltipStyle(
  targetRect: DOMRect,
  position: TourStep['position'],
  tooltipEl: HTMLDivElement | null,
): React.CSSProperties {
  const gap = 12;
  const tooltipWidth = tooltipEl?.offsetWidth ?? 320;
  const tooltipHeight = tooltipEl?.offsetHeight ?? 160;

  let top = 0;
  let left = 0;

  switch (position) {
    case 'bottom':
      top = targetRect.bottom + gap + window.scrollY;
      left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
      break;
    case 'top':
      top = targetRect.top - tooltipHeight - gap + window.scrollY;
      left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2;
      break;
    case 'left':
      top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2 + window.scrollY;
      left = targetRect.left - tooltipWidth - gap;
      break;
    case 'right':
      top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2 + window.scrollY;
      left = targetRect.right + gap;
      break;
  }

  // Clamp to viewport
  left = Math.max(12, Math.min(left, window.innerWidth - tooltipWidth - 12));
  top = Math.max(12, top);

  return { top, left };
}

export function OnboardingTour() {
  const [active, setActive] = useState(false);
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Show tour only if not completed
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY) === 'true') return;
    // Small delay so Landing elements are mounted
    const timer = setTimeout(() => setActive(true), 600);
    return () => clearTimeout(timer);
  }, []);

  // Listen for restart event
  useEffect(() => {
    const onRestart = () => {
      setStep(0);
      setActive(true);
    };
    window.addEventListener(TOUR_RESTART_EVENT, onRestart);
    return () => window.removeEventListener(TOUR_RESTART_EVENT, onRestart);
  }, []);

  // Measure target element whenever step changes
  useEffect(() => {
    if (!active) return;
    const el = document.querySelector(STEPS[step].selector);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [active, step]);

  // Recalculate on resize/scroll
  useEffect(() => {
    if (!active) return;
    const update = () => {
      const el = document.querySelector(STEPS[step].selector);
      if (el) setTargetRect(el.getBoundingClientRect());
    };
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [active, step]);

  const completeTour = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setActive(false);
  }, []);

  const handleNext = useCallback(() => {
    if (step < STEPS.length - 1) {
      setStep(s => s + 1);
    } else {
      completeTour();
    }
  }, [step, completeTour]);

  const handleSkip = useCallback(() => {
    completeTour();
  }, [completeTour]);

  // Handle Escape key
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') completeTour();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, completeTour]);

  if (!active || !targetRect) return null;

  const current = STEPS[step];
  const pad = 8;
  const spotlightRect = {
    x: targetRect.x - pad,
    y: targetRect.y - pad + window.scrollY,
    w: targetRect.width + pad * 2,
    h: targetRect.height + pad * 2,
    rx: 10,
  };

  const tooltipStyle = getTooltipStyle(targetRect, current.position, tooltipRef.current);

  return createPortal(
    <div className="onboarding-tour-overlay" aria-modal="true" role="dialog" aria-label="Onboarding tour">
      {/* SVG overlay with spotlight cutout */}
      <svg className="onboarding-tour-svg" aria-hidden="true">
        <defs>
          <mask id="onboarding-spotlight-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <rect
              x={spotlightRect.x}
              y={spotlightRect.y}
              width={spotlightRect.w}
              height={spotlightRect.h}
              rx={spotlightRect.rx}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          x="0" y="0"
          width="100%" height="100%"
          fill="rgba(0,0,0,0.55)"
          mask="url(#onboarding-spotlight-mask)"
        />
      </svg>

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className={`onboarding-tour-tooltip onboarding-tour-tooltip--${current.position}`}
        style={tooltipStyle}
        role="status"
      >
        <div className="onboarding-tour-tooltip-header">
          <span className="onboarding-tour-step-badge">
            {step + 1} / {STEPS.length}
          </span>
          <h3 className="onboarding-tour-title">{current.title}</h3>
        </div>
        <p className="onboarding-tour-body">{current.body}</p>
        <div className="onboarding-tour-actions">
          <button className="onboarding-tour-skip" onClick={handleSkip}>
            Skip tour
          </button>
          <button className="onboarding-tour-next" onClick={handleNext} autoFocus>
            {step < STEPS.length - 1 ? 'Next' : 'Got it!'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Reset and immediately relaunch the onboarding tour. */
export function resetOnboardingTour() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(TOUR_RESTART_EVENT));
}
