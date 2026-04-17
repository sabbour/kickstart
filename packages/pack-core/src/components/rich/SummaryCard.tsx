import React from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema } from '../../vendor/a2ui/schema/common-types';
import {
  Badge,
  Body1,
  Body1Strong,
  Caption1,
  Card,
  makeStyles,
  tokens,
} from '@fluentui/react-components';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const SummaryItemSchema = z.object({
  label: DynamicStringSchema,
  value: DynamicStringSchema,
  badge: z.enum(['neutral', 'success', 'warning', 'danger', 'info']).optional(),
});

const SummaryCardApi = {
  name: 'SummaryCard',
  schema: z
    .object({
      title: DynamicStringSchema.optional(),
      items: z.array(SummaryItemSchema),
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
  },
  title: {
    display: 'block',
    marginBottom: tokens.spacingVerticalS,
    color: tokens.colorNeutralForeground2,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    columnGap: tokens.spacingHorizontalL,
    rowGap: tokens.spacingVerticalXS,
    alignItems: 'center',
  },
  label: {
    color: tokens.colorNeutralForeground3,
    whiteSpace: 'nowrap',
  },
  valueRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    flexWrap: 'wrap',
  },
});

// ---------------------------------------------------------------------------
// Badge colour mapping
// ---------------------------------------------------------------------------

type BadgeColor = 'subtle' | 'success' | 'warning' | 'danger' | 'informative';

const BADGE_COLOR_MAP: Record<string, BadgeColor> = {
  neutral: 'subtle',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'informative',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const SummaryCard = createReactComponent(SummaryCardApi, ({ props }) => {
  const classes = useStyles();
  const items = props.items ?? [];

  return (
    <Card className={classes.card}>
      {props.title && (
        <Caption1 className={classes.title}>{props.title}</Caption1>
      )}
      <div className={classes.grid}>
        {items.map((item, idx) => (
          <React.Fragment key={idx}>
            <Body1 className={classes.label}>{item.label}</Body1>
            <div className={classes.valueRow}>
              <Body1Strong>{item.value}</Body1Strong>
              {item.badge && (
                <Badge
                  color={BADGE_COLOR_MAP[item.badge] ?? 'subtle'}
                  appearance="tint"
                  size="small"
                >
                  {item.badge}
                </Badge>
              )}
            </div>
          </React.Fragment>
        ))}
      </div>
    </Card>
  );
});
