import React from 'react';
import { z } from 'zod';
import {
  Body1Strong,
  Button,
  Card,
  CardHeader,
  Caption1,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Spinner,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { Document20Regular } from '@fluentui/react-icons';
import type { ComponentContribution } from '@aks-kickstart/harness';

const CommitFileSchema = z.object({
  path: z.string(),
  size: z.number().optional(),
  type: z.string().optional(),
});

const GitHubCommitSchema = z.object({
  status: z.enum(['idle', 'loading', 'success', 'error']).default('idle'),
  repoFullName: z.string().optional().describe('Full repository name, e.g. owner/repo'),
  defaultBranch: z.string().optional().describe('Default branch of the repository'),
  suggestedBranchName: z.string().optional().describe('Pre-filled branch name suggestion'),
  suggestedTitle: z.string().optional().describe('Pre-filled commit title suggestion'),
  suggestedBody: z.string().optional().describe('Pre-filled commit message body'),
  files: z.array(CommitFileSchema).optional().describe('Files to commit'),
  resultUrl: z.string().optional().describe('URL of the created PR on success'),
  errorMessage: z.string().optional(),
  isActive: z.boolean().default(true),
});

type GitHubCommitProps = z.infer<typeof GitHubCommitSchema>;

const useStyles = makeStyles({
  card: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalL,
    width: '100%',
  },
  fileList: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    marginTop: tokens.spacingVerticalS,
    maxHeight: '200px',
    overflowY: 'auto',
  },
  fileItem: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusSmall,
  },
  filePath: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  formFields: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    marginTop: tokens.spacingVerticalS,
  },
  actions: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalM,
    alignItems: 'center',
  },
  inactive: {
    opacity: 0.6,
    pointerEvents: 'none',
  },
});

export const GitHubCommitRenderer: React.FC<{
  props: GitHubCommitProps;
  dispatchAction?: (action: unknown) => void;
}> = ({ props, dispatchAction }) => {
  const classes = useStyles();
  const cardClass = props.isActive ? classes.card : `${classes.card} ${classes.inactive}`;

  const isLoading = props.status === 'loading';
  const isSuccess = props.status === 'success';

  return (
    <Card className={cardClass}>
      <CardHeader
        header={<Body1Strong>Commit to GitHub</Body1Strong>}
        description={
          props.repoFullName
            ? <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>{String(props.repoFullName)}</Caption1>
            : undefined
        }
      />

      {props.status === 'error' && props.errorMessage && (
        <MessageBar intent="error">
          <MessageBarBody>{String(props.errorMessage)}</MessageBarBody>
        </MessageBar>
      )}

      {isSuccess && props.resultUrl && (
        <MessageBar intent="success">
          <MessageBarBody>
            Pull request created:{' '}
            <a href={String(props.resultUrl)} target="_blank" rel="noopener noreferrer">
              {String(props.resultUrl)}
            </a>
          </MessageBarBody>
        </MessageBar>
      )}

      {props.files && props.files.length > 0 && (
        <>
          <Caption1 style={{ color: tokens.colorNeutralForeground3, marginTop: tokens.spacingVerticalS }}>
            {props.files.length} file{props.files.length !== 1 ? 's' : ''} to commit
          </Caption1>
          <div className={classes.fileList}>
            {props.files.map((file) => (
              <div key={file.path} className={classes.fileItem}>
                <Document20Regular style={{ color: tokens.colorNeutralForeground3, flexShrink: 0 }} />
                <span className={classes.filePath}>{file.path}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <div className={classes.formFields}>
        <Field label="Branch name">
          <Input
            defaultValue={props.suggestedBranchName ?? ''}
            placeholder="feature/my-branch"
            disabled={isLoading || !props.isActive || isSuccess}
          />
        </Field>
        <Field label="Commit title">
          <Input
            defaultValue={props.suggestedTitle ?? ''}
            placeholder="feat: add changes"
            disabled={isLoading || !props.isActive || isSuccess}
          />
        </Field>
      </div>

      <div className={classes.actions}>
        {isLoading && <Spinner size="small" label="Committing…" />}
        {!isLoading && !isSuccess && (
          <Button
            appearance="primary"
            disabled={!props.isActive}
            onClick={() => dispatchAction?.({ event: { name: 'github:commit:create_pr' } })}
          >
            Commit and open PR
          </Button>
        )}
        {isSuccess && (
          <Text size={200} style={{ color: tokens.colorPaletteGreenForeground1 }}>
            Pull request created successfully.
          </Text>
        )}
      </div>
    </Card>
  );
};

export const gitHubCommitContribution: ComponentContribution = {
  name: 'github/GitHubCommit',
  propertySchema: GitHubCommitSchema,
  renderer: GitHubCommitRenderer,
};
