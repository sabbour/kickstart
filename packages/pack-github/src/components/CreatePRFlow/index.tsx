import React from 'react';
import { z } from 'zod';
import {
  Card,
  CardHeader,
  Text,
  Spinner,
  Label,
  Link,
  tokens,
  makeStyles,
} from '@fluentui/react-components';
import type { ComponentContribution } from '@aks-kickstart/harness';

const CreatePRFlowSchema = z.object({
  status: z.enum(['idle', 'pushing', 'creating_pr', 'done', 'error']).default('idle'),
  owner: z.string().optional(),
  repo: z.string().optional(),
  targetBranch: z.string().optional(),
  files: z.array(z.string()).optional(),
  prTitle: z.string().optional(),
  prUrl: z.string().optional(),
  prNumber: z.number().optional(),
  errorMessage: z.string().optional(),
  isActive: z.boolean().default(true),
});

type CreatePRFlowProps = z.infer<typeof CreatePRFlowSchema>;

const useStyles = makeStyles({
  card: {
    padding: tokens.spacingVerticalM,
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    maxWidth: '520px',
  },
  fileList: {
    marginTop: tokens.spacingVerticalXS,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
    maxHeight: '200px',
    overflowY: 'auto',
  },
  fileItem: {
    fontFamily: 'monospace',
    fontSize: '12px',
    color: tokens.colorNeutralForeground2,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    marginTop: tokens.spacingVerticalS,
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalS,
  },
  inactive: {
    opacity: 0.6,
    pointerEvents: 'none',
  },
});

function statusMessage(status: CreatePRFlowProps['status']): string | null {
  switch (status) {
    case 'pushing': return 'Pushing files to branch…';
    case 'creating_pr': return 'Opening pull request…';
    default: return null;
  }
}

export const CreatePRFlowRenderer: React.FC<{ props: CreatePRFlowProps }> = ({ props }) => {
  const classes = useStyles();
  const containerClass = props.isActive ? classes.card : `${classes.card} ${classes.inactive}`;
  const repoLabel = [props.owner, props.repo].filter(Boolean).join('/');
  const msg = statusMessage(props.status);

  return (
    <Card className={containerClass}>
      <CardHeader
        header={<Text weight="semibold">Create Pull Request</Text>}
        description={repoLabel ? <Text size={200}>{String(repoLabel)}</Text> : undefined}
      />
      {props.files && props.files.length > 0 && (
        <div>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            {props.files.length} file{props.files.length !== 1 ? 's' : ''}
          </Text>
          <div className={classes.fileList}>
            {props.files.map((f) => (
              <Text key={f} className={classes.fileItem}>
                {String(f)}
              </Text>
            ))}
          </div>
        </div>
      )}
      {props.status === 'idle' && props.isActive && (
        <div className={classes.form}>
          <div>
            <Label htmlFor="pr-title">PR title</Label>
            <Text
              id="pr-title"
              weight="semibold"
              block
              style={{ marginTop: tokens.spacingVerticalXXS }}
            >
              {props.prTitle ? String(props.prTitle) : 'feat: deploy AKS workload'}
            </Text>
          </div>
          {props.targetBranch && (
            <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
              Merging into: <strong>{String(props.targetBranch)}</strong>
            </Text>
          )}
        </div>
      )}
      {msg && (
        <div className={classes.statusRow}>
          <Spinner size="small" />
          <Text size={200}>{msg}</Text>
        </div>
      )}
      {props.status === 'done' && props.prUrl && (
        <div className={classes.statusRow}>
          <Text size={200}>
            PR{props.prNumber ? ` #${props.prNumber}` : ''} opened:{' '}
            <Link href={String(props.prUrl)} target="_blank" rel="noopener noreferrer">
              View pull request
            </Link>
          </Text>
        </div>
      )}
      {props.status === 'error' && props.errorMessage && (
        <Text size={200} style={{ color: tokens.colorPaletteRedForeground1 }}>
          {String(props.errorMessage)}
        </Text>
      )}
    </Card>
  );
};

export const createPRFlowContribution: ComponentContribution = {
  name: 'github/CreatePRFlow',
  propertySchema: CreatePRFlowSchema,
  renderer: CreatePRFlowRenderer,
};
