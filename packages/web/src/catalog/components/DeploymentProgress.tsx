import React, { useEffect, useMemo, useState } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema } from '../../vendor/a2ui/web_core/schema/common-types';
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
import { getAzureDeployment, type AzureDeploymentRun, type AzureDeploymentStep } from '../../services/azure-deployments';
import {
  sanitizeAzureDeploymentErrorMessage,
  sanitizeAzureDeploymentStatusMessage,
  sanitizeAzureDeploymentStepDetail,
  sanitizeAzureDeploymentStepLabel,
  sanitizeAzureExternalUrl,
  sanitizeAzureUiErrorMessage,
} from '../../utils/azure-ui-safety';

const DeploymentStepSchema = z.object({
  id: z.string(),
  label: DynamicStringSchema,
  status: z.enum(['pending', 'running', 'complete', 'error', 'skipped']),
  detail: DynamicStringSchema.optional(),
  timestamp: DynamicStringSchema.optional(),
});

const DeploymentProgressApi = {
  name: 'DeploymentProgress',
  schema: z.object({
    steps: z.array(DeploymentStepSchema),
    title: DynamicStringSchema.optional(),
    overallStatus: z.enum(['idle', 'running', 'complete', 'error']).optional(),
    runId: DynamicStringSchema.optional(),
    statusMessage: DynamicStringSchema.optional(),
    appUrl: DynamicStringSchema.optional(),
    portalUrl: DynamicStringSchema.optional(),
    errorCode: DynamicStringSchema.optional(),
    errorMessage: DynamicStringSchema.optional(),
    lastUpdated: DynamicStringSchema.optional(),
    pollIntervalMs: z.number().int().positive().optional(),
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
  statusSection: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderTopWidth: tokens.strokeWidthThin,
    borderTopStyle: 'solid',
    borderTopColor: tokens.colorNeutralStroke2,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  actions: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
  },
  urlText: {
    wordBreak: 'break-all',
  },
});

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function normalizeOverallStatus(value: unknown): 'idle' | 'running' | 'complete' | 'error' {
  const status = typeof value === 'string' ? value.toLowerCase() : '';
  switch (status) {
    case 'queued':
    case 'pending':
    case 'running':
    case 'in_progress':
      return 'running';
    case 'success':
    case 'succeeded':
    case 'completed':
    case 'complete':
      return 'complete';
    case 'failed':
    case 'error':
    case 'cancelled':
      return 'error';
    default:
      return 'idle';
  }
}

function isActiveRun(status: 'idle' | 'running' | 'complete' | 'error'): boolean {
  return status === 'running';
}

function isTerminalRun(status: 'idle' | 'running' | 'complete' | 'error'): boolean {
  return status === 'complete' || status === 'error';
}

function sanitizeSteps(steps: AzureDeploymentStep[]): AzureDeploymentStep[] {
  return steps.map((step, index) => ({
    ...step,
    label: sanitizeAzureDeploymentStepLabel(step.label, `Deployment step ${index + 1}`),
    detail: sanitizeAzureDeploymentStepDetail(step.detail),
  }));
}

function buildMergedState(props: Record<string, unknown>, deployment: AzureDeploymentRun | null) {
  const baseSteps = Array.isArray(props.steps) ? props.steps as AzureDeploymentStep[] : [];
  const status = deployment?.status ?? props.overallStatus ?? 'idle';
  return {
    runId: deployment?.runId ?? readString(props.runId),
    steps: sanitizeSteps(deployment?.steps.length ? deployment.steps : baseSteps),
    overallStatus: normalizeOverallStatus(status),
    statusMessage: sanitizeAzureDeploymentStatusMessage(
      deployment?.statusMessage ?? readString(props.statusMessage),
      status,
    ),
    appUrl: sanitizeAzureExternalUrl(deployment?.appUrl ?? readString(props.appUrl), 'app'),
    portalUrl: sanitizeAzureExternalUrl(deployment?.portalUrl ?? readString(props.portalUrl), 'portal'),
    errorCode: undefined,
    errorMessage: sanitizeAzureDeploymentErrorMessage(
      deployment?.errorCode ?? readString(props.errorCode),
      deployment?.errorMessage ?? readString(props.errorMessage),
    ),
    lastUpdated: deployment?.lastUpdated ?? readString(props.lastUpdated),
  };
}

export const DeploymentProgress = createReactComponent(DeploymentProgressApi, ({ props }) => {
  const classes = useStyles();
  const [deployment, setDeployment] = useState<AzureDeploymentRun | null>(null);
  const [loading, setLoading] = useState(Boolean(props.runId));
  const [pollError, setPollError] = useState<string | undefined>();

  const pollIntervalMs = props.pollIntervalMs ?? 3000;
  const merged = useMemo(() => buildMergedState(props as Record<string, unknown>, deployment), [deployment, props]);

  useEffect(() => {
    const runId = readString(props.runId);
    if (!runId) {
      setDeployment(null);
      setLoading(false);
      setPollError(undefined);
      return undefined;
    }

    let cancelled = false;
    let timeoutId: number | undefined;

    const refresh = async () => {
      try {
        const next = await getAzureDeployment(runId);
        if (cancelled) return;
        setDeployment(next);
        setPollError(undefined);
        setLoading(false);

        if (isActiveRun(normalizeOverallStatus(next.status))) {
          timeoutId = window.setTimeout(() => {
            void refresh();
          }, pollIntervalMs);
        }
      } catch (error) {
        if (cancelled) return;
        setPollError(sanitizeAzureUiErrorMessage(error, 'deployment-status'));
        setLoading(false);
        timeoutId = window.setTimeout(() => {
          void refresh();
        }, pollIntervalMs);
      }
    };

    void refresh();

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [pollIntervalMs, props.runId]);

  const openExternal = (url?: string) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

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
      case 'complete':
        return classes.stepLabelComplete;
      case 'running':
        return classes.stepLabelRunning;
      case 'error':
        return classes.stepLabelError;
      default:
        return classes.stepLabelPending;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'complete':
        return 'Complete';
      case 'error':
        return 'Error';
      case 'running':
        return 'In progress';
      case 'skipped':
        return 'Skipped';
      default:
        return 'Pending';
    }
  };

  return (
    <Card className={classes.root}>
      <div className={classes.header}>
        {merged.overallStatus === 'running' && <Spinner size="tiny" />}
        {merged.overallStatus === 'complete' && <CheckmarkCircleRegular className={classes.iconComplete} />}
        {merged.overallStatus === 'error' && <DismissCircleRegular className={classes.iconError} />}
        <Subtitle1>{props.title ?? 'Deployment Progress'}</Subtitle1>
      </div>

      {pollError && !isTerminalRun(merged.overallStatus) && (
        <MessageBar intent="warning">
          <MessageBarBody>{pollError} Retrying…</MessageBarBody>
        </MessageBar>
      )}

      {loading && merged.steps.length === 0 ? (
        <div className={classes.statusSection}>
          <Spinner size="small" label="Loading deployment status…" />
        </div>
      ) : (
        <div className={classes.stepList} role="list" aria-label="Deployment steps" aria-live="polite">
          {merged.steps.map((step, index) => {
            const isLast = index === merged.steps.length - 1;
            return (
              <div
                key={step.id}
                className={`${classes.step} ${!isLast ? classes.stepWithConnector : ''}`}
                role="listitem"
              >
                <div className={classes.iconWrapper} aria-label={getStatusLabel(step.status)} role="img">
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
      )}

      {(merged.statusMessage || merged.errorMessage || merged.appUrl || merged.portalUrl || merged.lastUpdated || pollError) && (
        <div className={classes.statusSection}>
          {merged.statusMessage && (
            <Body2>{merged.statusMessage}</Body2>
          )}

          {merged.errorMessage && (
            <MessageBar intent="error">
              <MessageBarBody>
                {merged.errorMessage}
              </MessageBarBody>
            </MessageBar>
          )}

          {merged.appUrl && merged.overallStatus === 'complete' && (
            <Caption1 className={classes.urlText}>
              Live app URL: {merged.appUrl}
            </Caption1>
          )}

          {merged.lastUpdated && (
            <Caption1 className={classes.stepTimestamp}>
              Last updated: {merged.lastUpdated}
            </Caption1>
          )}

          <div className={classes.actions}>
            {merged.appUrl && merged.overallStatus === 'complete' && (
              <Button appearance="primary" onClick={() => openExternal(merged.appUrl)}>
                Open app
              </Button>
            )}
            {merged.portalUrl && (
              <Button appearance="outline" onClick={() => openExternal(merged.portalUrl)}>
                View in Azure
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
});
