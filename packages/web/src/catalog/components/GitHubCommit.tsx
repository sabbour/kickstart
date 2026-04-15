import React, { useMemo, useState } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema, ActionSchema } from '../../vendor/a2ui/web_core/schema/common-types';
import {
  Body2,
  Button,
  Caption1,
  Card,
  CardHeader,
  Checkbox,
  Field,
  Input,
  Link,
  MessageBar,
  MessageBarBody,
  Spinner,
  Subtitle1,
  Textarea,
  Tooltip,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  CheckmarkCircle20Regular,
  DismissCircle20Regular,
  Document20Regular,
} from '@fluentui/react-icons';
import { useAPIConnector } from '../../contexts/APIConnectorContext';
import { useArtifacts } from '../../contexts/ArtifactContext';
import type { GitHubConnector } from '@kickstart/core';
import type { Artifact } from '@kickstart/core';

const GitHubCommitApi = {
  name: 'GitHubCommit',
  schema: z.object({
    repoFullName: DynamicStringSchema.optional(),
    defaultBranch: DynamicStringSchema.optional(),
    suggestedBranchName: DynamicStringSchema.optional(),
    suggestedTitle: DynamicStringSchema.optional(),
    suggestedBody: DynamicStringSchema.optional(),
    onSuccess: ActionSchema.optional(),
    onError: ActionSchema.optional(),
  }).strict(),
};

/** Protected branches — PRs can target these but direct pushes are blocked. */
const PROTECTED_BRANCHES = new Set(['main', 'master', 'production']);

/** Validate branch name for Git compatibility. */
function validateBranchName(name: string): string | null {
  if (!name) return 'Branch name is required';
  if (name.length > 100) return 'Branch name too long (max 100 characters)';
  if (/[~^:?*[\]\\]/.test(name)) return 'Branch name contains invalid characters';
  if (name.startsWith('-') || name.startsWith('.')) return 'Branch name cannot start with - or .';
  if (name.endsWith('.lock') || name.endsWith('.')) return 'Branch name cannot end with .lock or .';
  if (name.includes('..') || name.includes(' ')) return 'Branch name cannot contain spaces or ..';
  if (PROTECTED_BRANCHES.has(name)) return `Cannot push directly to protected branch "${name}"`;
  return null;
}

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalL,
    width: '100%',
  },
  artifactList: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    marginTop: tokens.spacingVerticalS,
    maxHeight: '300px',
    overflowY: 'auto',
  },
  artifactItem: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: `${tokens.spacingVerticalXS} ${tokens.spacingHorizontalS}`,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusSmall,
  },
  artifactIcon: {
    color: tokens.colorNeutralForeground3,
    flexShrink: 0,
  },
  artifactPath: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  artifactSize: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase100,
    flexShrink: 0,
  },
  diffPreview: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground2,
    backgroundColor: tokens.colorNeutralBackground3,
    padding: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusMedium,
    overflowX: 'auto',
    maxHeight: '150px',
    display: 'block',
    whiteSpace: 'pre',
    marginTop: tokens.spacingVerticalXS,
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
  resultSection: {
    marginTop: tokens.spacingVerticalM,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  selectControls: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalXS,
  },
});

type CommitState = 'selecting' | 'configuring' | 'executing' | 'success' | 'error';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const GitHubCommit = createReactComponent(GitHubCommitApi, ({ props }) => {
  const classes = useStyles();
  const connector = useAPIConnector('github') as GitHubConnector | undefined;
  const { artifacts } = useArtifacts();

  const repoFullName = props.repoFullName ? String(props.repoFullName) : '';
  const defaultBranch = props.defaultBranch ? String(props.defaultBranch) : 'main';
  const suggestedBranch = props.suggestedBranchName ? String(props.suggestedBranchName) : 'kickstart/generated-artifacts';
  const suggestedTitle = props.suggestedTitle ? String(props.suggestedTitle) : 'feat: add Kickstart-generated artifacts';
  const suggestedBody = props.suggestedBody ? String(props.suggestedBody) : 'This PR adds artifacts generated by Kickstart.';

  const [state, setState] = useState<CommitState>('selecting');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(
    () => new Set(artifacts.map((a) => a.path))
  );
  const [branchName, setBranchName] = useState(suggestedBranch);
  const [prTitle, setPrTitle] = useState(suggestedTitle);
  const [prBody, setPrBody] = useState(suggestedBody);
  const [expandedFile, setExpandedFile] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState('');
  const [prUrl, setPrUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();

  const branchError = validateBranchName(branchName);
  const selectedArtifacts = useMemo(
    () => artifacts.filter((a) => selectedFiles.has(a.path)),
    [artifacts, selectedFiles]
  );

  const toggleFile = (path: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const selectAll = () => setSelectedFiles(new Set(artifacts.map((a) => a.path)));
  const selectNone = () => setSelectedFiles(new Set());

  const handleContinue = () => {
    setState('configuring');
  };

  const handleBack = () => {
    setState('selecting');
    setError(undefined);
  };

  const handleCreatePR = async () => {
    if (!repoFullName) {
      setError('Repository not specified. Please select a repository first.');
      return;
    }

    if (selectedArtifacts.length === 0) {
      setError('Select at least one file to commit.');
      return;
    }

    setState('executing');
    setError(undefined);
    setResultMessage('');

    try {
      if (!connector) {
        throw new Error('GitHub pull request creation is unavailable. Refresh the page and try again.');
      }

      const [owner, repo] = repoFullName.split('/');
      if (!owner || !repo) {
        throw new Error('Invalid repository format. Expected "owner/repo".');
      }

      const fileList = selectedArtifacts.map((a) => `- \`${a.path}\``).join('\n');
      const prBodyFull = `${prBody}\n\n---\n\n**Files included (${selectedArtifacts.length}):**\n${fileList}`;

      const result = await connector.commitFilesAndCreatePullRequest({
        owner,
        repo,
        title: prTitle,
        head: branchName,
        base: defaultBranch,
        body: prBodyFull,
        commitMessage: prTitle,
        files: selectedArtifacts.map((artifact) => ({
          path: artifact.path,
          content: artifact.content,
        })),
      });

      setState('success');
      setPrUrl(result.pullRequest.html_url);
      setResultMessage(
        `Committed ${result.committedFilesCount} file${result.committedFilesCount === 1 ? '' : 's'} and opened pull request #${result.pullRequest.number}.`,
      );
      if (props.onSuccess) (props.onSuccess as () => void)();
    } catch (err) {
      setState('error');
      setResultMessage(err instanceof Error ? err.message : 'Failed to create pull request');
      if (props.onError) (props.onError as () => void)();
    }
  };

  const handleReset = () => {
    setState('selecting');
    setResultMessage('');
    setPrUrl(null);
    setError(undefined);
  };

  // Success / error result view
  if (state === 'success' || state === 'error') {
    return (
      <Card className={classes.root}>
        <CardHeader
          header={<Subtitle1>Create Pull Request</Subtitle1>}
          description={
            <Caption1>
              {repoFullName || 'Repository'} \u2192 {branchName}
            </Caption1>
          }
        />
        <div className={classes.resultSection}>
          {state === 'success' ? (
            <>
              <CheckmarkCircle20Regular style={{ color: tokens.colorPaletteGreenForeground1 }} />
              <Body2 style={{ color: tokens.colorPaletteGreenForeground1 }}>{resultMessage}</Body2>
            </>
          ) : (
            <>
              <DismissCircle20Regular style={{ color: tokens.colorPaletteRedForeground1 }} />
              <Body2 style={{ color: tokens.colorPaletteRedForeground1 }}>{resultMessage}</Body2>
            </>
          )}
        </div>
        {prUrl && (
          <div style={{ marginTop: tokens.spacingVerticalS }}>
            <Link href={prUrl} target="_blank" rel="noopener noreferrer">
              View pull request \u2197
            </Link>
          </div>
        )}
        <div className={classes.actions}>
          <Button appearance="subtle" onClick={handleReset}>
            Start over
          </Button>
        </div>
      </Card>
    );
  }

  // Executing state
  if (state === 'executing') {
    return (
      <Card className={classes.root}>
        <CardHeader
          header={<Subtitle1>Creating Pull Request\u2026</Subtitle1>}
          description={<Caption1>Committing {selectedArtifacts.length} files to {branchName}</Caption1>}
        />
        <div className={classes.actions} style={{ justifyContent: 'center' }}>
          <Spinner size="small" label="Creating commit and pull request\u2026" />
        </div>
      </Card>
    );
  }

  // Configuration step (branch, title, body)
  if (state === 'configuring') {
    return (
      <Card className={classes.root}>
        <CardHeader
          header={<Subtitle1>Configure Pull Request</Subtitle1>}
          description={
            <Caption1>
              {selectedArtifacts.length} file{selectedArtifacts.length !== 1 ? 's' : ''} selected
            </Caption1>
          }
        />

        {error && (
          <MessageBar intent="error" style={{ marginTop: tokens.spacingVerticalS }}>
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        )}

        <div className={classes.formFields}>
          <Field
            label="Target repository"
            validationState={repoFullName ? 'none' : 'warning'}
            validationMessage={repoFullName ? undefined : 'No repository selected'}
          >
            <Input
              value={repoFullName}
              disabled
              style={{ fontFamily: tokens.fontFamilyMonospace }}
            />
          </Field>

          <Field
            label="Branch name"
            validationState={branchError ? 'error' : 'success'}
            validationMessage={branchError ?? 'Valid branch name'}
          >
            <Input
              value={branchName}
              onChange={(_, data) => setBranchName(data.value)}
              style={{ fontFamily: tokens.fontFamilyMonospace }}
            />
          </Field>

          <Field label="PR title">
            <Input
              value={prTitle}
              onChange={(_, data) => setPrTitle(data.value)}
            />
          </Field>

          <Field label="PR description">
            <Textarea
              value={prBody}
              onChange={(_, data) => setPrBody(data.value)}
              rows={4}
              resize="vertical"
            />
          </Field>
        </div>

        <div className={classes.actions}>
          <Button appearance="subtle" onClick={handleBack}>
            \u2190 Back
          </Button>
          <Button
            appearance="primary"
            onClick={handleCreatePR}
            disabled={!!branchError || !prTitle || selectedArtifacts.length === 0}
          >
            Create pull request
          </Button>
        </div>
      </Card>
    );
  }

  // Artifact selection step (default)
  return (
    <Card className={classes.root}>
      <CardHeader
        header={<Subtitle1>Create Pull Request</Subtitle1>}
        description={
          <Caption1>
            Select artifacts to include in the pull request
          </Caption1>
        }
      />

      {artifacts.length === 0 ? (
        <MessageBar intent="warning" style={{ marginTop: tokens.spacingVerticalS }}>
          <MessageBarBody>No artifacts available. Generate some files first.</MessageBarBody>
        </MessageBar>
      ) : (
        <>
          <div className={classes.selectControls} style={{ marginTop: tokens.spacingVerticalS }}>
            <Button appearance="subtle" size="small" onClick={selectAll}>
              Select all
            </Button>
            <Button appearance="subtle" size="small" onClick={selectNone}>
              Select none
            </Button>
            <Caption1 style={{ alignSelf: 'center', color: tokens.colorNeutralForeground3 }}>
              {selectedFiles.size} of {artifacts.length} selected
            </Caption1>
          </div>

          <div className={classes.artifactList}>
            {artifacts.map((artifact: Artifact) => (
              <div key={artifact.path}>
                <div className={classes.artifactItem}>
                  <Checkbox
                    checked={selectedFiles.has(artifact.path)}
                    onChange={() => toggleFile(artifact.path)}
                    aria-label={`Select ${artifact.path}`}
                  />
                  <Document20Regular className={classes.artifactIcon} style={{ fontSize: '16px' }} />
                  <Tooltip content={artifact.path} relationship="description">
                    <span
                      className={classes.artifactPath}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setExpandedFile(expandedFile === artifact.path ? null : artifact.path)}
                    >
                      {artifact.path}
                    </span>
                  </Tooltip>
                  <span className={classes.artifactSize}>
                    {formatSize(artifact.content.length)}
                  </span>
                </div>
                {expandedFile === artifact.path && (
                  <pre className={classes.diffPreview}>
                    {artifact.content.slice(0, 500)}
                    {artifact.content.length > 500 ? '\\n\u2026 (truncated)' : ''}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <div className={classes.actions}>
        <Button
          appearance="primary"
          onClick={handleContinue}
          disabled={selectedFiles.size === 0}
        >
          Continue \u2192 Configure PR
        </Button>
      </div>
    </Card>
  );
});
