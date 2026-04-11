import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema, ActionSchema } from '../../vendor/a2ui/web_core/schema/common-types';
import { Body2, Button, Caption1, Card, CardHeader, Input, MessageBar, MessageBarBody, Spinner, Badge, makeStyles, shorthands, tokens, } from '@fluentui/react-components';
import { Search20Regular, Star20Regular } from '@fluentui/react-icons';
import { useAPIConnector } from '../../contexts/APIConnectorContext';
const GitHubRepoPickerApi = {
    name: 'GitHubRepoPicker',
    schema: z.object({
        placeholder: DynamicStringSchema.optional(),
        selectedRepo: DynamicStringSchema.optional(),
        onSelect: ActionSchema.optional(),
    }).strict(),
};
/** Stub repos shown when the connector is not authenticated. */
const STUB_REPOS = [
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
const DEBOUNCE_MS = 300;
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
    paginationRow: {
        display: 'flex',
        justifyContent: 'center',
        gap: tokens.spacingHorizontalS,
        marginTop: tokens.spacingVerticalS,
    },
    rateLimitBar: {
        marginBottom: tokens.spacingVerticalS,
    },
});
function formatDate(iso) {
    if (!iso)
        return '';
    try {
        return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }
    catch {
        return iso;
    }
}
export const GitHubRepoPicker = createReactComponent(GitHubRepoPickerApi, ({ props }) => {
    const classes = useStyles();
    const connector = useAPIConnector('github');
    const isAuthenticated = connector?.isAuthenticated() ?? false;
    const [query, setQuery] = useState('');
    const [repos, setRepos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState();
    const [selected, setSelected] = useState(props.selectedRepo ? String(props.selectedRepo) : '');
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [rateLimitWarning, setRateLimitWarning] = useState();
    const debounceRef = useRef(null);
    const PER_PAGE = 20;
    const fetchRepos = useCallback(async (pageNum) => {
        if (!connector || !isAuthenticated) {
            setRepos(STUB_REPOS);
            return;
        }
        setLoading(true);
        setError(undefined);
        setRateLimitWarning(undefined);
        try {
            const results = await connector.listUserRepos(pageNum, PER_PAGE);
            setRepos(results);
            setHasMore(results.length === PER_PAGE);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : 'Failed to load repositories';
            if (message.includes('rate limit') || message.includes('403')) {
                setRateLimitWarning('GitHub API rate limit reached. Please wait before trying again.');
            }
            setError(message);
            setRepos(STUB_REPOS);
        }
        finally {
            setLoading(false);
        }
    }, [connector, isAuthenticated]);
    // Load repos on mount
    useEffect(() => {
        fetchRepos(1);
    }, [fetchRepos]);
    // Debounced search filter
    useEffect(() => {
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }
        debounceRef.current = setTimeout(() => {
            if (page !== 1)
                setPage(1);
        }, DEBOUNCE_MS);
        return () => {
            if (debounceRef.current)
                clearTimeout(debounceRef.current);
        };
    }, [query]);
    const handlePageChange = (newPage) => {
        setPage(newPage);
        fetchRepos(newPage);
    };
    const filtered = repos.filter((r) => {
        if (!query)
            return true;
        const q = query.toLowerCase();
        return (r.name.toLowerCase().includes(q) ||
            (r.description ?? '').toLowerCase().includes(q) ||
            (r.language ?? '').toLowerCase().includes(q) ||
            r.full_name.toLowerCase().includes(q));
    });
    const handleSelect = (repo) => {
        setSelected(repo.full_name);
        if (props.onSelect)
            props.onSelect();
    };
    return (<div className={classes.root}>
      {rateLimitWarning && (<MessageBar intent="warning" className={classes.rateLimitBar}>
          <MessageBarBody>{rateLimitWarning}</MessageBarBody>
        </MessageBar>)}

      <div className={classes.searchRow}>
        <Input contentBefore={<Search20Regular />} placeholder={props.placeholder ? String(props.placeholder) : 'Search repositories\u2026'} value={query} onChange={(_, data) => setQuery(data.value)} style={{ width: '100%' }}/>
      </div>

      {error && !rateLimitWarning && (<MessageBar intent="error" style={{ marginBottom: tokens.spacingVerticalS }}>
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>)}

      {loading ? (<div className={classes.spinnerRow}>
          <Spinner size="small" label="Loading repositories\u2026"/>
        </div>) : filtered.length === 0 ? (<Caption1 className={classes.emptyText}>No repositories found.</Caption1>) : (<>
          <div className={classes.repoList}>
            {filtered.map((repo) => (<Card key={repo.id} className={selected === repo.full_name ? classes.repoCardSelected : classes.repoCard} onClick={() => handleSelect(repo)} role="option" aria-selected={selected === repo.full_name}>
                <CardHeader header={<Body2 style={{ fontWeight: 600 }}>{repo.full_name}</Body2>} description={repo.description ? (<Caption1>{repo.description}</Caption1>) : undefined}/>
                <div className={classes.metaRow}>
                  {repo.language && (<Badge appearance="outline" color="informative" size="small">
                      {repo.language}
                    </Badge>)}
                  {repo.private && (<Badge appearance="outline" color="subtle" size="small">
                      Private
                    </Badge>)}
                  {repo.stargazers_count !== undefined && (<span className={classes.starRow}>
                      <Star20Regular style={{ fontSize: '14px' }}/>
                      <Caption1>{repo.stargazers_count}</Caption1>
                    </span>)}
                  {repo.updated_at && (<Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                      Updated {formatDate(repo.updated_at)}
                    </Caption1>)}
                </div>
              </Card>))}
          </div>

          {/* Pagination controls */}
          {isAuthenticated && (<div className={classes.paginationRow}>
              <Button appearance="subtle" size="small" disabled={page <= 1} onClick={() => handlePageChange(page - 1)}>
                \u2190 Previous
              </Button>
              <Caption1 style={{ alignSelf: 'center' }}>Page {page}</Caption1>
              <Button appearance="subtle" size="small" disabled={!hasMore} onClick={() => handlePageChange(page + 1)}>
                Next \u2192
              </Button>
            </div>)}
        </>)}

      {!isAuthenticated && (<Caption1 style={{ color: tokens.colorNeutralForeground3, textAlign: 'center', display: 'block', marginTop: tokens.spacingVerticalS }}>
          Sign in to GitHub to see your repositories
        </Caption1>)}
    </div>);
});
//# sourceMappingURL=GitHubRepoPicker.js.map