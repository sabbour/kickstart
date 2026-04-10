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
import type { GitHubConnector, GitHubUser } from '@kickstart/core';

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
  deviceCodeSection: {
    marginTop: tokens.spacingVerticalM,
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    textAlign: 'center',
  },
  userCode: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase600,
    fontWeight: 700 as unknown as string,
    letterSpacing: '0.15em',
    color: tokens.colorBrandForeground1,
    padding: `${tokens.spacingVerticalS} 0`,
    userSelect: 'all',
  },
  tokenInfo: {
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

type LoginPhase = 'idle' | 'awaiting-code' | 'polling' | 'authenticated';

interface DeviceCodeInfo {
  userCode: string;
  verificationUri: string;
}

/** Stub user shown when the connector is unavailable. */
const STUB_USER: GitHubUser = {
  login: 'stub-user',
  avatar_url: 'https://avatars.githubusercontent.com/u/0',
  html_url: 'https://github.com/stub-user',
  name: 'Stub User',
};

export const GitHubLoginCard = createReactComponent(GitHubLoginCardApi, ({ props }) => {
  const classes = useStyles();
  const connector = useAPIConnector('github') as GitHubConnector | undefined;

  const [phase, setPhase] = useState<LoginPhase>(() =>
    connector?.isAuthenticated() ? 'authenticated' : 'idle'
  );
  const [deviceCode, setDeviceCode] = useState<DeviceCodeInfo | null>(null);
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [error, setError] = useState<string | undefined>();
  const [authTime, setAuthTime] = useState<Date | null>(null);

  // Fetch user profile when already authenticated on mount
  const fetchUser = useCallback(async (conn: GitHubConnector) => {
    try {
      const u = await conn.getAuthenticatedUser();
      setUser(u);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    if (connector?.isAuthenticated()) {
      fetchUser(connector);
    }
  }, [connector, fetchUser]);

  const handleSignIn = async () => {
    if (!connector) {
      // Stub mode — simulate sign-in
      setUser(STUB_USER);
      setPhase('authenticated');
      setAuthTime(new Date());
      if (props.onSignIn) (props.onSignIn as () => void)();
      return;
    }

    setError(undefined);
    setPhase('awaiting-code');

    try {
      // Show a simulated device code while the connector authenticates
      setDeviceCode({
        userCode: 'XXXX-XXXX',
        verificationUri: 'https://github.com/login/device',
      });
      setPhase('polling');

      await connector.authenticate();
      const isAuth = connector.isAuthenticated();

      if (isAuth) {
        setPhase('authenticated');
        setAuthTime(new Date());
        await fetchUser(connector);
        if (props.onSignIn) (props.onSignIn as () => void)();
      } else {
        setPhase('idle');
        setError('Authentication was not completed');
      }
    } catch (err) {
      setPhase('idle');
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setDeviceCode(null);
    }
  };

  const handleSignOut = () => {
    setPhase('idle');
    setUser(null);
    setAuthTime(null);
    setDeviceCode(null);
    setError(undefined);
    if (props.onSignOut) (props.onSignOut as () => void)();
  };

  const displayName = user?.login
    ?? (props.username ? String(props.username) : 'GitHub User');
  const avatarSrc = user?.avatar_url
    ?? (props.avatarUrl ? String(props.avatarUrl) : undefined);

  // Authenticated state
  if (phase === 'authenticated') {
    return (
      <Card className={classes.root}>
        <CardHeader
          header={<Body1Strong>GitHub</Body1Strong>}
          description={
            <Caption1>
              <span className={classes.statusDot} />
              Connected
            </Caption1>
          }
        />
        <div className={classes.signedIn}>
          <Avatar
            image={avatarSrc ? { src: avatarSrc } : undefined}
            name={displayName}
            size={36}
          />
          <div className={classes.userInfo}>
            <Body2 style={{ fontWeight: 600 }}>{displayName}</Body2>
            <Caption1>Signed in via GitHub</Caption1>
          </div>
        </div>

        {authTime && (
          <div className={classes.tokenInfo}>
            <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
              Authenticated at {authTime.toLocaleTimeString()}
            </Caption1>
            <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
              Token stored in memory only
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

  // Device code / polling state
  if (phase === 'awaiting-code' || phase === 'polling') {
    return (
      <Card className={classes.root}>
        <CardHeader
          header={<Body1Strong>GitHub</Body1Strong>}
          description={<Caption1>Authenticating via device code flow\u2026</Caption1>}
        />
        <div className={classes.deviceCodeSection}>
          {deviceCode ? (
            <>
              <Caption1>
                Go to{' '}
                <a
                  href={deviceCode.verificationUri}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: tokens.colorBrandForeground1 }}
                >
                  {deviceCode.verificationUri}
                </a>
              </Caption1>
              <div className={classes.userCode}>{deviceCode.userCode}</div>
              <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                Enter this code to complete sign-in
              </Caption1>
            </>
          ) : (
            <Spinner size="small" label="Requesting device code\u2026" />
          )}
        </div>
        {phase === 'polling' && (
          <div className={classes.actions} style={{ justifyContent: 'center' }}>
            <Spinner size="tiny" />
            <Caption1>Waiting for authorization\u2026</Caption1>
          </div>
        )}
        <div className={classes.actions}>
          <Button appearance="subtle" size="small" onClick={handleSignOut}>
            Cancel
          </Button>
        </div>
      </Card>
    );
  }

  // Idle / sign-in state
  return (
    <Card className={classes.root}>
      <CardHeader
        header={<Body1Strong>GitHub</Body1Strong>}
        description={<Caption1>Sign in to connect your repositories</Caption1>}
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
          disabled={phase !== 'idle'}
          icon={phase !== 'idle' ? <Spinner size="tiny" /> : undefined}
        >
          Sign in with GitHub
        </Button>
      </div>
      {!connector && (
        <Caption1 style={{ color: tokens.colorNeutralForeground3, marginTop: tokens.spacingVerticalXS }}>
          Running in offline mode \u2014 sign-in will use stub data
        </Caption1>
      )}
    </Card>
  );
});
