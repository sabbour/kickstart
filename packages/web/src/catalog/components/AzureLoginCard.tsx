import React, { useState } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema, ActionSchema } from '../../vendor/a2ui/web_core/schema/common-types';
import {
  Avatar,
  Body1,
  Body1Strong,
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
import type { AzureARMConnector } from '@kickstart/core';

const AzureLoginCardApi = {
  name: 'AzureLoginCard',
  schema: z.object({
    displayName: DynamicStringSchema.optional(),
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

export const AzureLoginCard = createReactComponent(AzureLoginCardApi, ({ props }) => {
  const classes = useStyles();
  const connector = useAPIConnector('azure-arm') as AzureARMConnector | undefined;
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(() => connector?.isAuthenticated() ?? false);

  const displayName = props.displayName ? String(props.displayName) : 'Azure User';

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
          header={<Body1Strong>Azure</Body1Strong>}
          description={
            <Caption1>
              <span className={classes.statusDot} />
              Connected
            </Caption1>
          }
        />
        <div className={classes.signedIn}>
          <Avatar name={displayName} size={36} color="brand" />
          <div className={classes.userInfo}>
            <Body2 style={{ fontWeight: 600 }}>{displayName}</Body2>
            <Caption1>Signed in to Azure</Caption1>
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
        header={<Body1Strong>Azure</Body1Strong>}
        description={<Caption1>Sign in to access your Azure resources</Caption1>}
      />
      <div className={classes.actions}>
        <Button
          appearance="primary"
          onClick={handleSignIn}
          disabled={loading}
          icon={loading ? <Spinner size="tiny" /> : undefined}
        >
          {loading ? 'Signing in…' : 'Sign in to Azure'}
        </Button>
      </div>
    </Card>
  );
});
