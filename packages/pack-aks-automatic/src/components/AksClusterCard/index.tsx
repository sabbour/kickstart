import React from 'react';
import { z } from 'zod';
import {
  Badge,
  Card,
  CardHeader,
  Text,
  tokens,
  makeStyles,
} from '@fluentui/react-components';
import type { ComponentContribution } from '@aks-kickstart/harness';

const AksClusterCardSchema = z.object({
  clusterName: z.string().describe('AKS cluster display name'),
  resourceGroup: z.string().optional().describe('Resource group name'),
  location: z.string().optional().describe('Azure region, e.g. "East US"'),
  kubernetesVersion: z.string().optional().describe('Kubernetes version, e.g. "1.30.0"'),
  nodeCount: z.number().optional().describe('Total node count across all node pools'),
  status: z
    .enum(['Running', 'Creating', 'Updating', 'Deleting', 'Failed', 'Unknown'])
    .default('Unknown'),
  tier: z.enum(['Free', 'Standard', 'Premium']).optional(),
  fqdn: z.string().optional().describe('Cluster API server FQDN'),
});

type AksClusterCardProps = z.infer<typeof AksClusterCardSchema>;

const useStyles = makeStyles({
  card: {
    padding: tokens.spacingVerticalM,
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    maxWidth: '520px',
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
    minWidth: '120px',
    flexShrink: 0,
  },
});

const STATUS_COLOR: Record<string, 'success' | 'warning' | 'danger' | 'informative'> = {
  Running: 'success',
  Creating: 'warning',
  Updating: 'warning',
  Deleting: 'warning',
  Failed: 'danger',
  Unknown: 'informative',
};

export const AksClusterCardRenderer: React.FC<{ props: AksClusterCardProps }> = ({ props }) => {
  const classes = useStyles();
  const statusColor = STATUS_COLOR[props.status ?? 'Unknown'] ?? 'informative';

  return (
    <Card className={classes.card}>
      <CardHeader
        header={<Text weight="semibold">{String(props.clusterName)}</Text>}
        action={
          <Badge appearance="filled" color={statusColor} size="small">
            {props.status ?? 'Unknown'}
          </Badge>
        }
      />
      <div className={classes.meta}>
        {props.resourceGroup && (
          <div className={classes.row}>
            <Text size={200} className={classes.label}>Resource Group</Text>
            <Text size={200}>{String(props.resourceGroup)}</Text>
          </div>
        )}
        {props.location && (
          <div className={classes.row}>
            <Text size={200} className={classes.label}>Location</Text>
            <Text size={200}>{String(props.location)}</Text>
          </div>
        )}
        {props.kubernetesVersion && (
          <div className={classes.row}>
            <Text size={200} className={classes.label}>Kubernetes</Text>
            <Text size={200}>{String(props.kubernetesVersion)}</Text>
          </div>
        )}
        {props.nodeCount !== undefined && (
          <div className={classes.row}>
            <Text size={200} className={classes.label}>Nodes</Text>
            <Text size={200}>{String(props.nodeCount)}</Text>
          </div>
        )}
        {props.tier && (
          <div className={classes.row}>
            <Text size={200} className={classes.label}>Tier</Text>
            <Text size={200}>{String(props.tier)}</Text>
          </div>
        )}
      </div>
    </Card>
  );
};

export const aksClusterCardContribution: ComponentContribution = {
  name: 'aks/AksClusterCard',
  propertySchema: AksClusterCardSchema,
  renderer: AksClusterCardRenderer,
};
