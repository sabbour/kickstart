import React from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema } from '../../vendor/a2ui/schema/common-types';
import {
  Body1,
  Body2,
  Button,
  Caption1,
  Card,
  MessageBar,
  MessageBarBody,
  Spinner,
  Subtitle1,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  CheckmarkCircleRegular,
  DismissCircleRegular,
  CircleRegular,
} from '@fluentui/react-icons';

const GenerationStepSchema = z.object({
  id: z.string(),
  label: DynamicStringSchema,
  status: z.enum(['pending', 'running', 'complete', 'error', 'skipped']),
  detail: DynamicStringSchema.optional(),
  timestamp: DynamicStringSchema.optional(),
});

const GenerationProgressApi = {
  name: 'GenerationProgress',
  schema: z.object({
    steps: z.array(GenerationStepSchema),
    title: DynamicStringSchema.optional(),
    overallStatus: z.enum(['idle', 'running', 'complete', 'error']).optional(),
    statusMessage: DynamicStringSchema.optional(),
    appUrl: DynamicStringSchema.optional(),
    portalUrl: DynamicStringSchema.optional(),
    errorCode: DynamicStringSchema.optional(),
    errorMessage: DynamicStringSchema.optional(),
    lastUpdated: DynamicStringSchema.optional(),
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
  iconComplete: { color: tokens.colorPaletteGreenForeground3, fontSize: '20px' },
  iconError: { color: tokens.colorPaletteRedForeground3, fontSize: '20px' },
  iconPending: { color: tokens.colorNeutralForeground4, fontSize: '20px' },
  stepContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
    paddingBottom: tokens.spacingVerticalXS,
  },
  stepLabel: { fontWeight: tokens.fontWeightSemibold },
  stepLabelComplete: { color: tokens.colorNeutralForeground1 },
  stepLabelRunning: { color: tokens.colorBrandForeground1 },
  stepLabelPending: { color: tokens.colorNeutralForeground3 },
  stepLabelError: { color: tokens.colorPaletteRedForeground3 },
  stepDetail: { color: tokens.colorNeutralForeground2 },
  stepTimestamp: { color: tokens.colorNeutralForeground4, fontFamily: tokens.fontFamilyMonospace },
  statusSection: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderTopWidth: tokens.strokeWidthThin,
    borderTopStyle: 'solid',
    borderTopColor: tokens.colorNeutralStroke2,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  actions: { display: 'flex', gap: tokens.spacingHorizontalS, flexWrap: 'wrap' },
  urlText: { wordBreak: 'break-all' },
});

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function getStatusIcon(status: string, classes: ReturnType<typeof useStyles>) {
  switch (status) {
    case 'complete': return <CheckmarkCircleRegular className={classes.iconComplete} />;
    case 'error': return <DismissCircleRegular className={classes.iconError} />;
    case 'running': return <Spinner size="tiny" />;
    default: return <CircleRegular className={classes.iconPending} />;
  }
}

function getLabelClass(status: string, classes: ReturnType<typeof useStyles>) {
  switch (status) {
    case 'complete': return classes.stepLabelComplete;
    case 'running': return classes.stepLabelRunning;
    case 'error': return classes.stepLabelError;
    default: return classes.stepLabelPending;
  }
}

export const GenerationProgress = createReactComponent(GenerationProgressApi, ({ props }) => {
  const classes = useStyles();
  const overallStatus = (typeof props.overallStatus === 'string' ? props.overallStatus : 'idle') as
    | 'idle' | 'running' | 'complete' | 'error';
  const steps = Array.isArray(props.steps) ? props.steps : [];

  const openExternal = (url?: unknown) => {
    const u = readString(url);
    if (u) window.open(u, '_blank', 'noopener,noreferrer');
  };

  const hasFooter =
    props.statusMessage || props.errorMessage || props.appUrl || props.portalUrl || props.lastUpdated;

  return (
    <Card className={classes.root}>
      <div className={classes.header}>
        {overallStatus === 'running' && <Spinner size="tiny" />}
        {overallStatus === 'complete' && <CheckmarkCircleRegular className={classes.iconComplete} />}
        {overallStatus === 'error' && <DismissCircleRegular className={classes.iconError} />}
        <Subtitle1>{readString(props.title) ?? 'Generation Progress'}</Subtitle1>
      </div>

      <div className={classes.stepList} role="list" aria-label="Generation steps" aria-live="polite">
        {steps.map((step, index) => {
          const s = step as z.infer<typeof GenerationStepSchema>;
          const isLast = index === steps.length - 1;
          return (
            <div
              key={s.id}
              className={`${classes.step} ${!isLast ? classes.stepWithConnector : ''}`}
              role="listitem"
            >
              <div className={classes.iconWrapper} aria-hidden="true">
                {getStatusIcon(s.status, classes)}
              </div>
              <div className={classes.stepContent}>
                <Body1 className={`${classes.stepLabel} ${getLabelClass(s.status, classes)}`}>
                  {readString(s.label) ?? s.id}
                </Body1>
                {s.detail && <Caption1 className={classes.stepDetail}>{readString(s.detail)}</Caption1>}
                {s.timestamp && <Caption1 className={classes.stepTimestamp}>{readString(s.timestamp)}</Caption1>}
              </div>
            </div>
          );
        })}
      </div>

      {hasFooter && (
        <div className={classes.statusSection}>
          {props.statusMessage && <Body2>{readString(props.statusMessage)}</Body2>}
          {props.errorMessage && (
            <MessageBar intent="error">
              <MessageBarBody>
                {props.errorCode ? `${readString(props.errorCode)}: ` : ''}
                {readString(props.errorMessage)}
              </MessageBarBody>
            </MessageBar>
          )}
          {props.lastUpdated && (
            <Caption1 className={classes.stepTimestamp}>Last updated: {readString(props.lastUpdated)}</Caption1>
          )}
          <div className={classes.actions}>
            {props.appUrl && overallStatus === 'complete' && (
              <Button appearance="primary" onClick={() => openExternal(props.appUrl)}>Open app</Button>
            )}
            {props.portalUrl && (
              <Button appearance="outline" onClick={() => openExternal(props.portalUrl)}>View portal</Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
});
