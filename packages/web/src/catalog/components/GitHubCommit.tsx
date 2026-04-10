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
  Tooltip,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { Document20Regular, PersonCircle20Regular } from '@fluentui/react-icons';
import { useArtifacts } from '../../contexts/ArtifactContext';

const GitHubCommitApi = {
  name: 'GitHubCommit',
  schema: z.object({
    sha: DynamicStringSchema,
    message: DynamicStringSchema,
    author: DynamicStringSchema,
    date: DynamicStringSchema.optional(),
    filesChanged: z.array(z.string()).optional(),
    artifactPath: DynamicStringSchema.optional(),
  }).strict(),
};

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    width: '100%',
  },
  shaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalXS,
  },
  shaCode: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    backgroundColor: tokens.colorNeutralBackground3,
    padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalXS}`,
    borderRadius: tokens.borderRadiusSmall,
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    marginTop: tokens.spacingVerticalXS,
    flexWrap: 'wrap',
  },
  authorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    color: tokens.colorNeutralForeground3,
  },
  fileList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalXS,
    marginTop: tokens.spacingVerticalS,
  },
  fileChip: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    backgroundColor: tokens.colorNeutralBackground3,
    padding: `${tokens.spacingVerticalXXS} ${tokens.spacingHorizontalXS}`,
    borderRadius: tokens.borderRadiusSmall,
  },
  artifactSection: {
    marginTop: tokens.spacingVerticalS,
    paddingTop: tokens.spacingVerticalS,
    borderTopWidth: tokens.strokeWidthThin,
    borderTopStyle: 'solid',
    borderTopColor: tokens.colorNeutralStroke2,
  },
  artifactCode: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase100,
    color: tokens.colorNeutralForeground2,
    backgroundColor: tokens.colorNeutralBackground3,
    padding: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusMedium,
    overflowX: 'auto',
    maxHeight: '120px',
    display: 'block',
    whiteSpace: 'pre',
  },
});

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function shortSha(sha: string): string {
  return sha.length > 7 ? sha.slice(0, 7) : sha;
}

export const GitHubCommit = createReactComponent(GitHubCommitApi, ({ props }) => {
  const classes = useStyles();
  const { getArtifact } = useArtifacts();

  const sha = String(props.sha);
  const message = String(props.message);
  const author = String(props.author);
  const date = props.date ? String(props.date) : undefined;
  const filesChanged = props.filesChanged ?? [];
  const artifactPath = props.artifactPath ? String(props.artifactPath) : undefined;

  const artifact = artifactPath ? getArtifact(artifactPath) : null;

  return (
    <Card className={classes.root}>
      <CardHeader
        header={<Body1Strong>{message}</Body1Strong>}
        description={
          <div className={classes.shaRow}>
            <Tooltip content={sha} relationship="description">
              <code className={classes.shaCode}>{shortSha(sha)}</code>
            </Tooltip>
            {filesChanged.length > 0 && (
              <Badge appearance="outline" color="informative" size="small">
                {filesChanged.length} file{filesChanged.length !== 1 ? 's' : ''} changed
              </Badge>
            )}
          </div>
        }
      />

      <div className={classes.metaRow}>
        <span className={classes.authorRow}>
          <PersonCircle20Regular style={{ fontSize: '14px' }} />
          <Caption1>{author}</Caption1>
        </span>
        {date && (
          <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
            {formatDate(date)}
          </Caption1>
        )}
      </div>

      {filesChanged.length > 0 && (
        <div className={classes.fileList}>
          {filesChanged.map((f: string) => (
            <span key={f} className={classes.fileChip}>
              <Document20Regular style={{ fontSize: '12px', color: tokens.colorNeutralForeground3 }} />
              <Caption1 style={{ fontFamily: tokens.fontFamilyMonospace }}>{f}</Caption1>
            </span>
          ))}
        </div>
      )}

      {artifact && (
        <div className={classes.artifactSection}>
          <Body2 style={{ fontWeight: 600, marginBottom: tokens.spacingVerticalXS }}>
            Generated artifact: {artifact.path}
          </Body2>
          <pre className={classes.artifactCode}>
            {artifact.content.slice(0, 800)}
            {artifact.content.length > 800 ? '\n… (truncated)' : ''}
          </pre>
        </div>
      )}
    </Card>
  );
});
