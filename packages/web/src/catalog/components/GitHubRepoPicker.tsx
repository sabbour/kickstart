import React, { useEffect, useState } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema, ActionSchema } from '../../vendor/a2ui/web_core/schema/common-types';
import {
  Body2,
  Caption1,
  Card,
  CardHeader,
  Input,
  Spinner,
  Badge,
  makeStyles,
  shorthands,
  tokens,
} from '@fluentui/react-components';
import { Search20Regular, Star20Regular } from '@fluentui/react-icons';
import { useAPIConnector } from '../../contexts/APIConnectorContext';
import type { GitHubConnector, GitHubRepo } from '@kickstart/core';

const GitHubRepoPickerApi = {
  name: 'GitHubRepoPicker',
  schema: z.object({
    placeholder: DynamicStringSchema.optional(),
    selectedRepo: DynamicStringSchema.optional(),
    onSelect: ActionSchema.optional(),
  }).strict(),
};

/** Stub repos shown when the connector is not authenticated. */
const STUB_REPOS: (GitHubRepo & { stargazers_count: number; updated_at: string })[] = [
  {
    id: 1,
    name: 'my-web-app',
    full_name: 'stub-user/my-web-app',
    private: false,
    html_url: 'https://github.com/stub-user/my-web-app',
    description: 'A React web application',
    default_branch: 'main',
    language: 'TypeScript',
    stargazers_count: 42,
    updated_at: '2026-04-01T12:00:00Z',
  },
  {
    id: 2,
    name: 'api-service',
    full_name: 'stub-user/api-service',
    private: false,
    html_url: 'https://github.com/stub-user/api-service',
    description: 'REST API built with Node.js',
    default_branch: 'main',
    language: 'JavaScript',
    stargazers_count: 17,
    updated_at: '2026-03-28T08:30:00Z',
  },
  {
    id: 3,
    name: 'k8s-configs',
    full_name: 'stub-user/k8s-configs',
    private: true,
    html_url: 'https://github.com/stub-user/k8s-configs',
    description: 'Kubernetes manifests and Helm charts',
    default_branch: 'main',
    language: 'YAML',
    stargazers_count: 5,
    updated_at: '2026-04-05T16:45:00Z',
  },
];

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    width: '100%',
  },
  searchRow: {
    marginBottom: tokens.spacingVerticalS,
  },
  repoList: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  repoCard: {
    cursor: 'pointer',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    width: '100%',
  },
  repoCardSelected: {
    cursor: 'pointer',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    width: '100%',
    ...shorthands.borderColor(tokens.colorBrandStroke1),
    ...shorthands.borderWidth(tokens.strokeWidthThick),
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalXXS,
    flexWrap: 'wrap',
  },
  starRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    color: tokens.colorNeutralForeground3,
  },
  spinnerRow: {
    display: 'flex',
    justifyContent: 'center',
    padding: tokens.spacingVerticalL,
  },
  emptyText: {
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
    padding: tokens.spacingVerticalM,
  },
});

type RepoWithMeta = GitHubRepo & { stargazers_count?: number; updated_at?: string };

function formatDate(iso: string | undefined): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

export const GitHubRepoPicker = createReactComponent(GitHubRepoPickerApi, ({ props }) => {
  const classes = useStyles();
  const connector = useAPIConnector('github') as GitHubConnector | undefined;
  const [query, setQuery] = useState('');
  const [repos, setRepos] = useState<RepoWithMeta[]>(STUB_REPOS);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string>(
    props.selectedRepo ? String(props.selectedRepo) : ''
  );

  // When authenticated, this could load repos from the API. For now uses stub.
  useEffect(() => {
    if (connector?.isAuthenticated()) {
      setLoading(true);
      // Stub — real pagination would go here when B-14 OAuth lands
      setLoading(false);
    }
  }, [connector]);

  const filtered = repos.filter((r) => {
    const q = query.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      (r.description ?? '').toLowerCase().includes(q) ||
      (r.language ?? '').toLowerCase().includes(q)
    );
  });

  const handleSelect = (repo: RepoWithMeta) => {
    setSelected(repo.full_name);
    if (props.onSelect) (props.onSelect as () => void)();
  };

  return (
    <div className={classes.root}>
      <div className={classes.searchRow}>
        <Input
          contentBefore={<Search20Regular />}
          placeholder={
            props.placeholder ? String(props.placeholder) : 'Search repositories…'
          }
          value={query}
          onChange={(_, data) => setQuery(data.value)}
          style={{ width: '100%' }}
        />
      </div>

      {loading ? (
        <div className={classes.spinnerRow}>
          <Spinner size="small" label="Loading repositories…" />
        </div>
      ) : filtered.length === 0 ? (
        <Caption1 className={classes.emptyText}>No repositories found.</Caption1>
      ) : (
        <div className={classes.repoList}>
          {filtered.map((repo) => (
            <Card
              key={repo.id}
              className={selected === repo.full_name ? classes.repoCardSelected : classes.repoCard}
              onClick={() => handleSelect(repo)}
              role="option"
              aria-selected={selected === repo.full_name}
            >
              <CardHeader
                header={<Body2 style={{ fontWeight: 600 }}>{repo.full_name}</Body2>}
                description={
                  repo.description ? (
                    <Caption1>{repo.description}</Caption1>
                  ) : undefined
                }
              />
              <div className={classes.metaRow}>
                {repo.language && (
                  <Badge appearance="outline" color="informative" size="small">
                    {repo.language}
                  </Badge>
                )}
                {repo.private && (
                  <Badge appearance="outline" color="subtle" size="small">
                    Private
                  </Badge>
                )}
                {repo.stargazers_count !== undefined && (
                  <span className={classes.starRow}>
                    <Star20Regular style={{ fontSize: '14px' }} />
                    <Caption1>{repo.stargazers_count}</Caption1>
                  </span>
                )}
                {repo.updated_at && (
                  <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                    Updated {formatDate(repo.updated_at)}
                  </Caption1>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
});
