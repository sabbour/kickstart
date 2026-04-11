import React, { useState } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema, ActionSchema, } from '../../vendor/a2ui/web_core/schema/common-types';
import { MessageBar, MessageBarBody, MessageBarActions, Button, makeStyles, tokens, } from '@fluentui/react-components';
import { DismissRegular } from '@fluentui/react-icons';
const FlexibleAlertApi = {
    name: 'Alert',
    schema: z.object({
        accessibility: z.any().optional(),
        weight: z.number().optional(),
        message: DynamicStringSchema,
        severity: z.enum(['info', 'warning', 'error', 'success']).optional(),
        dismissible: z.boolean().optional(),
        action: ActionSchema.optional(),
    }),
};
const useStyles = makeStyles({
    root: {
        marginTop: tokens.spacingVerticalS,
        marginBottom: tokens.spacingVerticalS,
        width: '100%',
    },
});
const severityToIntent = (severity) => {
    switch (severity) {
        case 'error': return 'error';
        case 'warning': return 'warning';
        case 'success': return 'success';
        case 'info':
        default: return 'info';
    }
};
export const Alert = createReactComponent(FlexibleAlertApi, ({ props }) => {
    const classes = useStyles();
    const [dismissed, setDismissed] = useState(false);
    if (dismissed)
        return null;
    return (<MessageBar className={classes.root} intent={severityToIntent(props.severity)}>
      <MessageBarBody>{props.message ?? ''}</MessageBarBody>
      {(props.dismissible || props.action) && (<MessageBarActions containerAction={props.dismissible ? (<Button aria-label="dismiss" appearance="transparent" icon={<DismissRegular />} onClick={() => setDismissed(true)}/>) : undefined}>
          {props.action && (<Button appearance="transparent" onClick={props.action}>
              Action
            </Button>)}
        </MessageBarActions>)}
    </MessageBar>);
});
//# sourceMappingURL=Alert.js.map