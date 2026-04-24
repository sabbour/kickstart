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
  Link,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { Open16Regular } from '@fluentui/react-icons';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const SummaryItemSchema = z.object({
  label: DynamicStringSchema,
  value: DynamicStringSchema,
  badge: z.enum(['neutral', 'success', 'warning', 'danger', 'info']).optional(),
  link: DynamicStringSchema.optional(),
});

const SummaryCardApi = {
  name: 'SummaryCard',
  schema: z
    .object({
      title: DynamicStringSchema.optional(),
      items: z.array(SummaryItemSchema),
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
  childrenArea: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    marginTop: tokens.spacingVerticalS,
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

export const SummaryCard = createReactComponent(SummaryCardApi, ({ props, buildChild }) => {
  const classes = useStyles();
  const items = props.items ?? [];
  const childIds: string[] = (props.children as string[] | undefined) ?? [];

  const isSafeUrl = (url: unknown): boolean => {
    if (typeof url !== 'string') return false;
    return url.startsWith('https://');
  };

  return (
    <Card className={classes.card} data-testid="a2ui-SummaryCard">
      {props.title && (
        <Caption1 className={classes.title}>{props.title}</Caption1>
      )}
      <div className={classes.grid}>
        {items.map((item, idx) => (
          <React.Fragment key={idx}>
            <Body1 className={classes.label}>{item.label}</Body1>
            <div className={classes.valueRow}>
              {item.link && isSafeUrl(item.link) ? (
                <Link
                  href={String(item.link)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                >
                  <Body1Strong>{item.value}</Body1Strong>
                  <Open16Regular />
                </Link>
              ) : (
                <Body1Strong>{item.value}</Body1Strong>
              )}
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
      {childIds.length > 0 && (
        <div className={classes.childrenArea}>
          {childIds.map((childId) => (
            <React.Fragment key={childId}>
              {buildChild(childId)}
            </React.Fragment>
          ))}
        </div>
      )}
    </Card>
  );
});
