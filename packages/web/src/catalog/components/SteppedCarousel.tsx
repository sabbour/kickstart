import React, { useState } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import {
  DynamicStringSchema,
  ComponentIdSchema,
} from '../../vendor/a2ui/web_core/schema/common-types';
import {
  Card,
  Button,
  Subtitle2,
  Caption1,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  ChevronLeftRegular,
  ChevronRightRegular,
  CheckmarkRegular,
} from '@fluentui/react-icons';

const SteppedCarouselApi = {
  name: 'SteppedCarousel',
  schema: z.object({
    steps: z.array(z.object({
      title: DynamicStringSchema,
      child: ComponentIdSchema,
    })),
    activeStep: z.number().optional(),
  }).strict(),
};

const slideFromRight = {
  from: { opacity: 0, transform: 'translateX(24px)' },
  to: { opacity: 1, transform: 'translateX(0)' },
};

const slideFromLeft = {
  from: { opacity: 0, transform: 'translateX(-24px)' },
  to: { opacity: 1, transform: 'translateX(0)' },
};

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    width: '100%',
    padding: tokens.spacingHorizontalL,
  },
  indicators: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalM,
    flexWrap: 'wrap',
  },
  indicator: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
  },
  pill: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
  },
  pillActive: {
    backgroundColor: tokens.colorBrandBackground,
  },
  pillCompleted: {
    backgroundColor: tokens.colorBrandBackground,
    opacity: 0.5,
  },
  pillUpcoming: {
    backgroundColor: tokens.colorNeutralStroke2,
  },
  body: {
    marginTop: tokens.spacingVerticalM,
    marginBottom: tokens.spacingVerticalM,
  },
  bodyEnterNext: {
    animationName: slideFromRight,
    animationDuration: tokens.durationNormal,
    animationTimingFunction: tokens.curveEasyEase,
    animationFillMode: 'both',
  },
  bodyEnterPrev: {
    animationName: slideFromLeft,
    animationDuration: tokens.durationNormal,
    animationTimingFunction: tokens.curveEasyEase,
    animationFillMode: 'both',
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalM,
  },
  stepInfo: {
    marginRight: 'auto',
  },
});

export const SteppedCarousel = createReactComponent(SteppedCarouselApi, ({ props, buildChild }) => {
  const classes = useStyles();
  const initialStep = props.activeStep ?? 0;
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const totalSteps = props.steps.length;
  const clampedStep = Math.max(0, Math.min(currentStep, totalSteps - 1));
  const activeStepData = props.steps[clampedStep];
  const isFirst = clampedStep === 0;
  const isLast = clampedStep === totalSteps - 1;

  return (
    <Card className={classes.root}>
      {/* Step indicator bar */}
      <div className={classes.indicators} role="tablist" aria-label="Carousel steps">
        {props.steps.map((step, i) => {
          let pillClass = classes.pillUpcoming;
          if (i === clampedStep) pillClass = classes.pillActive;
          else if (i < clampedStep) pillClass = classes.pillCompleted;

          return (
            <div key={i} className={classes.indicator} role="tab" aria-selected={i === clampedStep} aria-label={`Step ${i + 1}: ${step.title}`}>
              <div className={`${classes.pill} ${pillClass}`} aria-hidden="true" />
              <Caption1
                style={{
                  color: i === clampedStep
                    ? tokens.colorBrandForeground1
                    : tokens.colorNeutralForeground3,
                  fontWeight: i === clampedStep ? 600 : 400,
                }}
              >
                {step.title}
              </Caption1>
            </div>
          );
        })}
      </div>

      {/* Active step title */}
      <Subtitle2>{activeStepData?.title}</Subtitle2>

      {/* Active step content — key forces remount so CSS animation replays */}
      <div
        key={clampedStep}
        className={`${classes.body} ${direction === 'next' ? classes.bodyEnterNext : classes.bodyEnterPrev}`}
        role="tabpanel"
        aria-live="polite"
        aria-label={`Step ${clampedStep + 1}: ${activeStepData?.title}`}
      >
        {activeStepData?.child ? buildChild(activeStepData.child) : null}
      </div>

      {/* Navigation footer */}
      <div className={classes.footer}>
        <Caption1 className={classes.stepInfo}>
          Step {clampedStep + 1} of {totalSteps}
        </Caption1>

        <Button
          appearance="subtle"
          icon={<ChevronLeftRegular />}
          disabled={isFirst}
          onClick={() => {
            setDirection('prev');
            setCurrentStep(s => Math.max(0, s - 1));
          }}
          aria-label="Go to previous step"
        >
          Previous
        </Button>

        <Button
          appearance="primary"
          icon={isLast ? <CheckmarkRegular /> : <ChevronRightRegular />}
          iconPosition="after"
          onClick={() => {
            if (!isLast) {
              setDirection('next');
              setCurrentStep(s => s + 1);
            }
          }}
          aria-label={isLast ? 'Complete carousel' : 'Go to next step'}
        >
          {isLast ? 'Done' : 'Next'}
        </Button>
      </div>
    </Card>
  );
});
