import React, { useState } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema, ActionSchema } from '../../vendor/a2ui/web_core/schema/common-types';
import {
  Avatar,
  Body1,
  Body2,
  Button,
  Card,
  CardHeader,
  Caption1,
  Spinner,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useAPIConnector } from '../../contexts/APIConnectorContext';
import type { GitHubConnector } from '@kickstart/core';

const GitHubLoginCardApi = {
  name: 'GitHubLoginCard',
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
    width: '100%',
  },
  signedIn: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    flex: 1,
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: tokens.borderRadiusCircular,
    backgroundColor: tokens.colorPaletteGreenBackground3,
    display: 'inline-block',
    marginRight: tokens.spacingHorizontalXS,
  },
  actions: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalS,
  },
});

export const GitHubLoginCard = createReactComponent(GitHubLoginCardApi, ({ props }) => {
  const classes = useStyles();
  const connector = useAPIConnector('github') as GitHubConnector | undefined;
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(() => connector?.isAuthenticated() ?? false);

  const handleSignIn = async () => {
    if (!connector) return;
    setLoading(true);
    try {
      await connector.authenticate();
      setAuthenticated(connector.isAuthenticated());
      if (props.onSignIn) (props.onSignIn as () => void)();
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    setAuthenticated(false);
    if (props.onSignOut) (props.onSignOut as () => void)();
  };

  if (authenticated) {
    return (
      <Card className={classes.root}>
        <CardHeader
          header={<Body1 weight="semibold">GitHub</Body1>}
          description={
            <Caption1>
              <span className={classes.statusDot} />
              Connected
            </Caption1>
          }
        />
        <div className={classes.signedIn}>
          <Avatar
            image={props.avatarUrl ? { src: String(props.avatarUrl) } : undefined}
            name={props.username ? String(props.username) : 'GitHub User'}
            size={36}
          />
          <div className={classes.userInfo}>
            <Body2 weight="semibold">{props.username ? String(props.username) : 'GitHub User'}</Body2>
            <Caption1>Signed in via GitHub</Caption1>
          </div>
        </div>
        <div className={classes.actions}>
          <Button appearance="subtle" size="small" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className={classes.root}>
      <CardHeader
        header={<Body1 weight="semibold">GitHub</Body1>}
        description={<Caption1>Sign in to connect your repositories</Caption1>}
      />
      <div className={classes.actions}>
        <Button
          appearance="primary"
          onClick={handleSignIn}
          disabled={loading}
          icon={loading ? <Spinner size="tiny" /> : undefined}
        >
          {loading ? 'Signing in…' : 'Sign in with GitHub'}
        </Button>
      </div>
    </Card>
  );
});
