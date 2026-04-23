import React from 'react';
import { z } from 'zod';
import {
  Badge,
  Card,
  CardHeader,
  Text,
  tokens,
  makeStyles,
} from '@fluentui/react-components';
import type { ComponentContribution } from '@aks-kickstart/harness';

const ViolationSchema = z.object({
  ruleId: z.string(),
  severity: z.enum(['high', 'medium', 'low']),
  description: z.string(),
  line: z.number().optional(),
});

const SafeguardViolationsSchema = z.object({
  manifestName: z.string().optional().describe('Manifest display name'),
  compliant: z.boolean().describe('True when no violations found'),
  violations: z.array(ViolationSchema),
  summary: z.string().optional().describe('Human-readable compliance summary'),
});

type SafeguardViolationsProps = z.infer<typeof SafeguardViolationsSchema>;

const useStyles = makeStyles({
  card: {
    padding: tokens.spacingVerticalM,
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    maxWidth: '560px',
  },
  summary: {
    marginTop: tokens.spacingVerticalXS,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    marginTop: tokens.spacingVerticalM,
  },
  violationRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: tokens.spacingHorizontalS,
  },
  violationText: {
    flex: 1,
  },
  lineHint: {
    color: tokens.colorNeutralForeground3,
    fontFamily: tokens.fontFamilyMonospace,
  },
  compliantBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalS,
    padding: tokens.spacingVerticalXS,
    backgroundColor: tokens.colorPaletteGreenBackground1,
    borderRadius: tokens.borderRadiusMedium,
  },
});

const SEVERITY_COLOR: Record<string, 'danger' | 'warning' | 'informative'> = {
  high: 'danger',
  medium: 'warning',
  low: 'informative',
};

export const SafeguardViolationsRenderer: React.FC<{ props: SafeguardViolationsProps }> = ({
  props,
}) => {
  const classes = useStyles();
  const title = props.manifestName ? `Safeguards: ${props.manifestName}` : 'Safeguard Check';

  return (
    <Card className={classes.card}>
      <CardHeader
        header={<Text weight="semibold">{title}</Text>}
        action={
          <Badge
            appearance="filled"
            color={props.compliant ? 'success' : 'danger'}
            size="small"
          >
            {props.compliant ? 'Compliant' : `${props.violations.length} violation${props.violations.length === 1 ? '' : 's'}`}
          </Badge>
        }
      />

      {props.summary && (
        <Text size={200} className={classes.summary} style={{ color: tokens.colorNeutralForeground2 }}>
          {String(props.summary)}
        </Text>
      )}

      {props.compliant ? (
        <div className={classes.compliantBanner}>
          <Text size={200} style={{ color: tokens.colorPaletteGreenForeground1 }}>
            All AKS safeguard rules passed.
          </Text>
        </div>
      ) : (
        <div className={classes.list}>
          {props.violations.map((v, i) => (
            <div key={`${v.ruleId}-${i}`} className={classes.violationRow}>
              <Badge appearance="filled" color={SEVERITY_COLOR[v.severity] ?? 'informative'} size="small">
                {String(v.severity)}
              </Badge>
              <div className={classes.violationText}>
                <Text size={200} weight="semibold">{String(v.ruleId)}</Text>
                {' — '}
                <Text size={200}>{String(v.description)}</Text>
                {v.line !== undefined && (
                  <Text size={200} className={classes.lineHint}> (line {v.line})</Text>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
};

export const safeguardViolationsContribution: ComponentContribution = {
  name: 'aks/SafeguardViolations',
  propertySchema: SafeguardViolationsSchema,
  renderer: SafeguardViolationsRenderer,
};
