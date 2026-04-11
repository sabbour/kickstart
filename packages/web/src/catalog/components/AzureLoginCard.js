import React, { useCallback, useEffect, useState } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema, ActionSchema } from '../../vendor/a2ui/web_core/schema/common-types';
import { Avatar, Body1Strong, Body2, Button, Card, CardHeader, Caption1, MessageBar, MessageBarBody, Spinner, makeStyles, tokens, } from '@fluentui/react-components';
import { useAPIConnector } from '../../contexts/APIConnectorContext';
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
/** Stub subscriptions shown when connector is unavailable. */
const STUB_SUBSCRIPTIONS = [
    {
        subscriptionId: '00000000-0000-0000-0000-000000000001',
        displayName: 'Kickstart Dev Subscription',
        state: 'Enabled',
        tenantId: '00000000-0000-0000-0000-000000000099',
    },
];
export const AzureLoginCard = createReactComponent(AzureLoginCardApi, ({ props }) => {
    const classes = useStyles();
    const connector = useAPIConnector('azure-arm');
    const [loading, setLoading] = useState(false);
    const [authenticated, setAuthenticated] = useState(() => connector?.isAuthenticated() ?? false);
    const [subscriptions, setSubscriptions] = useState([]);
    const [error, setError] = useState();
    // Track token metadata in React state (per Leela: NOT connector accessor)
    const [authTime, setAuthTime] = useState(null);
    const displayName = props.displayName ? String(props.displayName) : 'Azure User';
    const fetchSubscriptions = useCallback(async (conn) => {
        try {
            const subs = await conn.listSubscriptions();
            setSubscriptions(subs);
        }
        catch {
            setSubscriptions([]);
        }
    }, []);
    // Fetch subscriptions on mount if already authenticated
    useEffect(() => {
        if (connector?.isAuthenticated()) {
            fetchSubscriptions(connector);
        }
    }, [connector, fetchSubscriptions]);
    const handleSignIn = async () => {
        if (!connector) {
            // Stub mode — show stub subscriptions
            setAuthenticated(true);
            setSubscriptions(STUB_SUBSCRIPTIONS);
            setAuthTime(new Date());
            if (props.onSignIn)
                props.onSignIn();
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
            if (props.onSignIn)
                props.onSignIn();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : 'Sign-in failed');
        }
        finally {
            setLoading(false);
        }
    };
    const handleSignOut = () => {
        setAuthenticated(false);
        setSubscriptions([]);
        setAuthTime(null);
        setError(undefined);
        if (props.onSignOut)
            props.onSignOut();
    };
    if (authenticated) {
        return (<Card className={classes.root}>
        <CardHeader header={<Body1Strong>Azure</Body1Strong>} description={<Caption1>
              <span className={classes.statusDot}/>
              Connected
            </Caption1>}/>
        <div className={classes.signedIn}>
          <Avatar name={displayName} size={36} color="brand"/>
          <div className={classes.userInfo}>
            <Body2 style={{ fontWeight: 600 }}>{displayName}</Body2>
            <Caption1>Signed in to Azure</Caption1>
          </div>
        </div>

        {subscriptions.length > 0 && (<div className={classes.subscriptionInfo}>
            <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
              {subscriptions.length === 1 ? 'Subscription' : `${subscriptions.length} subscriptions available`}
            </Caption1>
            {subscriptions.slice(0, 3).map((sub) => (<Caption1 key={sub.subscriptionId}>
                {sub.displayName} ({sub.state})
              </Caption1>))}
            {subscriptions.length > 3 && (<Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                +{subscriptions.length - 3} more
              </Caption1>)}
          </div>)}

        {props.showTokenInfo && authTime && (<div className={classes.subscriptionInfo}>
            <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
              Authenticated at {authTime.toLocaleTimeString()}
            </Caption1>
          </div>)}

        <div className={classes.actions}>
          <Button appearance="subtle" size="small" onClick={handleSignOut}>
            Sign out
          </Button>
        </div>
      </Card>);
    }
    return (<Card className={classes.root}>
      <CardHeader header={<Body1Strong>Azure</Body1Strong>} description={<Caption1>Sign in to access your Azure resources</Caption1>}/>
      {error && (<MessageBar intent="error">
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>)}
      <div className={classes.actions}>
        <Button appearance="primary" onClick={handleSignIn} disabled={loading} icon={loading ? <Spinner size="tiny"/> : undefined}>
          {loading ? 'Signing in…' : 'Sign in to Azure'}
        </Button>
      </div>
      {!connector && (<Caption1 style={{ color: tokens.colorNeutralForeground3, marginTop: tokens.spacingVerticalXS }}>
          Running in offline mode — sign-in will use stub data
        </Caption1>)}
    </Card>);
});
//# sourceMappingURL=AzureLoginCard.js.map