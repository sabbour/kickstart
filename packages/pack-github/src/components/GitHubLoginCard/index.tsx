import React from 'react';
import { z } from 'zod';
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
} from '@fluentui/react-components';
import type { ComponentContribution } from '@aks-kickstart/harness';

const GitHubLoginCardSchema = z.object({
  status: z.enum(['idle', 'loading', 'success', 'error']).default('idle'),
  username: z.string().optional().describe('GitHub username of the signed-in user'),
  avatarUrl: z.string().optional().describe('Avatar URL of the signed-in user'),
  displayName: z.string().optional().describe('Display name of the signed-in user'),
  errorMessage: z.string().optional(),
  configured: z.boolean().default(true).describe('Whether GitHub OAuth is configured in this environment'),
  isActive: z.boolean().default(true),
});

type GitHubLoginCardProps = z.infer<typeof GitHubLoginCardSchema>;

const useStyles = makeStyles({
  card: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalL,
    width: '100%',
  },
  signedIn: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    marginTop: tokens.spacingVerticalS,
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
  inactive: {
    opacity: 0.6,
    pointerEvents: 'none',
  },
});

export const GitHubLoginCardRenderer: React.FC<{
  props: GitHubLoginCardProps;
  dispatchAction?: (action: unknown) => void;
}> = ({ props, dispatchAction }) => {
  const classes = useStyles();
  const cardClass = props.isActive ? classes.card : `${classes.card} ${classes.inactive}`;

  const isSuccess = props.status === 'success';
  const isLoading = props.status === 'loading';

  if (isSuccess && (props.username || props.displayName)) {
    const name = props.displayName ?? props.username ?? 'GitHub User';
    return (
      <Card className={cardClass}>
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
            image={props.avatarUrl ? { src: props.avatarUrl } : undefined}
            name={name}
            size={36}
          />
          <div className={classes.userInfo}>
            <Body2 style={{ fontWeight: 600 }}>{name}</Body2>
            <Caption1>Signed in via GitHub</Caption1>
            {props.username && <Caption1>@{props.username}</Caption1>}
          </div>
        </div>
        <div className={classes.actions}>
          <Button
            appearance="subtle"
            size="small"
            onClick={() => dispatchAction?.({ event: { name: 'github:sign-out' } })}
          >
            Disconnect
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cardClass}>
      <CardHeader
        header={<Body1Strong>GitHub</Body1Strong>}
        description={<Caption1>Sign in with GitHub to connect your repositories.</Caption1>}
      />
      {isLoading && <Spinner size="small" label="Checking sign-in…" />}
      {props.status === 'error' && props.errorMessage && (
        <MessageBar intent="error">
          <MessageBarBody>{String(props.errorMessage)}</MessageBarBody>
        </MessageBar>
      )}
      {!props.configured && (
        <MessageBar intent="info">
          <MessageBarBody>
            GitHub Sign In is not available in this environment. The GitHub OAuth app has not been configured.
          </MessageBarBody>
        </MessageBar>
      )}
      <div className={classes.actions}>
        <Tooltip
          content="GitHub Sign In is not available in this environment."
          relationship="label"
          positioning="above-start"
          visible={!props.configured ? true : undefined}
        >
          <Button
            appearance="primary"
            disabled={isLoading || !props.configured || !props.isActive}
            icon={isLoading ? <Spinner size="tiny" /> : undefined}
            onClick={() => dispatchAction?.({ event: { name: 'github:sign-in' } })}
          >
            {isLoading ? 'Checking sign-in…' : 'Sign in with GitHub'}
          </Button>
        </Tooltip>
      </div>
    </Card>
  );
};

export const gitHubLoginCardContribution: ComponentContribution = {
  name: 'github/GitHubLoginCard',
  propertySchema: GitHubLoginCardSchema,
  renderer: GitHubLoginCardRenderer,
};
