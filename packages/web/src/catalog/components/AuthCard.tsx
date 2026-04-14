import React, { useState, useCallback, useEffect } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema, type DynamicString } from '../../vendor/a2ui/web_core/schema/common-types';
import {
  Body1Strong,
  Button,
  Card,
  CardHeader,
  Caption1,
  MessageBar,
  MessageBarBody,
  Spinner,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useAPIConnector } from '../../contexts/APIConnectorContext';

const AuthCardApi = {
  name: 'AuthCard',
  schema: z.object({
    provider: z.enum(['azure', 'github']),
    title: DynamicStringSchema.optional(),
    description: DynamicStringSchema.optional(),
  }).strict(),
};

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalL,
    width: '100%',
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

function str(value: DynamicString | null | undefined): string | undefined {
  if (value == null) return undefined;
  return typeof value === 'string' ? value : '';
}

const CONNECTOR_NAME: Record<string, string> = {
  azure: 'azure-arm',
  github: 'github',
};

const DEFAULT_TITLE: Record<string, string> = {
  azure: 'Azure',
  github: 'GitHub',
};

const DEFAULT_DESCRIPTION: Record<string, string> = {
  azure: 'Sign in to access your Azure resources',
  github: 'Sign in to connect your repositories',
};

export const AuthCard = createReactComponent(AuthCardApi, ({ props }) => {
  const classes = useStyles();
  const connectorName = CONNECTOR_NAME[props.provider];
  const connector = useAPIConnector(connectorName);

  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(
    () => connector?.isAuthenticated() ?? false,
  );
  const [error, setError] = useState<string | undefined>();

  const title = str(props.title) || DEFAULT_TITLE[props.provider];
  const description =
    str(props.description) || DEFAULT_DESCRIPTION[props.provider];

  useEffect(() => {
    setAuthenticated(connector?.isAuthenticated() ?? false);
  }, [connector]);

  const handleSignIn = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    try {
      if (!connector) {
        // Stub mode — simulate sign-in
        setAuthenticated(true);
        return;
      }
      await connector.authenticate();
      setAuthenticated(connector.isAuthenticated());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  }, [connector]);

  const handleSignOut = useCallback(() => {
    setAuthenticated(false);
    setError(undefined);
  }, []);

  if (authenticated) {
    return (
      <Card className={classes.root}>
        <CardHeader
          header={<Body1Strong>{title}</Body1Strong>}
          description={
            <Caption1>
              <span className={classes.statusDot} />
              Connected
            </Caption1>
          }
        />
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
          onClick={handleSignIn}
          disabled={loading}
          icon={loading ? <Spinner size="tiny" /> : undefined}
        >
          {loading ? 'Signing in\u2026' : `Sign in to ${title}`}
        </Button>
      </div>
      {!connector && (
        <Caption1
          style={{
            color: tokens.colorNeutralForeground3,
            marginTop: tokens.spacingVerticalXS,
          }}
        >
          Running in offline mode &mdash; sign-in will use stub data
        </Caption1>
      )}
    </Card>
  );
});
