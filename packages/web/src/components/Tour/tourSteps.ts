import type { PositioningShorthand } from '@fluentui/react-components';

export interface TourStepDefinition {
  /** CSS selector for the target element */
  targetSelector: string;
  /** Step title */
  title: string;
  /** Step body content */
  body: string;
  /** Popover placement relative to target */
  positioning: PositioningShorthand;
  /** Which app mode this step belongs to: 'landing' or 'chat' */
  mode: 'landing' | 'chat';
}

export const TOUR_STEPS: TourStepDefinition[] = [
  {
    targetSelector: '.landing-hero',
    title: 'Welcome to Kickstart',
    body: 'Describe what you want to build — a web app, API, AI agent, or anything on Azure. Kickstart guides you from idea to deployed code.',
    positioning: 'below',
    mode: 'landing',
  },
  {
    targetSelector: '.landing-tracks',
    title: 'Pick a Starting Point',
    body: 'Choose a track or type your own idea. Try: "Deploy a Node.js API" or "I have a Python ML model".',
    positioning: 'above',
    mode: 'landing',
  },
  {
    targetSelector: '.chat-phase',
    title: 'Your Journey Has Phases',
    body: 'Kickstart walks you through Discover → Plan → Build → Deploy → Validate. Each phase focuses on a different part of bringing your idea to life.',
    positioning: 'below',
    mode: 'chat',
  },
  {
    targetSelector: '.chat-input-area',
    title: 'Start Chatting',
    body: 'Type what you want to build and hit Enter. Kickstart will ask clarifying questions, then generate code, infra, and deployment configs.',
    positioning: 'above',
    mode: 'chat',
  },
];
