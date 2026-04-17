import React from 'react';
import { z } from 'zod';
import { Card, CardHeader, Badge, Text, Spinner, tokens, makeStyles } from '@fluentui/react-components';
import type { ComponentContribution } from '@kickstart/harness';

const DeploymentStatusSchema = z.object({
  deploymentName: z.string().describe('ARM deployment name'),
  provisioningState: z
    .enum(['Accepted', 'Running', 'Succeeded', 'Failed', 'Canceled', 'Unknown'])
    .default('Unknown'),
  correlationId: z.string().optional(),
  timestamp: z.string().optional().describe('ISO 8601 timestamp of last update'),
  outputs: z.record(z.string(), z.unknown()).optional().describe('Deployment outputs'),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .optional(),
  subscriptionId: z.string().optional(),
  resourceGroup: z.string().optional(),
});

type DeploymentStatusProps = z.infer<typeof DeploymentStatusSchema>;

const useStyles = makeStyles({
  card: {
    padding: tokens.spacingVerticalM,
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    maxWidth: '480px',
  },
  row: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    paddingTop: tokens.spacingVerticalXS,
  },
  error: {
    marginTop: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalXS,
    backgroundColor: tokens.colorPaletteRedBackground1,
    borderRadius: tokens.borderRadiusMedium,
  },
  outputs: {
    marginTop: tokens.spacingVerticalS,
  },
});

const STATE_BADGE: Record<string, 'success' | 'warning' | 'danger' | 'informative'> = {
  Succeeded: 'success',
  Running: 'warning',
  Accepted: 'warning',
  Failed: 'danger',
  Canceled: 'danger',
  Unknown: 'informative',
};

export const DeploymentStatusRenderer: React.FC<{ props: DeploymentStatusProps }> = ({ props }) => {
  const classes = useStyles();
  const state = props.provisioningState ?? 'Unknown';
  const badgeColor = STATE_BADGE[state] ?? 'informative';
  const isRunning = state === 'Running' || state === 'Accepted';

  return (
    <Card className={classes.card}>
      <CardHeader
        header={<Text weight="semibold">{String(props.deploymentName)}</Text>}
        action={
          <Badge appearance="filled" color={badgeColor} size="small">
            {isRunning && <Spinner size="extra-tiny" />}
            {state}
          </Badge>
        }
      />
      {props.resourceGroup && (
        <div className={classes.row}>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>Resource Group:</Text>
          <Text size={200}>{String(props.resourceGroup)}</Text>
        </div>
      )}
      {props.timestamp && (
        <div className={classes.row}>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>Last updated:</Text>
          <Text size={200}>{new Date(props.timestamp).toLocaleString()}</Text>
        </div>
      )}
      {props.error && (
        <div className={classes.error}>
          <Text size={200} weight="semibold" style={{ color: tokens.colorPaletteRedForeground1 }}>
            {String(props.error.code)}
          </Text>
          <Text size={200} style={{ color: tokens.colorPaletteRedForeground1 }}>
            {String(props.error.message)}
          </Text>
        </div>
      )}
      {props.outputs && Object.keys(props.outputs).length > 0 && (
        <div className={classes.outputs}>
          <Text size={200} weight="semibold">Outputs</Text>
          {Object.entries(props.outputs).map(([key, val]) => (
            <div key={key} className={classes.row}>
              <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>{key}:</Text>
              <Text size={200}>{String(typeof val === 'object' ? JSON.stringify(val) : val)}</Text>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export const deploymentStatusContribution: ComponentContribution = {
  name: 'azure/DeploymentStatus',
  propertySchema: DeploymentStatusSchema,
  renderer: DeploymentStatusRenderer,
};
