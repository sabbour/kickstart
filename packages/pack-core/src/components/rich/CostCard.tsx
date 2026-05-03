import React from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema } from '../../vendor/a2ui/schema/common-types';
import {
  Body1,
  Body1Strong,
  Caption1,
  Card,
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableHeaderCell,
  TableRow,
  makeStyles,
  tokens,
} from '@fluentui/react-components';

// ---------------------------------------------------------------------------
// Schema  (Recipe R16 — Cost card with live retail prices)
// ---------------------------------------------------------------------------

const CostLineSchema = z.object({
  resource: DynamicStringSchema,
  sku: DynamicStringSchema,
  qty: DynamicStringSchema,
  unit: DynamicStringSchema,
  monthly: DynamicStringSchema,
}).strict();

const CostCardApi = {
  name: 'CostCard',
  schema: z
    .object({
      title: DynamicStringSchema.optional(),
      lines: z.array(CostLineSchema),
      fixedVsVariable: DynamicStringSchema.optional(),
      priceNote: DynamicStringSchema.optional(),
      children: z.array(z.string()).optional(),
    })
    .strict(),
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = makeStyles({
  card: {
    padding: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  title: {
    color: tokens.colorNeutralForeground2,
    display: 'block',
    marginBottom: tokens.spacingVerticalXS,
  },
  annotation: {
    color: tokens.colorNeutralForeground2,
    display: 'block',
    marginTop: tokens.spacingVerticalXS,
  },
  priceNote: {
    color: tokens.colorNeutralForeground3,
    display: 'block',
    marginTop: '2px',
  },
  childrenArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
});

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const CostCard = createReactComponent(CostCardApi, ({ props, buildChild }) => {
  const classes = useStyles();
  const lines = props.lines ?? [];
  const childIds: string[] = (props.children as string[] | undefined) ?? [];

  return (
    <Card className={classes.card} data-testid="a2ui-CostCard">
      {props.title && (
        <Body1Strong className={classes.title}>{props.title}</Body1Strong>
      )}
      <Table aria-label="Cost breakdown">
        <TableHeader>
          <TableRow>
            <TableHeaderCell><Body1Strong>Resource</Body1Strong></TableHeaderCell>
            <TableHeaderCell><Body1Strong>SKU</Body1Strong></TableHeaderCell>
            <TableHeaderCell><Body1Strong>Qty</Body1Strong></TableHeaderCell>
            <TableHeaderCell><Body1Strong>Unit</Body1Strong></TableHeaderCell>
            <TableHeaderCell><Body1Strong>Monthly</Body1Strong></TableHeaderCell>
          </TableRow>
        </TableHeader>
        <TableBody>
          {lines.map((line, idx) => (
            <TableRow key={idx}>
              <TableCell><Body1>{line.resource}</Body1></TableCell>
              <TableCell><Body1>{line.sku}</Body1></TableCell>
              <TableCell><Body1>{line.qty}</Body1></TableCell>
              <TableCell><Body1>{line.unit}</Body1></TableCell>
              <TableCell><Body1Strong>{line.monthly}</Body1Strong></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {props.fixedVsVariable && (
        <Body1 className={classes.annotation}>{props.fixedVsVariable}</Body1>
      )}
      {props.priceNote && (
        <Caption1 className={classes.priceNote}>{props.priceNote}</Caption1>
      )}
      {childIds.length > 0 && (
        <div className={classes.childrenArea}>
          {childIds.map((id) => (
            <React.Fragment key={id}>{buildChild(id)}</React.Fragment>
          ))}
        </div>
      )}
    </Card>
  );
});
