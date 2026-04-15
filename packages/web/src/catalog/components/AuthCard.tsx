import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema, type DynamicString } from '../../vendor/a2ui/web_core/schema/common-types';
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
} from '@fluentui/react-components';
import {
  getGitHubSession,
  signInWithGitHubPopup,
  signOutGitHub,
  type GitHubSessionState,
} from '../../services/github-handoff';
import {
  getAzureSession,
  redirectToAzureSignIn,
  redirectToAzureSignOut,
  type AzureAuthSessionState,
} from '../../services/azure-auth';

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
  connectedUser: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    marginTop: tokens.spacingVerticalS,
  },
  userMeta: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
  },
});

function str(value: DynamicString | null | undefined): string | undefined {
  if (value == null) return undefined;
  return typeof value === 'string' ? value : '';
}

const DEFAULT_TITLE: Record<'azure' | 'github', string> = {
  azure: 'Azure',
  github: 'GitHub',
};

const DEFAULT_DESCRIPTION: Record<'azure' | 'github', string> = {
  azure: 'Continue with your existing Microsoft Entra session to unlock Azure deployment.',
  github: 'Connect your GitHub account so you can choose an owner and repository for these generated files.',
};

export const AuthCard = createReactComponent(AuthCardApi, ({ props, context }) => {
  const classes = useStyles();
  const azureContinuationRef = useRef<string | undefined>(undefined);

  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [githubSession, setGitHubSession] = useState<GitHubSessionState | null>(null);
  const [azureSession, setAzureSession] = useState<AzureAuthSessionState | null>(null);
  const [checking, setChecking] = useState(true);

  const title = str(props.title) || DEFAULT_TITLE[props.provider];
  const description = str(props.description) || DEFAULT_DESCRIPTION[props.provider];

  const refreshGitHubSession = useCallback(async () => {
    setChecking(true);
    try {
      const session = await getGitHubSession();
      setGitHubSession(session);
      setAuthenticated(session.authenticated);
      setError(session.error);
    } catch (err) {
      setGitHubSession(null);
      setAuthenticated(false);
      setError(err instanceof Error ? err.message : 'Unable to check GitHub sign-in status.');
    } finally {
      setChecking(false);
    }
  }, []);

  const refreshAzureSession = useCallback(async () => {
    setChecking(true);
    try {
      const session = await getAzureSession();
      setAzureSession(session);
      setAuthenticated(session.authenticated);
      setError(session.error);
    } catch (err) {
      setAzureSession(null);
      setAuthenticated(false);
      setError(err instanceof Error ? err.message : 'Unable to check Azure sign-in status.');
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    if (props.provider === 'github') {
      void refreshGitHubSession();
      return;
    }

    void refreshAzureSession();
  }, [props.provider, refreshAzureSession, refreshGitHubSession]);

  const handleAzureContinue = useCallback((session: AzureAuthSessionState) => {
    if (!session.authenticated) return;

    context.dispatchAction({
      event: {
        name: 'continue:azure-auth-complete',
        context: {
          provider: 'azure',
          displayName: session.user?.name ?? session.user?.username ?? 'Azure user',
          tenantId: session.user?.tenantId,
          subscriptionCount: session.subscriptions.length,
        },
      },
    });
  }, [context]);

  useEffect(() => {
    if (props.provider !== 'azure') {
      azureContinuationRef.current = undefined;
      return;
    }

    if (!azureSession?.authenticated) {
      azureContinuationRef.current = undefined;
      return;
    }

    const continuationKey = `${azureSession.user?.username ?? azureSession.user?.name ?? 'azure-user'}:${azureSession.user?.tenantId ?? 'unknown-tenant'}`;
    if (azureContinuationRef.current === continuationKey) {
      return;
    }

    azureContinuationRef.current = continuationKey;
    handleAzureContinue(azureSession);
  }, [azureSession, handleAzureContinue, props.provider]);

  const handleSignIn = useCallback(async () => {
    if (props.provider === 'azure') {
      redirectToAzureSignIn();
      return;
    }

    setLoading(true);
    setError(undefined);

    try {
      const session = await signInWithGitHubPopup();
      setGitHubSession(session);
      setAuthenticated(session.authenticated);
      setError(session.error);
    } catch (err) {
      setAuthenticated(false);
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  }, [props.provider]);

  const handleSignOut = useCallback(async () => {
    if (props.provider === 'azure') {
      redirectToAzureSignOut();
      return;
    }

    setLoading(true);
    setError(undefined);

    try {
      await signOutGitHub();
      setGitHubSession((previous) => previous
        ? { ...previous, authenticated: false, viewer: undefined, owners: [] }
        : null);
      setAuthenticated(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-out failed');
    } finally {
      setLoading(false);
    }
  }, [props.provider]);

  const summary = useMemo(() => {
    if (props.provider === 'azure') {
      const subscriptionCount = azureSession?.subscriptions.length ?? 0;
      return {
        name: azureSession?.user?.name || azureSession?.user?.username || 'Azure account',
        caption: subscriptionCount > 0
          ? `${subscriptionCount} subscription${subscriptionCount === 1 ? '' : 's'} available`
          : 'Microsoft Entra session ready',
        avatarImage: undefined,
      };
    }

    return {
      name: githubSession?.viewer?.name || githubSession?.viewer?.login || 'GitHub account',
      caption: `${githubSession?.owners.length ?? 0} account${githubSession?.owners.length === 1 ? '' : 's'} available`,
      avatarImage: githubSession?.viewer?.avatarUrl,
    };
  }, [azureSession, githubSession, props.provider]);

  const signInDisabled = loading
    || checking
    || (props.provider === 'github' && githubSession?.configured === false)
    || (props.provider === 'azure' && azureSession?.configured === false);

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

        <div className={classes.connectedUser}>
          <Avatar
            image={summary.avatarImage ? { src: summary.avatarImage } : undefined}
            name={summary.name}
            size={36}
            color={props.provider === 'azure' ? 'brand' : undefined}
          />
          <div className={classes.userMeta}>
            <Body2 style={{ fontWeight: 600 }}>
              {summary.name}
            </Body2>
            <Caption1>{summary.caption}</Caption1>
          </div>
        </div>

        <div className={classes.actions}>
          <Button appearance="subtle" size="small" onClick={() => void handleSignOut()} disabled={loading}>
            {props.provider === 'azure' ? 'Sign out' : 'Disconnect'}
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
          disabled={signInDisabled}
          icon={loading || checking ? <Spinner size="tiny" /> : undefined}
        >
          {loading || checking
            ? 'Checking sign-in…'
            : props.provider === 'azure'
              ? 'Continue with Microsoft'
              : `Sign in to ${title}`}
        </Button>
      </div>
      {props.provider === 'azure' && azureSession?.configured === false && (
        <Caption1
          style={{
            color: tokens.colorNeutralForeground3,
            marginTop: tokens.spacingVerticalXS,
          }}
        >
          Azure sign-in is only available in the deployed app with Static Web Apps auth enabled.
        </Caption1>
      )}
    </Card>
  );
});
