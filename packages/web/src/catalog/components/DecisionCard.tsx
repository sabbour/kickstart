import React from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema } from '../../vendor/a2ui/web_core/schema/common-types';
import {
  Badge,
  Body1,
  Caption1,
  Card,
  Subtitle2,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { CheckmarkCircleRegular } from '@fluentui/react-icons';

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const DecisionCardApi = {
  name: 'DecisionCard',
  schema: z
    .object({
      title: DynamicStringSchema,
      recommendation: DynamicStringSchema,
      rationale: DynamicStringSchema.optional(),
      alternatives: z.array(DynamicStringSchema).optional(),
      badge: z.enum(['recommended', 'best-practice', 'required', 'optional']).optional(),
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
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: tokens.spacingVerticalXS,
  },
  titleText: {
    color: tokens.colorNeutralForeground3,
  },
  recommendationRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalXS,
  },
  checkIcon: {
    color: tokens.colorPaletteGreenForeground1,
    fontSize: '20px',
    flexShrink: 0,
  },
  rationale: {
    color: tokens.colorNeutralForeground2,
    marginTop: tokens.spacingVerticalXS,
  },
  alternativesLabel: {
    display: 'block',
    marginTop: tokens.spacingVerticalS,
    color: tokens.colorNeutralForeground3,
  },
  alternativesList: {
    margin: 0,
    paddingLeft: tokens.spacingHorizontalL,
    color: tokens.colorNeutralForeground2,
  },
});

// ---------------------------------------------------------------------------
// Badge colour + label mapping
// ---------------------------------------------------------------------------

type BadgeColor = 'success' | 'brand' | 'important' | 'subtle';

const BADGE_CONFIG: Record<string, { color: BadgeColor; label: string }> = {
  recommended: { color: 'success', label: 'Recommended' },
  'best-practice': { color: 'brand', label: 'Best Practice' },
  required: { color: 'important', label: 'Required' },
  optional: { color: 'subtle', label: 'Optional' },
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const DecisionCard = createReactComponent(DecisionCardApi, ({ props }) => {
  const classes = useStyles();
  const badgeCfg = props.badge ? BADGE_CONFIG[props.badge] : undefined;
  const alternatives = props.alternatives ?? [];

  return (
    <div data-testid="a2ui-DecisionCard">
      <Card className={classes.card}>
        <div className={classes.header}>
          <Caption1 className={classes.titleText}>{props.title}</Caption1>
          {badgeCfg && (
            <Badge color={badgeCfg.color} appearance="tint" size="small">
              {badgeCfg.label}
            </Badge>
          )}
        </div>

        <div className={classes.recommendationRow}>
          <CheckmarkCircleRegular className={classes.checkIcon} />
          <Subtitle2>{props.recommendation}</Subtitle2>
        </div>

        {props.rationale && (
          <Body1 className={classes.rationale}>{props.rationale}</Body1>
        )}

        {alternatives.length > 0 && (
          <>
            <Caption1 className={classes.alternativesLabel}>Alternatives considered</Caption1>
            <ul className={classes.alternativesList}>
              {alternatives.map((alt, idx) => (
                <li key={idx}>
                  <Body1>{alt}</Body1>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
});
