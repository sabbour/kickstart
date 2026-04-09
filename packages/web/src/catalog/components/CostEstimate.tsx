import React from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema } from '../../vendor/a2ui/web_core/schema/common-types';
import {
  Body1,
  Body2,
  Caption1,
  Card,
  Subtitle2,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { MoneyRegular } from '@fluentui/react-icons';

const ResourceRowSchema = z.object({
  name: DynamicStringSchema,
  sku: DynamicStringSchema.optional(),
  monthlyEstimate: z.number(),
});

const CostEstimateApi = {
  name: 'CostEstimate',
  schema: z.object({
    resources: z.array(ResourceRowSchema),
    total: z.number().optional(),
    currency: DynamicStringSchema.optional(),
    title: DynamicStringSchema.optional(),
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
  table: {
    width: '100%',
    borderCollapse: 'collapse' as const,
    fontFamily: tokens.fontFamilyBase,
  },
  th: {
    textAlign: 'left' as const,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
    borderBottomWidth: tokens.strokeWidthThin,
    borderBottomStyle: 'solid' as const,
    borderBottomColor: tokens.colorNeutralStroke2,
    backgroundColor: tokens.colorNeutralBackground2,
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
  },
  thRight: {
    textAlign: 'right' as const,
  },
  td: {
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalM}`,
    borderBottomWidth: tokens.strokeWidthThin,
    borderBottomStyle: 'solid' as const,
    borderBottomColor: tokens.colorNeutralStroke3,
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
  },
  tdRight: {
    textAlign: 'right' as const,
    fontFamily: tokens.fontFamilyMonospace,
  },
  tdMuted: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  totalRow: {
    backgroundColor: tokens.colorNeutralBackground2,
  },
  totalCell: {
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
  },
  totalAmount: {
    textAlign: 'right' as const,
    fontFamily: tokens.fontFamilyMonospace,
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorBrandForeground1,
  },
  empty: {
    padding: tokens.spacingHorizontalM,
    color: tokens.colorNeutralForeground3,
    textAlign: 'center' as const,
  },
});

export const CostEstimate = createReactComponent(CostEstimateApi, ({ props }) => {
  const classes = useStyles();
  const currency = props.currency ?? 'USD';
  const resources = props.resources ?? [];

  const computedTotal = resources.reduce((sum, r) => sum + (r.monthlyEstimate ?? 0), 0);
  const displayTotal = props.total ?? computedTotal;

  const formatCost = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

  return (
    <Card className={classes.root}>
      <div className={classes.header}>
        <MoneyRegular />
        <Subtitle2>{props.title ?? 'Estimated Monthly Cost'}</Subtitle2>
      </div>

      {resources.length === 0 ? (
        <div className={classes.empty}>
          <Caption1>No resources specified.</Caption1>
        </div>
      ) : (
        <table className={classes.table}>
          <thead>
            <tr>
              <th className={classes.th}>Resource</th>
              <th className={`${classes.th} ${classes.thRight}`}>Est. / month</th>
            </tr>
          </thead>
          <tbody>
            {resources.map((resource, i) => (
              <tr key={i}>
                <td className={classes.td}>
                  <div>{resource.name}</div>
                  {resource.sku && (
                    <div className={classes.tdMuted}>{resource.sku}</div>
                  )}
                </td>
                <td className={`${classes.td} ${classes.tdRight}`}>
                  {formatCost(resource.monthlyEstimate)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className={classes.totalRow}>
              <td className={classes.totalCell}>Total</td>
              <td className={classes.totalAmount}>{formatCost(displayTotal)}</td>
            </tr>
          </tfoot>
        </table>
      )}
    </Card>
  );
});
