import React from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema } from '../../vendor/a2ui/web_core/schema/common-types';
import {
  Body1Strong,
  Body2,
  Caption1,
  Card,
  CardHeader,
  Badge,
  Link,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  CheckmarkCircle20Regular,
  DismissCircle20Regular,
  ArrowClockwise20Regular,
  Clock20Regular,
} from '@fluentui/react-icons';

const GitHubActionApi = {
  name: 'GitHubAction',
  schema: z.object({
    workflowName: DynamicStringSchema,
    status: z.enum(['success', 'failure', 'running', 'queued']),
    branch: DynamicStringSchema.optional(),
    lastRunDate: DynamicStringSchema.optional(),
    runUrl: DynamicStringSchema.optional(),
  }).strict(),
};

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    width: '100%',
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    marginTop: tokens.spacingVerticalXS,
    flexWrap: 'wrap',
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
  },
});

type WorkflowStatus = 'success' | 'failure' | 'running' | 'queued';

interface StatusConfig {
  label: string;
  color: 'success' | 'danger' | 'brand' | 'subtle';
  icon: React.ReactElement;
}

const STATUS_CONFIG: Record<WorkflowStatus, StatusConfig> = {
  success: {
    label: 'Success',
    color: 'success',
    icon: <CheckmarkCircle20Regular />,
  },
  failure: {
    label: 'Failed',
    color: 'danger',
    icon: <DismissCircle20Regular />,
  },
  running: {
    label: 'Running',
    color: 'brand',
    icon: <ArrowClockwise20Regular />,
  },
  queued: {
    label: 'Queued',
    color: 'subtle',
    icon: <Clock20Regular />,
  },
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const GitHubAction = createReactComponent(GitHubActionApi, ({ props }) => {
  const classes = useStyles();
  const status = props.status as WorkflowStatus;
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.queued;

  return (
    <Card className={classes.root}>
      <CardHeader
        header={<Body1Strong>{String(props.workflowName)}</Body1Strong>}
        description={
          <div className={classes.statusRow}>
            {cfg.icon}
            <Badge appearance="filled" color={cfg.color} size="small">
              {cfg.label}
            </Badge>
          </div>
        }
      />
      <div className={classes.metaRow}>
        {props.branch && (
          <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
            Branch: <strong>{String(props.branch)}</strong>
          </Caption1>
        )}
        {props.lastRunDate && (
          <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
            Last run: {formatDate(String(props.lastRunDate))}
          </Caption1>
        )}
        {props.runUrl && (
          <Link href={String(props.runUrl)} target="_blank" rel="noopener noreferrer">
            <Caption1>View run ↗</Caption1>
          </Link>
        )}
      </div>
    </Card>
  );
});
