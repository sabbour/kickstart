import React, { useCallback, useEffect, useState } from "react";
import { createReactComponent } from "../../vendor/a2ui/react/adapter";
import { z } from "zod";
import { DynamicStringSchema, ActionSchema } from "../../vendor/a2ui/web_core/schema/common-types";
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
import {
  getGitHubSession,
  signInWithGitHubPopup,
  signOutGitHub,
  type GitHubSessionState,
} from "../../services/github-handoff";
import {
  createGitHubStubSession,
  shouldUsePlaygroundAuthStub,
} from "../../services/playground-auth-stub";

const GitHubLoginCardApi = {
  name: "GitHubLoginCard",
  schema: z.object({
    username: DynamicStringSchema.optional(),
    avatarUrl: DynamicStringSchema.optional(),
    onSignIn: ActionSchema.optional(),
    onSignOut: ActionSchema.optional(),
  }).strict(),
};

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalL,
    width: "100%",
  },
  signedIn: {
    display: "flex",
    alignItems: "center",
    gap: tokens.spacingHorizontalM,
    marginTop: tokens.spacingVerticalS,
  },
  userInfo: {
    display: "flex",
    flexDirection: "column",
    gap: tokens.spacingVerticalXS,
    flex: 1,
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
});

export const GitHubLoginCard = createReactComponent(GitHubLoginCardApi, ({ props }) => {
  const classes = useStyles();
  const usePlaygroundStub = shouldUsePlaygroundAuthStub();

  const [session, setSession] = useState<GitHubSessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  const refreshSession = useCallback(async () => {
    if (usePlaygroundStub) {
      setSession(createGitHubStubSession(false));
      setError(undefined);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const nextSession = await getGitHubSession();
      setSession(nextSession);
      setError(nextSession.error);
    } catch (err) {
      setSession(null);
      setError(err instanceof Error ? err.message : "Unable to load GitHub sign-in status.");
    } finally {
      setLoading(false);
    }
  }, [usePlaygroundStub]);

  useEffect(() => {
    void refreshSession();
  }, [refreshSession]);

  const handleSignIn = async () => {
    if (usePlaygroundStub) {
      setSession(createGitHubStubSession(true));
      setError(undefined);
      setLoading(false);
      if (props.onSignIn) {
        (props.onSignIn as () => void)();
      }
      return;
    }

    setLoading(true);
    setError(undefined);
    try {
      const nextSession = await signInWithGitHubPopup();
      setSession(nextSession);
      setError(nextSession.error);
      if (nextSession.authenticated && props.onSignIn) {
        (props.onSignIn as () => void)();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    if (usePlaygroundStub) {
      setSession(createGitHubStubSession(false));
      setError(undefined);
      setLoading(false);
      if (props.onSignOut) {
        (props.onSignOut as () => void)();
      }
      return;
    }

    setLoading(true);
    setError(undefined);
    try {
      await signOutGitHub();
      setSession({
        authenticated: false,
        configured: session?.configured ?? true,
        owners: [],
      });
      if (props.onSignOut) {
        (props.onSignOut as () => void)();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-out failed");
    } finally {
      setLoading(false);
    }
  };

  if (session?.authenticated && session.viewer) {
    return (
      <Card className={classes.root}>
        <CardHeader
          header={<Body1Strong>GitHub</Body1Strong>}
          description={(
            <Caption1>
              <span className={classes.statusDot} />
              Connected
            </Caption1>
          )}
        />
        <div className={classes.signedIn}>
          <Avatar
            image={{ src: session.viewer.avatarUrl }}
            name={session.viewer.login}
            size={36}
          />
          <div className={classes.userInfo}>
            <Body2 style={{ fontWeight: 600 }}>
              {session.viewer.name || session.viewer.login}
            </Body2>
            <Caption1>Signed in via GitHub</Caption1>
            <Caption1>{session.viewer.login}</Caption1>
          </div>
        </div>

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
        header={<Body1Strong>GitHub</Body1Strong>}
        description={<Caption1>Sign in with GitHub to connect your repositories.</Caption1>}
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
          disabled={loading || (!usePlaygroundStub && session?.configured === false)}
          icon={loading ? <Spinner size="tiny" /> : undefined}
        >
          {loading ? "Checking sign-in…" : "Sign in with GitHub"}
        </Button>
      </div>
    </Card>
  );
});
