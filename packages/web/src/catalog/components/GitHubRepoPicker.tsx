import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createReactComponent } from "../../vendor/a2ui/react/adapter";
import { z } from "zod";
import { DynamicStringSchema, ActionSchema } from "../../vendor/a2ui/web_core/schema/common-types";
import {
  Badge,
  Body2,
  Button,
  Caption1,
  Card,
  CardHeader,
  Checkbox,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Select,
  Spinner,
  makeStyles,
  shorthands,
  tokens,
} from "@fluentui/react-components";
import { Search20Regular, Star20Regular } from "@fluentui/react-icons";
import type { GitHubRepo } from "@aks-kickstart/harness";
import {
  createGitHubRepo,
  listGitHubRepos,
} from "../../services/github-handoff";
import { usePlaygroundMockMode } from "../../contexts/PlaygroundMockModeContext";
import { useGitHubAuth } from "../../contexts/GitHubAuthContext";

const createGitHubStubRepo = (args: { owner: string; name: string; description?: string; private?: boolean }): GitHubRepo => ({
  name: args.name,
  full_name: `${args.owner}/${args.name}`,
  owner: { login: args.owner },
  description: args.description ?? null,
  private: args.private,
  default_branch: 'main',
});
const DEFAULT_GITHUB_MOCK_OWNER = 'kickstart-mock';
const listGitHubStubRepos = (owner: string): GitHubRepo[] => [
  createGitHubStubRepo({
    owner,
    name: 'kickstart-sample',
    description: 'Mock repository for testing the playground flow',
    private: false,
  }),
  {
    ...createGitHubStubRepo({
      owner,
      name: 'private-deployments',
      description: 'Mock private deployment repo',
      private: true,
    }),
    language: 'TypeScript',
    stargazers_count: 3,
    updated_at: '2026-04-26T19:00:00Z',
  },
];
import { sanitizeActionContext } from "../../utils/sanitize-action-context";

const GitHubRepoPickerApi = {
  name: "GitHubRepoPicker",
  schema: z.object({
    placeholder: DynamicStringSchema.optional(),
    owner: DynamicStringSchema.optional(),
    selectedRepo: DynamicStringSchema.optional(),
    suggestedName: DynamicStringSchema.optional(),
    allowCreate: z.boolean().optional(),
    onSelect: ActionSchema.optional(),
  }).strict(),
};

const DEBOUNCE_MS = 250;
const PER_PAGE = 20;

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    width: "100%",
  },
  controlsColumn: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
  },
  modeRow: {
    display: "flex",
    gap: tokens.spacingHorizontalS,
    flexWrap: "wrap",
  },
  repoList: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
  },
  repoCard: {
    cursor: "pointer",
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    width: "100%",
  },
  repoCardSelected: {
    cursor: "pointer",
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    width: "100%",
    ...shorthands.borderColor(tokens.colorBrandStroke1),
    ...shorthands.borderWidth(tokens.strokeWidthThick),
  },
  metaRow: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalXXS,
    flexWrap: "wrap",
  },
  starRow: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalXS,
    color: tokens.colorNeutralForeground3,
  },
  spinnerRow: {
    display: "flex",
    justifyContent: "center",
    padding: tokens.spacingVerticalL,
  },
  emptyText: {
    textAlign: "center",
    color: tokens.colorNeutralForeground3,
    padding: tokens.spacingVerticalM,
  },
  paginationRow: {
    display: "flex",
    justifyContent: "center",
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalS,
  },
  createForm: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalS,
  },
});

function formatDate(iso: string | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function repoParts(fullName: string): { owner: string; repo: string } {
  const [owner = "", repo = ""] = fullName.split("/", 2);
  return { owner, repo };
}

export const GitHubRepoPicker = createReactComponent(GitHubRepoPickerApi, ({ props, context }) => {
  const classes = useStyles();
  const allowCreate = props.allowCreate !== false;
  const [usePlaygroundStub] = usePlaygroundMockMode();

  const { session, loading: authLoading } = useGitHubAuth();

  const [query, setQuery] = useState("");
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [selectedOwner, setSelectedOwner] = useState(props.owner ? String(props.owner) : "");
  const [selectedRepo, setSelectedRepo] = useState(
    props.selectedRepo ? String(props.selectedRepo) : "",
  );
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [mode, setMode] = useState<"existing" | "create">(
    allowCreate && props.suggestedName ? "create" : "existing",
  );
  const [createName, setCreateName] = useState(props.suggestedName ? String(props.suggestedName) : "");
  const [createDescription, setCreateDescription] = useState("");
  const [createPrivate, setCreatePrivate] = useState(false);

  // Seed selectedOwner from context session once it loads.
  useEffect(() => {
    if (!session?.authenticated) return;
    setSelectedOwner((current) => {
      if (current) return current;
      return usePlaygroundStub ? DEFAULT_GITHUB_MOCK_OWNER : (session.owners[0]?.login ?? "");
    });
  }, [session, usePlaygroundStub]);

  const fetchRepos = useCallback(async (owner: string, pageNumber: number) => {
    if (usePlaygroundStub) {
      const nextRepos = listGitHubStubRepos(owner);
      const pageStart = (pageNumber - 1) * PER_PAGE;
      const pageRepos = nextRepos.slice(pageStart, pageStart + PER_PAGE);
      setRepos(pageRepos);
      setHasMore(pageStart + PER_PAGE < nextRepos.length);
      setError(undefined);
      setLoadingRepos(false);
      return;
    }

    setLoadingRepos(true);
    try {
      const nextRepos = await listGitHubRepos(owner, pageNumber, PER_PAGE);
      setRepos(nextRepos);
      setHasMore(nextRepos.length === PER_PAGE);
      setError(undefined);
    } catch (err) {
      setRepos([]);
      setHasMore(false);
      setError(err instanceof Error ? err.message : "Unable to load repositories.");
    } finally {
      setLoadingRepos(false);
    }
  }, [usePlaygroundStub]);

  useEffect(() => {
    if (!session?.authenticated || !selectedOwner || mode !== "existing") {
      return;
    }

    const timeout = window.setTimeout(() => {
      void fetchRepos(selectedOwner, page);
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [fetchRepos, mode, page, selectedOwner, session?.authenticated]);

  const filteredRepos = useMemo(() => repos.filter((repo) => {
    if (!query) return true;
    const lowerQuery = query.toLowerCase();
    return (
      repo.name.toLowerCase().includes(lowerQuery)
      || repo.full_name.toLowerCase().includes(lowerQuery)
      || (repo.description ?? "").toLowerCase().includes(lowerQuery)
      || (repo.language ?? "").toLowerCase().includes(lowerQuery)
    );
  }), [query, repos]);

  const dispatchSelection = useCallback((repo: GitHubRepo) => {
    const parts = repoParts(repo.full_name);
    const rawAction = context.componentModel.properties.onSelect;

    if (rawAction && typeof rawAction === "object" && "event" in rawAction && rawAction.event) {
      const resolved = context.dataContext.resolveAction(rawAction);
      const safeContext = sanitizeActionContext(resolved.event.context);
      context.dispatchAction({
        event: {
          ...resolved.event,
          context: {
            ...safeContext,
            value: repo.full_name,
            selectedValue: repo.full_name,
            selectedLabel: repo.full_name,
            owner: parts.owner,
            repo: parts.repo,
            name: repo.name,
            visibility: repo.private ? "private" : "public",
          },
        },
      });
      return;
    }

    if (props.onSelect) {
      (props.onSelect as () => void)();
    }
  }, [context, props.onSelect]);

  const handleSelect = (repo: GitHubRepo) => {
    setSelectedRepo(repo.full_name);
    dispatchSelection(repo);
  };

  const handleCreateRepo = async () => {
    if (!selectedOwner) {
      setError("Choose a GitHub owner before creating a repository.");
      return;
    }

    if (!createName.trim()) {
      setError("Repository name is required.");
      return;
    }

    setCreating(true);
    try {
      const createdRepo = usePlaygroundStub
        ? createGitHubStubRepo({
            owner: selectedOwner || DEFAULT_GITHUB_MOCK_OWNER,
            name: createName.trim(),
            description: createDescription.trim() || undefined,
            private: createPrivate,
          })
        : await createGitHubRepo({
            owner: selectedOwner,
            name: createName.trim(),
            description: createDescription.trim() || undefined,
            private: createPrivate,
          });
      setRepos((previous) => [createdRepo, ...previous.filter((repo) => repo.full_name !== createdRepo.full_name)]);
      setSelectedRepo(createdRepo.full_name);
      setMode("existing");
      setPage(1);
      setQuery("");
      setError(undefined);
      dispatchSelection(createdRepo);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create the repository.");
    } finally {
      setCreating(false);
    }
  };

  const ownerOptions = session?.owners ?? [];

  if (authLoading) {
    return (
      <div className={classes.spinnerRow}>
        <Spinner size="small" label="Checking GitHub access…" />
      </div>
    );
  }

  if (!session?.authenticated) {
    return (
      <div className={classes.root}>
        <MessageBar intent="warning">
          <MessageBarBody>
            {error || "Sign in to GitHub before choosing or creating a repository."}
          </MessageBarBody>
        </MessageBar>
      </div>
    );
  }

  return (
    <div className={classes.root}>
      {error && (
        <MessageBar intent="error" style={{ marginBottom: tokens.spacingVerticalS }}>
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}

      <div className={classes.controlsColumn}>
        <Field label="Repository owner">
          <Select
            value={selectedOwner}
            onChange={(_, data) => {
              setSelectedOwner(data.value);
              setSelectedRepo("");
              setPage(1);
            }}
          >
            {ownerOptions.map((owner) => (
              <option key={owner.login} value={owner.login}>
                {owner.label}
              </option>
            ))}
          </Select>
        </Field>

        {allowCreate && (
          <div className={classes.modeRow}>
            <Button
              appearance={mode === "existing" ? "primary" : "secondary"}
              onClick={() => setMode("existing")}
            >
              Use existing repository
            </Button>
            <Button
              appearance={mode === "create" ? "primary" : "secondary"}
              onClick={() => setMode("create")}
            >
              Create new repository
            </Button>
          </div>
        )}
      </div>

      {mode === "create" ? (
        <div className={classes.createForm}>
          <Field label="Repository name" required>
            <Input
              value={createName}
              onChange={(_, data) => setCreateName(data.value)}
              placeholder="my-kickstart-app"
            />
          </Field>
          <Field label="Description">
            <Input
              value={createDescription}
              onChange={(_, data) => setCreateDescription(data.value)}
              placeholder="Optional repository description"
            />
          </Field>
          <Checkbox
            checked={createPrivate}
            label="Create as a private repository"
            onChange={(_, data) => setCreatePrivate(Boolean(data.checked))}
          />
          <div className={classes.modeRow}>
            <Button appearance="primary" onClick={() => void handleCreateRepo()} disabled={creating}>
              {creating ? "Creating repository…" : "Create repository"}
            </Button>
            <Button appearance="subtle" onClick={() => setMode("existing")} disabled={creating}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: tokens.spacingVerticalS }}>
            <Input
              contentBefore={<Search20Regular />}
              placeholder={props.placeholder ? String(props.placeholder) : "Search repositories…"}
              value={query}
              onChange={(_, data) => setQuery(data.value)}
              style={{ width: "100%" }}
            />
          </div>

          {loadingRepos ? (
            <div className={classes.spinnerRow}>
              <Spinner size="small" label="Loading repositories…" />
            </div>
          ) : filteredRepos.length === 0 ? (
            <Caption1 className={classes.emptyText}>No repositories found.</Caption1>
          ) : (
            <>
              <div className={classes.repoList}>
                {filteredRepos.map((repo) => (
                  <Card
                    key={repo.id}
                    className={selectedRepo === repo.full_name ? classes.repoCardSelected : classes.repoCard}
                    onClick={() => handleSelect(repo)}
                    role="option"
                    aria-selected={selectedRepo === repo.full_name}
                  >
                    <CardHeader
                      header={<Body2 style={{ fontWeight: 600 }}>{repo.full_name}</Body2>}
                      description={repo.description ? <Caption1>{repo.description}</Caption1> : undefined}
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
                          <Star20Regular style={{ fontSize: "14px" }} />
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

              <div className={classes.paginationRow}>
                <Button
                  appearance="subtle"
                  size="small"
                  disabled={page <= 1}
                  onClick={() => setPage((current) => current - 1)}
                >
                  ← Previous
                </Button>
                <Caption1 style={{ alignSelf: "center" }}>Page {page}</Caption1>
                <Button
                  appearance="subtle"
                  size="small"
                  disabled={!hasMore}
                  onClick={() => setPage((current) => current + 1)}
                >
                  Next →
                </Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
});
