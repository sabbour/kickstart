import React from 'react';
import { z } from 'zod';
import { Card, CardHeader, Badge, Text, tokens, makeStyles } from '@fluentui/react-components';
import type { ComponentContribution } from '@kickstart/harness';

const AzureResourceCardSchema = z.object({
  resourceName: z.string().describe('Azure resource display name'),
  resourceType: z.string().describe('ARM resource type, e.g. "Microsoft.Network/virtualNetworks"'),
  location: z.string().optional().describe('Azure region, e.g. "East US"'),
  resourceGroup: z.string().optional().describe('Resource group name'),
  status: z.enum(['active', 'provisioning', 'failed', 'unknown']).default('unknown'),
  tags: z.record(z.string(), z.string()).optional().describe('Resource tags'),
  properties: z.record(z.string(), z.unknown()).optional().describe('Key properties to display'),
});

type AzureResourceCardProps = z.infer<typeof AzureResourceCardSchema>;

const useStyles = makeStyles({
  card: {
    padding: tokens.spacingVerticalM,
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    maxWidth: '480px',
  },
  meta: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    flexWrap: 'wrap',
    marginTop: tokens.spacingVerticalXS,
  },
  props: {
    marginTop: tokens.spacingVerticalS,
  },
  propRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
  },
});

const STATUS_COLOR_MAP: Record<string, 'success' | 'warning' | 'danger' | 'informative'> = {
  active: 'success',
  provisioning: 'warning',
  failed: 'danger',
  unknown: 'informative',
};

export const AzureResourceCardRenderer: React.FC<{ props: AzureResourceCardProps }> = ({ props }) => {
  const classes = useStyles();
  const statusColor = STATUS_COLOR_MAP[props.status ?? 'unknown'] ?? 'informative';

  return (
    <Card className={classes.card}>
      <CardHeader
        header={<Text weight="semibold">{String(props.resourceName)}</Text>}
        action={
          <Badge appearance="filled" color={statusColor} size="small">
            {props.status ?? 'unknown'}
          </Badge>
        }
      />
      <div className={classes.meta}>
        <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
          {String(props.resourceType)}
        </Text>
        {props.location && (
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            · {String(props.location)}
          </Text>
        )}
        {props.resourceGroup && (
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            · {String(props.resourceGroup)}
          </Text>
        )}
      </div>
      {props.properties && Object.keys(props.properties).length > 0 && (
        <div className={classes.props}>
          {Object.entries(props.properties).slice(0, 5).map(([key, value]) => (
            <div key={key} className={classes.propRow}>
              <Text size={200} weight="semibold">{key}:</Text>
              <Text size={200}>{String(value)}</Text>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export const azureResourceCardContribution: ComponentContribution = {
  name: 'azure/AzureResourceCard',
  propertySchema: AzureResourceCardSchema,
  renderer: AzureResourceCardRenderer,
};
