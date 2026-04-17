import React from 'react';
import { z } from 'zod';
import {
  Badge,
  Card,
  CardHeader,
  Spinner,
  Text,
  tokens,
  makeStyles,
} from '@fluentui/react-components';
import type { ComponentContribution } from '@kickstart/harness';

const DeploymentProgressSchema = z.object({
  clusterName: z.string().describe('AKS cluster name'),
  resourceGroup: z.string().describe('Azure resource group'),
  subscription: z.string().describe('Azure subscription'),
  phase: z
    .enum(['pending', 'provisioning', 'succeeded', 'failed', 'cancelled'])
    .default('pending'),
  message: z.string().optional().describe('Current status message'),
  progressPercent: z.number().min(0).max(100).optional().describe('Overall progress 0-100'),
  startedAt: z.string().optional().describe('ISO 8601 start timestamp'),
  completedAt: z.string().optional().describe('ISO 8601 completion timestamp'),
  steps: z
    .array(
      z.object({
        name: z.string(),
        status: z.enum(['pending', 'running', 'succeeded', 'failed', 'skipped']),
        message: z.string().optional(),
      })
    )
    .optional()
    .describe('Deployment steps'),
});

type DeploymentProgressProps = z.infer<typeof DeploymentProgressSchema>;

const useStyles = makeStyles({
  card: {
    padding: tokens.spacingVerticalM,
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    maxWidth: '560px',
  },
  meta: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    marginTop: tokens.spacingVerticalS,
  },
  row: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
  },
  label: {
    color: tokens.colorNeutralForeground3,
    minWidth: '110px',
    flexShrink: 0,
  },
  steps: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    marginTop: tokens.spacingVerticalM,
  },
  stepRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  message: {
    marginTop: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalXS,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
  },
});

const PHASE_BADGE: Record<string, 'success' | 'warning' | 'danger' | 'informative'> = {
  pending: 'informative',
  provisioning: 'warning',
  succeeded: 'success',
  failed: 'danger',
  cancelled: 'informative',
};

const STEP_BADGE: Record<string, 'success' | 'warning' | 'danger' | 'informative'> = {
  pending: 'informative',
  running: 'warning',
  succeeded: 'success',
  failed: 'danger',
  skipped: 'informative',
};

export const DeploymentProgressRenderer: React.FC<{ props: DeploymentProgressProps }> = ({
  props,
}) => {
  const classes = useStyles();
  const phase = props.phase ?? 'pending';
  const isRunning = phase === 'provisioning';

  return (
    <Card className={classes.card}>
      <CardHeader
        header={<Text weight="semibold">{String(props.clusterName)}</Text>}
        action={
          <Badge appearance="filled" color={PHASE_BADGE[phase] ?? 'informative'} size="small">
            {isRunning && <Spinner size="extra-tiny" />}
            {phase}
            {props.progressPercent !== undefined && isRunning
              ? ` ${props.progressPercent}%`
              : ''}
          </Badge>
        }
      />

      <div className={classes.meta}>
        <div className={classes.row}>
          <Text size={200} className={classes.label}>Resource Group</Text>
          <Text size={200}>{String(props.resourceGroup)}</Text>
        </div>
        <div className={classes.row}>
          <Text size={200} className={classes.label}>Subscription</Text>
          <Text size={200}>{String(props.subscription)}</Text>
        </div>
        {props.startedAt && (
          <div className={classes.row}>
            <Text size={200} className={classes.label}>Started</Text>
            <Text size={200}>{new Date(props.startedAt).toLocaleString()}</Text>
          </div>
        )}
        {props.completedAt && (
          <div className={classes.row}>
            <Text size={200} className={classes.label}>Completed</Text>
            <Text size={200}>{new Date(props.completedAt).toLocaleString()}</Text>
          </div>
        )}
      </div>

      {props.message && (
        <div className={classes.message}>
          <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>
            {String(props.message)}
          </Text>
        </div>
      )}

      {props.steps && props.steps.length > 0 && (
        <div className={classes.steps}>
          <Text size={200} weight="semibold">Deployment steps</Text>
          {props.steps.map((step, i) => (
            <div key={`step-${i}`} className={classes.stepRow}>
              <Badge appearance="filled" color={STEP_BADGE[step.status] ?? 'informative'} size="small">
                {String(step.status)}
              </Badge>
              <Text size={200}>{String(step.name)}</Text>
              {step.message && (
                <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                  — {String(step.message)}
                </Text>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export const deploymentProgressContribution: ComponentContribution = {
  name: 'aks/DeploymentProgress',
  propertySchema: DeploymentProgressSchema,
  renderer: DeploymentProgressRenderer,
};
