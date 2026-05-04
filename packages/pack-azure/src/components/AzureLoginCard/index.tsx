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
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import type { ComponentContribution } from '@aks-kickstart/harness';

const AzureSubscriptionSchema = z.object({
  subscriptionId: z.string(),
  displayName: z.string(),
  state: z.string().optional(),
  tenantId: z.string().optional(),
});

const AzureLoginCardSchema = z.object({
  status: z.enum(['idle', 'loading', 'success', 'error']).default('idle'),
  displayName: z.string().optional().describe('Name of the signed-in user'),
  subscriptions: z.array(AzureSubscriptionSchema).optional(),
  errorMessage: z.string().optional(),
  configured: z.boolean().default(true).describe('Whether Azure auth is configured in this environment'),
  isActive: z.boolean().default(true),
  showTokenInfo: z.boolean().optional(),
});

type AzureLoginCardProps = z.infer<typeof AzureLoginCardSchema>;

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
  inactive: {
    opacity: 0.6,
    pointerEvents: 'none',
  },
});

export const AzureLoginCardRenderer: React.FC<{
  props: AzureLoginCardProps;
  dispatchAction?: (action: unknown) => void;
}> = ({ props, dispatchAction }) => {
  const classes = useStyles();
  const cardClass = props.isActive ? classes.card : `${classes.card} ${classes.inactive}`;

  const isSuccess = props.status === 'success';
  const isLoading = props.status === 'loading';
  const displayName = props.displayName ?? 'Azure User';

  if (isSuccess) {
    return (
      <Card className={cardClass}>
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

        {props.subscriptions && props.subscriptions.length > 0 && (
          <div className={classes.subscriptionInfo}>
            <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
              {props.subscriptions.length === 1
                ? 'Subscription'
                : `${props.subscriptions.length} subscriptions available`}
            </Caption1>
            {props.subscriptions.slice(0, 3).map((sub) => (
              <Caption1 key={sub.subscriptionId}>
                {String(sub.displayName)}
                {sub.state ? ` (${String(sub.state)})` : ''}
              </Caption1>
            ))}
            {props.subscriptions.length > 3 && (
              <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                +{props.subscriptions.length - 3} more
              </Caption1>
            )}
          </div>
        )}

        <div className={classes.actions}>
          <Button
            appearance="subtle"
            size="small"
            onClick={() => dispatchAction?.({ event: { name: 'azure:sign-out' } })}
          >
            Sign out
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cardClass}>
      <CardHeader
        header={<Body1Strong>Azure</Body1Strong>}
        description={<Caption1>Sign in to access your Azure resources</Caption1>}
      />
      {isLoading && <Spinner size="small" label="Signing in…" />}
      {props.status === 'error' && props.errorMessage && (
        <MessageBar intent="error">
          <MessageBarBody>{String(props.errorMessage)}</MessageBarBody>
        </MessageBar>
      )}
      {!props.configured && (
        <MessageBar intent="warning">
          <MessageBarBody>Azure authentication is not available in this environment.</MessageBarBody>
        </MessageBar>
      )}
      <div className={classes.actions}>
        <Button
          appearance="primary"
          disabled={isLoading || !props.configured || !props.isActive}
          icon={isLoading ? <Spinner size="tiny" /> : undefined}
          onClick={() => dispatchAction?.({ event: { name: 'azure:sign-in' } })}
        >
          {isLoading ? 'Signing in…' : 'Sign in to Azure'}
        </Button>
      </div>
    </Card>
  );
};

export const azureLoginCardContribution: ComponentContribution = {
  name: 'azure/AzureLoginCard',
  propertySchema: AzureLoginCardSchema,
  renderer: AzureLoginCardRenderer,
};
