import React from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema } from '../../vendor/a2ui/schema/common-types';
import {
  Body1,
  Body1Strong,
  Badge,
  Caption1,
  Card,
  Subtitle2,
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
// Schema  (Recipe R12 — Compatibility scorecard, 4-bucket severity)
// ---------------------------------------------------------------------------

const SeverityBucketSchema = z.object({
  bucket: z.enum(['incompatible', 'requiresChanges', 'autoFixed', 'informational']),
  count: z.number(),
  description: DynamicStringSchema.optional(),
}).strict();

const ManifestBreakdownSchema = z.object({
  manifest: DynamicStringSchema,
  findings: z.array(DynamicStringSchema),
}).strict();

const CompatibilityScorecardApi = {
  name: 'CompatibilityScorecard',
  schema: z
    .object({
      title: DynamicStringSchema.optional(),
      buckets: z.array(SeverityBucketSchema),
      manifests: z.array(ManifestBreakdownSchema).optional(),
      specVersion: DynamicStringSchema.optional(),
      children: z.array(z.string()).optional(),
    })
    .strict(),
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

type BucketColor = 'danger' | 'warning' | 'success' | 'informative';

const BUCKET_COLOR: Record<string, BucketColor> = {
  incompatible: 'danger',
  requiresChanges: 'warning',
  autoFixed: 'success',
  informational: 'informative',
};

const BUCKET_LABEL: Record<string, string> = {
  incompatible: 'Incompatible',
  requiresChanges: 'Requires changes',
  autoFixed: 'Auto-fixed',
  informational: 'Informational',
};

const useStyles = makeStyles({
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  titleText: {
    color: tokens.colorNeutralForeground2,
    display: 'block',
    marginBottom: tokens.spacingVerticalS,
  },
  summaryCard: {
    padding: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
  },
  breakdownCard: {
    padding: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
  },
  citation: {
    color: tokens.colorNeutralForeground3,
    display: 'block',
    marginTop: tokens.spacingVerticalXS,
  },
  badgeCell: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
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

export const CompatibilityScorecard = createReactComponent(CompatibilityScorecardApi, ({ props, buildChild }) => {
  const classes = useStyles();
  const buckets = props.buckets ?? [];
  const manifests = props.manifests ?? [];
  const childIds: string[] = (props.children as string[] | undefined) ?? [];

  return (
    <div className={classes.wrapper} data-testid="a2ui-CompatibilityScorecard">
      {props.title && (
        <Subtitle2 className={classes.titleText}>{props.title}</Subtitle2>
      )}
      <Card className={classes.summaryCard}>
        <Body1Strong style={{ display: 'block', marginBottom: tokens.spacingVerticalXS }}>
          Summary
        </Body1Strong>
        <Table aria-label="Compatibility summary">
          <TableHeader>
            <TableRow>
              <TableHeaderCell><Body1Strong>Severity</Body1Strong></TableHeaderCell>
              <TableHeaderCell><Body1Strong>Count</Body1Strong></TableHeaderCell>
              <TableHeaderCell><Body1Strong>Notes</Body1Strong></TableHeaderCell>
            </TableRow>
          </TableHeader>
          <TableBody>
            {buckets.map((b, idx) => (
              <TableRow key={idx}>
                <TableCell>
                  <div className={classes.badgeCell}>
                    <Badge
                      color={BUCKET_COLOR[b.bucket] ?? 'informative'}
                      appearance="tint"
                      size="small"
                    >
                      {BUCKET_LABEL[b.bucket] ?? b.bucket}
                    </Badge>
                  </div>
                </TableCell>
                <TableCell><Body1Strong>{b.count}</Body1Strong></TableCell>
                <TableCell><Body1>{b.description ?? ''}</Body1></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
      {manifests.length > 0 && (
        <Card className={classes.breakdownCard}>
          <Body1Strong style={{ display: 'block', marginBottom: tokens.spacingVerticalXS }}>
            Per-manifest breakdown
          </Body1Strong>
          {manifests.map((m, idx) => (
            <div key={idx} style={{ marginBottom: tokens.spacingVerticalXS }}>
              <Body1Strong>{m.manifest}</Body1Strong>
              <ul style={{ margin: 0, paddingLeft: tokens.spacingHorizontalL }}>
                {m.findings.map((f, fi) => (
                  <li key={fi}><Body1>{f}</Body1></li>
                ))}
              </ul>
            </div>
          ))}
        </Card>
      )}
      {props.specVersion && (
        <Caption1 className={classes.citation}>{props.specVersion}</Caption1>
      )}
      {childIds.length > 0 && (
        <div className={classes.childrenArea}>
          {childIds.map((id) => (
            <React.Fragment key={id}>{buildChild(id)}</React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
});
