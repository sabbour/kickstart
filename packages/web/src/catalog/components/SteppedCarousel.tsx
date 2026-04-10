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
  const totalSteps = props.steps.length;
  const clampedStep = Math.max(0, Math.min(currentStep, totalSteps - 1));
  const activeStepData = props.steps[clampedStep];
  const isFirst = clampedStep === 0;
  const isLast = clampedStep === totalSteps - 1;

  return (
    <Card className={classes.root}>
      {/* Step indicator bar */}
      <div className={classes.indicators}>
        {props.steps.map((step, i) => {
          let pillClass = classes.pillUpcoming;
          if (i === clampedStep) pillClass = classes.pillActive;
          else if (i < clampedStep) pillClass = classes.pillCompleted;

          return (
            <div key={i} className={classes.indicator}>
              <div className={`${classes.pill} ${pillClass}`} />
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

      {/* Active step content */}
      <div className={classes.body}>
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
          onClick={() => setCurrentStep(s => Math.max(0, s - 1))}
        >
          Previous
        </Button>

        <Button
          appearance="primary"
          icon={isLast ? <CheckmarkRegular /> : <ChevronRightRegular />}
          iconPosition="after"
          onClick={() => {
            if (!isLast) setCurrentStep(s => s + 1);
          }}
        >
          {isLast ? 'Done' : 'Next'}
        </Button>
      </div>
    </Card>
  );
});
