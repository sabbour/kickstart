import React from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema } from '../../vendor/a2ui/web_core/schema/common-types';
import {
  Body1,
  Body2,
  Caption1,
  Card,
  Spinner,
  Subtitle2,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  CheckmarkCircleRegular,
  DismissCircleRegular,
  CircleRegular,
} from '@fluentui/react-icons';

const DeploymentStepSchema = z.object({
  id: z.string(),
  label: DynamicStringSchema,
  status: z.enum(['pending', 'running', 'complete', 'error']),
  detail: DynamicStringSchema.optional(),
  timestamp: DynamicStringSchema.optional(),
});

const DeploymentProgressApi = {
  name: 'DeploymentProgress',
  schema: z.object({
    steps: z.array(DeploymentStepSchema),
    title: DynamicStringSchema.optional(),
    overallStatus: z.enum(['idle', 'running', 'complete', 'error']).optional(),
  }).strict(),
};

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    width: '100%',
    padding: '0',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    backgroundColor: tokens.colorNeutralBackground2,
    borderBottomWidth: tokens.strokeWidthThin,
    borderBottomStyle: 'solid',
    borderBottomColor: tokens.colorNeutralStroke2,
  },
  stepList: {
    display: 'flex',
    flexDirection: 'column',
    padding: `${tokens.spacingVerticalXS} 0`,
  },
  step: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: tokens.spacingHorizontalM,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
    position: 'relative',
  },
  stepWithConnector: {
    '::before': {
      content: '""',
      position: 'absolute',
      left: `calc(${tokens.spacingHorizontalM} + 11px)`,
      top: '28px',
      bottom: '0',
      width: '2px',
      backgroundColor: tokens.colorNeutralStroke2,
    },
  },
  iconWrapper: {
    flexShrink: 0,
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: '2px',
  },
  iconComplete: {
    color: tokens.colorPaletteGreenForeground3,
    fontSize: '20px',
  },
  iconError: {
    color: tokens.colorPaletteRedForeground3,
    fontSize: '20px',
  },
  iconPending: {
    color: tokens.colorNeutralForeground4,
    fontSize: '20px',
  },
  stepContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
    paddingBottom: tokens.spacingVerticalXS,
  },
  stepLabel: {
    fontWeight: tokens.fontWeightSemibold,
  },
  stepLabelComplete: {
    color: tokens.colorNeutralForeground1,
  },
  stepLabelRunning: {
    color: tokens.colorBrandForeground1,
  },
  stepLabelPending: {
    color: tokens.colorNeutralForeground3,
  },
  stepLabelError: {
    color: tokens.colorPaletteRedForeground3,
  },
  stepDetail: {
    color: tokens.colorNeutralForeground2,
  },
  stepTimestamp: {
    color: tokens.colorNeutralForeground4,
    fontFamily: tokens.fontFamilyMonospace,
  },
});

export const DeploymentProgress = createReactComponent(DeploymentProgressApi, ({ props }) => {
  const classes = useStyles();
  const steps = props.steps ?? [];
  const overallStatus = props.overallStatus ?? 'idle';

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'complete':
        return <CheckmarkCircleRegular className={classes.iconComplete} />;
      case 'error':
        return <DismissCircleRegular className={classes.iconError} />;
      case 'running':
        return <Spinner size="tiny" />;
      default:
        return <CircleRegular className={classes.iconPending} />;
    }
  };

  const getLabelClass = (status: string) => {
    switch (status) {
      case 'complete': return classes.stepLabelComplete;
      case 'running': return classes.stepLabelRunning;
      case 'error': return classes.stepLabelError;
      default: return classes.stepLabelPending;
    }
  };

  return (
    <Card className={classes.root}>
      <div className={classes.header}>
        {overallStatus === 'running' && <Spinner size="tiny" />}
        {overallStatus === 'complete' && <CheckmarkCircleRegular className={classes.iconComplete} />}
        {overallStatus === 'error' && <DismissCircleRegular className={classes.iconError} />}
        <Subtitle2>{props.title ?? 'Deployment Progress'}</Subtitle2>
      </div>

      <div className={classes.stepList}>
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1;
          return (
            <div
              key={step.id}
              className={`${classes.step} ${!isLast ? classes.stepWithConnector : ''}`}
            >
              <div className={classes.iconWrapper}>
                {getStatusIcon(step.status)}
              </div>
              <div className={classes.stepContent}>
                <Body1 className={`${classes.stepLabel} ${getLabelClass(step.status)}`}>
                  {step.label}
                </Body1>
                {step.detail && (
                  <Caption1 className={classes.stepDetail}>{step.detail}</Caption1>
                )}
                {step.timestamp && (
                  <Caption1 className={classes.stepTimestamp}>{step.timestamp}</Caption1>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
});
