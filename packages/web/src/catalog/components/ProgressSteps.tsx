import React from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema } from '../../vendor/a2ui/web_core/schema/common-types';
import {
  Body1,
  Caption1,
  Badge,
  makeStyles,
  tokens,
} from '@fluentui/react-components';

const ProgressStepsApi = {
  name: 'ProgressSteps',
  schema: z.object({
    steps: z.array(z.object({
      id: z.string(),
      label: DynamicStringSchema,
      status: z.enum(['pending', 'active', 'complete', 'error']),
    })),
  }).strict(),
};

const useStyles = makeStyles({
  root: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: tokens.spacingHorizontalL,
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    overflowX: 'auto',
  },
  step: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalXS,
    position: 'relative',
  },
  dot: {
    width: '28px',
    height: '28px',
    borderRadius: tokens.borderRadiusCircular,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase200,
  },
  dotPending: {
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground3,
  },
  dotActive: {
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
  },
  dotComplete: {
    backgroundColor: tokens.colorPaletteGreenBackground3,
    color: tokens.colorNeutralForegroundOnBrand,
  },
  dotError: {
    backgroundColor: tokens.colorPaletteRedBackground3,
    color: tokens.colorNeutralForegroundOnBrand,
  },
});

export const ProgressSteps = createReactComponent(ProgressStepsApi, ({ props }) => {
  const steps = props.steps || [];
  const classes = useStyles();

  const getDotClass = (status: string) => {
    switch (status) {
      case 'complete': return classes.dotComplete;
      case 'active': return classes.dotActive;
      case 'error': return classes.dotError;
      default: return classes.dotPending;
    }
  };

  return (
    <div className={classes.root}>
      {steps.map((step, i) => (
        <div key={step.id} className={classes.step}>
          <div className={`${classes.dot} ${getDotClass(step.status)}`}>
            {step.status === 'complete' && '✓'}
            {step.status === 'error' && '✕'}
            {step.status === 'active' && '●'}
            {step.status === 'pending' && (i + 1)}
          </div>
          <Caption1>{step.label}</Caption1>
        </div>
      ))}
    </div>
  );
});
