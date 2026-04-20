import React from 'react';
import { z } from 'zod';
import {
  Card,
  CardHeader,
  Text,
  Badge,
  Link,
  tokens,
  makeStyles,
} from '@fluentui/react-components';
import type { ComponentContribution } from '@aks-kickstart/harness';

const RepoInfoSchema = z.object({
  repo: z.object({
    name: z.string(),
    fullName: z.string().optional(),
    description: z.string().nullable().optional(),
    language: z.string().nullable().optional(),
    defaultBranch: z.string(),
    htmlUrl: z.string(),
    private: z.boolean().optional(),
    stargazersCount: z.number().optional(),
    forksCount: z.number().optional(),
  }),
  isActive: z.boolean().default(true),
});

type RepoInfoProps = z.infer<typeof RepoInfoSchema>;

const useStyles = makeStyles({
  card: {
    padding: tokens.spacingVerticalM,
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    maxWidth: '480px',
  },
  meta: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalXS,
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  inactive: {
    opacity: 0.6,
  },
});

export const RepoInfoRenderer: React.FC<{ props: RepoInfoProps }> = ({ props }) => {
  const classes = useStyles();
  const containerClass = props.isActive ? classes.card : `${classes.card} ${classes.inactive}`;
  const { repo } = props;

  return (
    <Card className={containerClass}>
      <CardHeader
        header={
          <Link href={String(repo.htmlUrl)} target="_blank" rel="noopener noreferrer">
            <Text weight="semibold">{String(repo.fullName ?? repo.name)}</Text>
          </Link>
        }
      />
      {repo.description && (
        <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
          {String(repo.description)}
        </Text>
      )}
      <div className={classes.meta}>
        <Badge size="small" appearance="outline">
          {String(repo.defaultBranch)}
        </Badge>
        {repo.language && (
          <Badge size="small" appearance="filled" color="brand">
            {String(repo.language)}
          </Badge>
        )}
        {repo.private !== undefined && (
          <Badge size="small" appearance="outline" color={repo.private ? 'warning' : 'success'}>
            {repo.private ? 'Private' : 'Public'}
          </Badge>
        )}
      </div>
    </Card>
  );
};

export const repoInfoContribution: ComponentContribution = {
  name: 'github/RepoInfo',
  propertySchema: RepoInfoSchema,
  renderer: RepoInfoRenderer,
};
