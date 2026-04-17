import React from 'react';
import { z } from 'zod';
import {
  Card,
  CardHeader,
  Text,
  Spinner,
  Badge,
  Link,
  tokens,
  makeStyles,
} from '@fluentui/react-components';
import type { ComponentContribution } from '@kickstart/harness';

const ActionSchema = z.object({
  workflowRun: z.object({
    status: z.enum(['queued', 'in_progress', 'completed', 'waiting', 'requested', 'pending']),
    conclusion: z
      .enum(['success', 'failure', 'cancelled', 'skipped', 'timed_out', 'action_required', 'neutral'])
      .nullable()
      .optional(),
    url: z.string(),
    runNumber: z.number().optional(),
    workflowName: z.string().optional(),
  }),
  isActive: z.boolean().default(true),
});

type ActionProps = z.infer<typeof ActionSchema>;

const useStyles = makeStyles({
  card: {
    padding: tokens.spacingVerticalM,
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    maxWidth: '480px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalXS,
  },
  inactive: {
    opacity: 0.6,
  },
});

function statusColor(
  status: ActionProps['workflowRun']['status'],
  conclusion: ActionProps['workflowRun']['conclusion'],
): 'success' | 'danger' | 'warning' | 'informative' | 'important' {
  if (status === 'completed') {
    if (conclusion === 'success') return 'success';
    if (conclusion === 'failure') return 'danger';
    if (conclusion === 'cancelled') return 'warning';
  }
  if (status === 'in_progress') return 'informative';
  return 'important';
}

function statusLabel(
  status: ActionProps['workflowRun']['status'],
  conclusion: ActionProps['workflowRun']['conclusion'],
): string {
  if (status === 'completed' && conclusion) return conclusion;
  return status.replace('_', ' ');
}

export const ActionRenderer: React.FC<{ props: ActionProps }> = ({ props }) => {
  const classes = useStyles();
  const containerClass = props.isActive ? classes.card : `${classes.card} ${classes.inactive}`;
  const { workflowRun } = props;
  const isRunning = workflowRun.status === 'in_progress' || workflowRun.status === 'queued';

  return (
    <Card className={containerClass}>
      <CardHeader
        header={
          <Text weight="semibold">
            {String(workflowRun.workflowName ?? 'GitHub Actions')}
            {workflowRun.runNumber ? ` #${workflowRun.runNumber}` : ''}
          </Text>
        }
      />
      <div className={classes.row}>
        {isRunning && <Spinner size="extra-tiny" />}
        <Badge
          size="medium"
          appearance="filled"
          color={statusColor(workflowRun.status, workflowRun.conclusion ?? null)}
        >
          {statusLabel(workflowRun.status, workflowRun.conclusion ?? null)}
        </Badge>
        <Link href={String(workflowRun.url)} target="_blank" rel="noopener noreferrer">
          <Text size={200}>View run</Text>
        </Link>
      </div>
    </Card>
  );
};

export const actionContribution: ComponentContribution = {
  name: 'github/Action',
  propertySchema: ActionSchema,
  renderer: ActionRenderer,
};
