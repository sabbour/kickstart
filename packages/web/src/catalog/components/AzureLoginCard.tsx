import React, { useCallback, useEffect, useState } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema, ActionSchema } from '../../vendor/a2ui/web_core/schema/common-types';
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
import { useAPIConnector } from '../../contexts/APIConnectorContext';
import type { AzureARMConnector } from '@kickstart/harness';
import type { AzureSubscription } from '../../types';
// TODO(Step 7): playground-auth-stub removed in Step 1 — stubs always return false/undefined
const createAzureStubSession = (_connected: boolean): { configured: boolean; authenticated: boolean; subscriptions: AzureSubscription[] } => ({
  configured: true,
  authenticated: false,
  subscriptions: [],
});
const shouldUsePlaygroundAuthStub = () => false;

const AzureLoginCardApi = {
  name: 'AzureLoginCard',
  schema: z.object({
    displayName: DynamicStringSchema.optional(),
    showTokenInfo: z.boolean().optional(),
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
  subscriptionInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
    marginTop: tokens.spacingVerticalS,
    paddingTop: tokens.spacingVerticalS,
    borderTopWidth: tokens.strokeWidthThin,
    borderTopStyle: 'solid',
    borderTopColor: tokens.colorNeutralStroke2,
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
  const usePlaygroundStub = shouldUsePlaygroundAuthStub();

  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(() => usePlaygroundStub ? false : connector?.isAuthenticated() ?? false);
  const [subscriptions, setSubscriptions] = useState<AzureSubscription[]>([]);
  const [error, setError] = useState<string | undefined>();
  // Track token metadata in React state (per Leela: NOT connector accessor)
  const [authTime, setAuthTime] = useState<Date | null>(null);

  const displayName = props.displayName ? String(props.displayName) : 'Azure User';

  const fetchSubscriptions = useCallback(async (conn: AzureARMConnector) => {
    try {
      const subs = await conn.listSubscriptions();
      setSubscriptions(subs);
    } catch {
      setSubscriptions([]);
    }
  }, []);

  // Fetch subscriptions on mount if already authenticated
  useEffect(() => {
    if (usePlaygroundStub) {
      return;
    }
    if (connector?.isAuthenticated()) {
      fetchSubscriptions(connector);
    }
  }, [connector, fetchSubscriptions, usePlaygroundStub]);

  const handleSignIn = async () => {
    if (usePlaygroundStub || !connector) {
      // Stub mode — show stub subscriptions
      const stubSession = createAzureStubSession(true);
      setAuthenticated(stubSession.authenticated);
      setSubscriptions(stubSession.subscriptions);
      setAuthTime(new Date());
      if (props.onSignIn) (props.onSignIn as () => void)();
      return;
    }

    setLoading(true);
    setError(undefined);
    try {
      await connector.authenticate();
      const isAuth = connector.isAuthenticated();
      setAuthenticated(isAuth);
      if (isAuth) {
        setAuthTime(new Date());
        await fetchSubscriptions(connector);
      }
      if (props.onSignIn) (props.onSignIn as () => void)();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = () => {
    setAuthenticated(false);
    setSubscriptions([]);
    setAuthTime(null);
    setError(undefined);
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

        {subscriptions.length > 0 && (
          <div className={classes.subscriptionInfo}>
            <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
              {subscriptions.length === 1 ? 'Subscription' : `${subscriptions.length} subscriptions available`}
            </Caption1>
            {subscriptions.slice(0, 3).map((sub) => (
              <Caption1 key={sub.subscriptionId}>
                {sub.displayName} ({sub.state})
              </Caption1>
            ))}
            {subscriptions.length > 3 && (
              <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                +{subscriptions.length - 3} more
              </Caption1>
            )}
          </div>
        )}

        {props.showTokenInfo && authTime && (
          <div className={classes.subscriptionInfo}>
            <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
              Authenticated at {authTime.toLocaleTimeString()}
            </Caption1>
          </div>
        )}

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
          {loading ? 'Signing in…' : 'Sign in to Azure'}
        </Button>
      </div>
      {!connector && (
        <Caption1 style={{ color: tokens.colorNeutralForeground3, marginTop: tokens.spacingVerticalXS }}>
          Running in offline mode — sign-in will use stub data
        </Caption1>
      )}
    </Card>
  );
});
