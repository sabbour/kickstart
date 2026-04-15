import React, { useCallback, useEffect, useState } from "react";
import { createReactComponent } from "../../vendor/a2ui/react/adapter";
import { z } from "zod";
import { DynamicStringSchema, type DynamicString } from "../../vendor/a2ui/web_core/schema/common-types";
import {
  Avatar,
  Body1Strong,
  Body2,
  Button,
  Card,
  CardHeader,
  Caption1,
  MessageBar,
  MessageBarBody,
  Spinner,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useAPIConnector } from "../../contexts/APIConnectorContext";
import {
  getGitHubSession,
  signInWithGitHubPopup,
  signOutGitHub,
  type GitHubSessionState,
} from "../../services/github-handoff";

const AuthCardApi = {
  name: "AuthCard",
  schema: z.object({
    provider: z.enum(["azure", "github"]),
    title: DynamicStringSchema.optional(),
    description: DynamicStringSchema.optional(),
  }).strict(),
};

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalL,
    width: "100%",
  },
  statusDot: {
    width: "8px",
    height: "8px",
    borderRadius: tokens.borderRadiusCircular,
    backgroundColor: tokens.colorPaletteGreenBackground3,
    display: "inline-block",
    marginRight: tokens.spacingHorizontalXS,
  },
  actions: {
    display: "flex",
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalS,
  },
  connectedUser: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    marginTop: tokens.spacingVerticalS,
  },
  userMeta: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXXS,
  },
});

function str(value: DynamicString | null | undefined): string | undefined {
  if (value == null) return undefined;
  return typeof value === "string" ? value : "";
}

const CONNECTOR_NAME: Record<"azure" | "github", string> = {
  azure: "azure-arm",
  github: "github",
};

const DEFAULT_TITLE: Record<"azure" | "github", string> = {
  azure: "Azure",
  github: "GitHub",
};

const DEFAULT_DESCRIPTION: Record<"azure" | "github", string> = {
  azure: "Sign in to access your Azure resources",
  github: "Connect your GitHub account so you can choose an owner and repository for these generated files.",
};

export const AuthCard = createReactComponent(AuthCardApi, ({ props }) => {
  const classes = useStyles();
  const connector = useAPIConnector(CONNECTOR_NAME[props.provider]);

  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(
    () => (props.provider === "github" ? false : connector?.isAuthenticated() ?? false),
  );
  const [error, setError] = useState<string | undefined>();
  const [githubSession, setGitHubSession] = useState<GitHubSessionState | null>(null);
  const [checkingGitHub, setCheckingGitHub] = useState(props.provider === "github");

  const title = str(props.title) || DEFAULT_TITLE[props.provider];
  const description = str(props.description) || DEFAULT_DESCRIPTION[props.provider];

  const refreshGitHubSession = useCallback(async () => {
    setCheckingGitHub(true);
    try {
      const session = await getGitHubSession();
      setGitHubSession(session);
      setAuthenticated(session.authenticated);
      setError(session.error);
    } catch (err) {
      setGitHubSession(null);
      setAuthenticated(false);
      setError(err instanceof Error ? err.message : "Unable to check GitHub sign-in status.");
    } finally {
      setCheckingGitHub(false);
    }
  }, []);

  useEffect(() => {
    if (props.provider === "github") {
      void refreshGitHubSession();
      return;
    }

    setAuthenticated(connector?.isAuthenticated() ?? false);
    setCheckingGitHub(false);
  }, [connector, props.provider, refreshGitHubSession]);

  const handleSignIn = useCallback(async () => {
    setLoading(true);
    setError(undefined);

    try {
      if (props.provider === "github") {
        const session = await signInWithGitHubPopup();
        setGitHubSession(session);
        setAuthenticated(session.authenticated);
        setError(session.error);
      } else if (!connector) {
        setAuthenticated(true);
      } else {
        await connector.authenticate();
        setAuthenticated(connector.isAuthenticated());
      }
    } catch (err) {
      setAuthenticated(false);
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  }, [connector, props.provider]);

  const handleSignOut = useCallback(async () => {
    setLoading(true);
    setError(undefined);

    try {
      if (props.provider === "github") {
        await signOutGitHub();
        setGitHubSession((previous) => previous
          ? { ...previous, authenticated: false, viewer: undefined, owners: [] }
          : null);
      }
      setAuthenticated(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-out failed");
    } finally {
      setLoading(false);
    }
  }, [props.provider]);

  if (authenticated) {
    return (
      <Card className={classes.root}>
        <CardHeader
          header={<Body1Strong>{title}</Body1Strong>}
          description={(
            <Caption1>
              <span className={classes.statusDot} />
              Connected
            </Caption1>
          )}
        />

        {props.provider === "github" && githubSession?.viewer && (
          <div className={classes.connectedUser}>
            <Avatar
              image={{ src: githubSession.viewer.avatarUrl }}
              name={githubSession.viewer.login}
              size={36}
            />
            <div className={classes.userMeta}>
              <Body2 style={{ fontWeight: 600 }}>
                {githubSession.viewer.name || githubSession.viewer.login}
              </Body2>
              <Caption1>
                {githubSession.owners.length} account
                {githubSession.owners.length === 1 ? "" : "s"} available
              </Caption1>
            </div>
          </div>
        )}

        <div className={classes.actions}>
          <Button appearance="subtle" size="small" onClick={() => void handleSignOut()} disabled={loading}>
            Disconnect
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className={classes.root}>
      <CardHeader
        header={<Body1Strong>{title}</Body1Strong>}
        description={<Caption1>{description}</Caption1>}
      />
      {error && (
        <MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}
      <div className={classes.actions}>
        <Button
          appearance="primary"
          onClick={() => void handleSignIn()}
          disabled={loading || checkingGitHub || (props.provider === "github" && githubSession?.configured === false)}
          icon={loading || checkingGitHub ? <Spinner size="tiny" /> : undefined}
        >
          {loading || checkingGitHub
            ? "Checking sign-in…"
            : `Sign in to ${title}`}
        </Button>
      </div>
      {props.provider === "azure" && !connector && (
        <Caption1
          style={{
            color: tokens.colorNeutralForeground3,
            marginTop: tokens.spacingVerticalXS,
          }}
        >
          Running in offline mode — sign-in will use stub data
        </Caption1>
      )}
    </Card>
  );
});
