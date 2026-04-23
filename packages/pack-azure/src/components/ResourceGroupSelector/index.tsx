import React from 'react';
import { z } from 'zod';
import { Card, CardHeader, Text, Spinner, tokens, makeStyles } from '@fluentui/react-components';
import type { ComponentContribution } from '@aks-kickstart/harness';

const ResourceGroupItemSchema = z.object({
  name: z.string(),
  location: z.string(),
  provisioningState: z.string().optional(),
  tags: z.record(z.string(), z.string()).optional(),
});

const ResourceGroupSelectorSchema = z.object({
  status: z.enum(['idle', 'loading', 'loaded', 'error']).default('idle'),
  resourceGroups: z.array(ResourceGroupItemSchema).optional(),
  selectedResourceGroup: z.string().optional(),
  subscriptionId: z.string().optional(),
  errorMessage: z.string().optional(),
});

type ResourceGroupSelectorProps = z.infer<typeof ResourceGroupSelectorSchema>;

const useStyles = makeStyles({
  card: {
    padding: tokens.spacingVerticalM,
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    maxWidth: '480px',
  },
  rgList: {
    marginTop: tokens.spacingVerticalS,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  rgItem: {
    padding: tokens.spacingVerticalXS,
    paddingLeft: tokens.spacingHorizontalS,
    borderLeft: `3px solid ${tokens.colorNeutralStroke1}`,
  },
  selected: {
    borderLeftColor: tokens.colorBrandStroke1,
    backgroundColor: tokens.colorBrandBackground2,
  },
});

export const ResourceGroupSelectorRenderer: React.FC<{ props: ResourceGroupSelectorProps }> = ({ props }) => {
  const classes = useStyles();

  return (
    <Card className={classes.card}>
      <CardHeader
        header={<Text weight="semibold">Select Resource Group</Text>}
        description={
          props.subscriptionId
            ? <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>{String(props.subscriptionId)}</Text>
            : undefined
        }
      />
      {props.status === 'loading' && <Spinner size="small" label="Loading resource groups…" />}
      {props.status === 'error' && props.errorMessage && (
        <Text size={200} style={{ color: tokens.colorPaletteRedForeground1 }}>
          {String(props.errorMessage)}
        </Text>
      )}
      {props.status === 'loaded' && props.resourceGroups && (
        <div className={classes.rgList}>
          {props.resourceGroups.map((rg) => {
            const isSelected = rg.name === props.selectedResourceGroup;
            return (
              <div
                key={rg.name}
                className={`${classes.rgItem} ${isSelected ? classes.selected : ''}`}
              >
                <Text size={200} weight={isSelected ? 'semibold' : 'regular'}>
                  {String(rg.name)}
                </Text>
                <Text size={100} style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>
                  {String(rg.location)}
                  {rg.provisioningState ? ` · ${rg.provisioningState}` : ''}
                </Text>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export const resourceGroupSelectorContribution: ComponentContribution = {
  name: 'azure/ResourceGroupSelector',
  propertySchema: ResourceGroupSelectorSchema,
  renderer: ResourceGroupSelectorRenderer,
};
