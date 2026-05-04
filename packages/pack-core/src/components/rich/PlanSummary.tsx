import React from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema } from '../../vendor/a2ui/schema/common-types';
import {
  Body1,
  Body1Strong,
  Card,
  Caption1,
  Button,
  makeStyles,
  tokens,
} from '@fluentui/react-components';

// ---------------------------------------------------------------------------
// Schema  (Recipe R1 — Plan summary card)
// ---------------------------------------------------------------------------

const PlanItemSchema = z.object({
  label: DynamicStringSchema,
}).strict();

const PlanSummaryApi = {
  name: 'PlanSummary',
  schema: z
    .object({
      title: DynamicStringSchema.optional(),
      body: DynamicStringSchema.optional(),
      items: z.array(PlanItemSchema).optional(),
      primaryAction: DynamicStringSchema.optional(),
      secondaryAction: DynamicStringSchema.optional(),
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
  },
  list: {
    margin: 0,
    paddingLeft: tokens.spacingHorizontalL,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  actions: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalXS,
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

export const PlanSummary = createReactComponent(PlanSummaryApi, ({ props, buildChild }) => {
  const classes = useStyles();
  const items = props.items ?? [];
  const childIds: string[] = (props.children as string[] | undefined) ?? [];

  return (
    <Card className={classes.card} data-testid="a2ui-PlanSummary">
      {props.title && (
        <Body1Strong className={classes.title}>{props.title}</Body1Strong>
      )}
      {props.body && <Body1>{props.body}</Body1>}
      {items.length > 0 && (
        <ul className={classes.list}>
          {items.map((item, idx) => (
            <li key={idx}>
              <Body1>{item.label}</Body1>
            </li>
          ))}
        </ul>
      )}
      {(props.primaryAction || props.secondaryAction) && (
        <div className={classes.actions}>
          {props.primaryAction && (
            <Button appearance="primary" size="small">
              {props.primaryAction}
            </Button>
          )}
          {props.secondaryAction && (
            <Button appearance="secondary" size="small">
              {props.secondaryAction}
            </Button>
          )}
        </div>
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
