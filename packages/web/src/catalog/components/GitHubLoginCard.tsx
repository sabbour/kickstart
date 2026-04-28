import React, { useEffect, useRef } from "react";
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
  Tooltip,
  makeStyles,
  tokens,
} from "@fluentui/react-components";
import { useGitHubAuth } from "../../contexts/GitHubAuthContext";
import { usePlaygroundMockMode } from "../../contexts/PlaygroundMockModeContext";


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
  const [usePlaygroundStub] = usePlaygroundMockMode();
  const { session, loading, error, signIn, signOut } = useGitHubAuth();

  // Fire onSignIn callback when session transitions to authenticated.
  const prevAuthenticated = useRef(session?.authenticated ?? false);
  useEffect(() => {
    if (!prevAuthenticated.current && session?.authenticated) {
      if (props.onSignIn) {
        (props.onSignIn as () => void)();
      }
    }
    prevAuthenticated.current = session?.authenticated ?? false;
  }, [session?.authenticated, props.onSignIn]);

  const handleSignIn = async () => {
    await signIn();
  };

  const handleSignOut = async () => {
    await signOut();
    if (props.onSignOut) {
      (props.onSignOut as () => void)();
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
      {!usePlaygroundStub && session?.configured === false && (
        <MessageBar intent="info">
          <MessageBarBody>
            GitHub Sign In is not available in this environment. The GitHub OAuth app has not been configured.
          </MessageBarBody>
        </MessageBar>
      )}
      <div className={classes.actions}>
        <Tooltip
          content="GitHub Sign In is not available in this environment. The GitHub OAuth app has not been configured."
          relationship="label"
          positioning="above-start"
          visible={!usePlaygroundStub && session?.configured === false ? undefined : false}
        >
          <Button
            appearance="primary"
            onClick={() => void handleSignIn()}
            disabled={loading || (!usePlaygroundStub && session?.configured === false)}
            icon={loading ? <Spinner size="tiny" /> : undefined}
          >
            {loading ? "Checking sign-in…" : "Sign in with GitHub"}
          </Button>
        </Tooltip>
      </div>
      {usePlaygroundStub && (
        <Caption1 style={{ color: tokens.colorNeutralForeground3, marginTop: tokens.spacingVerticalXS }}>
          Running in offline mode — sign-in will use stub data
        </Caption1>
      )}
    </Card>
  );
});
