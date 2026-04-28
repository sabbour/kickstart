import React from 'react';
import { z } from 'zod';
import {
  Card,
  CardHeader,
  Text,
  Spinner,
  Button,
  Avatar,
  tokens,
  makeStyles,
} from '@fluentui/react-components';
import type { ComponentContribution } from '@aks-kickstart/harness';
import { useGitHubAuthBridge } from '../../auth-bridge.js';

const LoginSchema = z.object({
  status: z.enum(['idle', 'loading', 'success', 'error']).default('idle'),
  viewerSummary: z
    .object({
      login: z.string(),
      name: z.string().nullable().optional(),
      avatarUrl: z.string().optional(),
    })
    .optional(),
  errorMessage: z.string().optional(),
  reason: z.string().optional(),
  isActive: z.boolean().default(true),
});

type LoginProps = z.infer<typeof LoginSchema>;

const useStyles = makeStyles({
  card: {
    padding: tokens.spacingVerticalM,
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    maxWidth: '400px',
  },
  viewer: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalS,
  },
  inactive: {
    opacity: 0.6,
    pointerEvents: 'none',
  },
});

export const LoginRenderer: React.FC<{ props: LoginProps }> = ({ props }) => {
  const classes = useStyles();
  const containerClass = props.isActive ? classes.card : `${classes.card} ${classes.inactive}`;

  // Live auth state from the injected GitHubAuthBridge (issue #179). Throws
  // fail-fast if the host application forgot to call setGitHubAuthHook().
  const bridge = useGitHubAuthBridge();

  // Bridge wins over server-supplied props for status/viewer when the bridge
  // has loaded a session. Server props remain authoritative when no session
  // is available yet (e.g. playground previews before sign-in).
  const effectiveStatus: LoginProps['status'] = bridge.loading
    ? 'loading'
    : bridge.error
      ? 'error'
      : bridge.authenticated
        ? 'success'
        : props.status;
  const effectiveViewer = bridge.session?.viewer ?? props.viewerSummary;
  const effectiveError = bridge.error ?? props.errorMessage;

  const handleSignIn = React.useCallback(() => {
    void bridge.signIn();
  }, [bridge]);

  return (
    <Card className={containerClass}>
      <CardHeader header={<Text weight="semibold">Sign in to GitHub</Text>} />
      {props.reason && (
        <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
          {String(props.reason)}
        </Text>
      )}
      {effectiveStatus === 'loading' && (
        <Spinner size="small" label="Authenticating with GitHub…" />
      )}
      {effectiveStatus === 'error' && effectiveError && (
        <Text size={200} style={{ color: tokens.colorPaletteRedForeground1 }}>
          {String(effectiveError)}
        </Text>
      )}
      {effectiveStatus === 'success' && effectiveViewer && (
        <div className={classes.viewer}>
          <Avatar
            name={String(effectiveViewer.name ?? effectiveViewer.login)}
            image={effectiveViewer.avatarUrl ? { src: effectiveViewer.avatarUrl } : undefined}
            size={32}
          />
          <Text size={300} weight="semibold">
            {String(effectiveViewer.name ?? effectiveViewer.login)}
          </Text>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            @{String(effectiveViewer.login)}
          </Text>
        </div>
      )}
      {effectiveStatus === 'idle' && props.isActive && (
        <Button appearance="primary" onClick={handleSignIn}>
          Sign in with GitHub
        </Button>
      )}
    </Card>
  );
};

export const loginContribution: ComponentContribution = {
  name: 'github/Login',
  propertySchema: LoginSchema,
  renderer: LoginRenderer,
};
