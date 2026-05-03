import React from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema } from '../../vendor/a2ui/schema/common-types';
import {
  Body1,
  Body1Strong,
  Button,
  Card,
  makeStyles,
  tokens,
} from '@fluentui/react-components';

// ---------------------------------------------------------------------------
// Schema  (Recipe R5 — Diff plan with additive markers)
// ---------------------------------------------------------------------------

const DiffLineSchema = z.object({
  marker: z.enum(['+', '-', '~', ' ']),
  text: DynamicStringSchema,
  annotation: DynamicStringSchema.optional(),
}).strict();

const DiffPlanApi = {
  name: 'DiffPlan',
  schema: z
    .object({
      title: DynamicStringSchema.optional(),
      lines: z.array(DiffLineSchema),
      approveLabel: DynamicStringSchema.optional(),
      children: z.array(z.string()).optional(),
    })
    .strict(),
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const MARKER_COLORS: Record<string, string> = {
  '+': 'colorPaletteGreenForeground1',
  '-': 'colorPaletteRedForeground1',
  '~': 'colorPaletteBerryForeground1',
  ' ': 'colorNeutralForeground3',
};

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
  diffList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    fontFamily: 'monospace',
  },
  diffRow: {
    display: 'grid',
    gridTemplateColumns: '1.2em 1fr auto',
    columnGap: tokens.spacingHorizontalXS,
    alignItems: 'baseline',
  },
  markerAdd: { color: tokens.colorPaletteGreenForeground1 },
  markerDel: { color: tokens.colorPaletteRedForeground1 },
  markerMod: { color: tokens.colorPaletteBerryForeground1 },
  markerUnchanged: { color: tokens.colorNeutralForeground3 },
  annotation: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase100,
    whiteSpace: 'nowrap',
  },
  actions: {
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

export const DiffPlan = createReactComponent(DiffPlanApi, ({ props, buildChild }) => {
  const classes = useStyles();
  const lines = props.lines ?? [];
  const childIds: string[] = (props.children as string[] | undefined) ?? [];

  const markerClass = (marker: string) => {
    if (marker === '+') return classes.markerAdd;
    if (marker === '-') return classes.markerDel;
    if (marker === '~') return classes.markerMod;
    return classes.markerUnchanged;
  };

  return (
    <Card className={classes.card} data-testid="a2ui-DiffPlan">
      {props.title && (
        <Body1Strong className={classes.title}>{props.title}</Body1Strong>
      )}
      <div className={classes.diffList}>
        {lines.map((line, idx) => (
          <div key={idx} className={classes.diffRow}>
            <Body1 className={markerClass(line.marker)}>{line.marker}</Body1>
            <Body1>{line.text}</Body1>
            {line.annotation && (
              <span className={classes.annotation}>{line.annotation}</span>
            )}
          </div>
        ))}
      </div>
      {props.approveLabel && (
        <div className={classes.actions}>
          <Button appearance="primary" size="small">
            {props.approveLabel}
          </Button>
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
