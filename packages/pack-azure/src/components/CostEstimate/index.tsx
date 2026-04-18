import React from 'react';
import { z } from 'zod';
import { Card, CardHeader, Text, tokens, makeStyles, Divider } from '@fluentui/react-components';
import type { ComponentContribution } from '@kickstart/harness';

const CostLineItemSchema = z.object({
  name: z.string(),
  monthlyUSD: z.number(),
  unitPrice: z.number(),
  quantity: z.number(),
  unitOfMeasure: z.string(),
});

const CostEstimateSchema = z.object({
  totalMonthlyUSD: z.number().describe('Total estimated monthly cost in USD'),
  breakdown: z.array(CostLineItemSchema).describe('Per-resource cost breakdown'),
  currencyCode: z.string().default('USD'),
  region: z.string().optional(),
  disclaimer: z.string().optional(),
});

type CostEstimateProps = z.infer<typeof CostEstimateSchema>;

const useStyles = makeStyles({
  card: {
    padding: tokens.spacingVerticalM,
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    maxWidth: '480px',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    paddingTop: tokens.spacingVerticalXS,
    paddingBottom: tokens.spacingVerticalXS,
  },
  total: {
    display: 'flex',
    justifyContent: 'space-between',
    paddingTop: tokens.spacingVerticalS,
  },
  disclaimer: {
    marginTop: tokens.spacingVerticalS,
    color: tokens.colorNeutralForeground3,
  },
});

export const CostEstimateRenderer: React.FC<{ props: CostEstimateProps }> = ({ props }) => {
  const classes = useStyles();

  return (
    <Card className={classes.card}>
      <CardHeader
        header={<Text weight="semibold">Cost Estimate{props.region ? ` — ${props.region}` : ''}</Text>}
      />
      {props.breakdown.map((item, i) => (
        <div key={i} className={classes.row}>
          <Text size={200}>{String(item.name)}</Text>
          <Text size={200}>${item.monthlyUSD.toFixed(2)}/mo</Text>
        </div>
      ))}
      <Divider />
      <div className={classes.total}>
        <Text weight="semibold">Total (estimated)</Text>
        <Text weight="semibold">
          ${props.totalMonthlyUSD.toFixed(2)}/{props.currencyCode ?? 'USD'} per month
        </Text>
      </div>
      {props.disclaimer && (
        <Text size={200} className={classes.disclaimer}>
          {String(props.disclaimer)}
        </Text>
      )}
    </Card>
  );
};

export const costEstimateContribution: ComponentContribution = {
  name: 'azure/CostEstimate',
  propertySchema: CostEstimateSchema,
  renderer: CostEstimateRenderer,
};
