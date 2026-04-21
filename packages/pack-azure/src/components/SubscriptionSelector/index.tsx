import React from 'react';
import { z } from 'zod';
import { Card, CardHeader, Text, Spinner, tokens, makeStyles } from '@fluentui/react-components';
import type { ComponentContribution } from '@aks-kickstart/harness';

const SubscriptionItemSchema = z.object({
  subscriptionId: z.string(),
  displayName: z.string(),
  tenantId: z.string().optional(),
  state: z.string().optional(),
});

const SubscriptionSelectorSchema = z.object({
  status: z.enum(['idle', 'loading', 'loaded', 'error']).default('idle'),
  subscriptions: z.array(SubscriptionItemSchema).optional(),
  selectedSubscriptionId: z.string().optional(),
  errorMessage: z.string().optional(),
  reason: z.string().optional().describe('Why authentication is needed'),
});

type SubscriptionSelectorProps = z.infer<typeof SubscriptionSelectorSchema>;

const useStyles = makeStyles({
  card: {
    padding: tokens.spacingVerticalM,
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    maxWidth: '480px',
  },
  subList: {
    marginTop: tokens.spacingVerticalS,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  subItem: {
    padding: tokens.spacingVerticalXS,
    paddingLeft: tokens.spacingHorizontalS,
    borderLeft: `3px solid ${tokens.colorNeutralStroke1}`,
  },
  selectedItem: {
    borderLeftColor: tokens.colorBrandStroke1,
    backgroundColor: tokens.colorBrandBackground2,
  },
});

export const SubscriptionSelectorRenderer: React.FC<{ props: SubscriptionSelectorProps }> = ({ props }) => {
  const classes = useStyles();

  return (
    <Card className={classes.card}>
      <CardHeader
        header={<Text weight="semibold">Select Azure Subscription</Text>}
      />
      {props.reason && <Text size={200}>{String(props.reason)}</Text>}
      {props.status === 'loading' && <Spinner size="small" label="Loading subscriptions…" />}
      {props.status === 'error' && props.errorMessage && (
        <Text size={200} style={{ color: tokens.colorPaletteRedForeground1 }}>
          {String(props.errorMessage)}
        </Text>
      )}
      {props.status === 'loaded' && props.subscriptions && (
        <div className={classes.subList}>
          {props.subscriptions.map((sub) => {
            const isSelected = sub.subscriptionId === props.selectedSubscriptionId;
            return (
              <div
                key={sub.subscriptionId}
                className={`${classes.subItem} ${isSelected ? classes.selectedItem : ''}`}
              >
                <Text size={200} weight={isSelected ? 'semibold' : 'regular'}>
                  {String(sub.displayName)}
                </Text>
                <Text size={100} style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>
                  {String(sub.subscriptionId)}
                </Text>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export const subscriptionSelectorContribution: ComponentContribution = {
  name: 'azure/SubscriptionSelector',
  propertySchema: SubscriptionSelectorSchema,
  renderer: SubscriptionSelectorRenderer,
};
