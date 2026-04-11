import React from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { ComponentIdSchema, DynamicStringSchema, ActionSchema, CheckableSchema, } from '../../vendor/a2ui/web_core/schema/common-types';
import { Button as FluentButton, makeStyles, tokens } from '@fluentui/react-components';
// Flexible ButtonApi: accepts `label` as shorthand (avoids needing a separate Text child)
const FlexibleButtonApi = {
    name: 'Button',
    schema: z.object({
        accessibility: z.any().optional(),
        weight: z.number().optional(),
        child: ComponentIdSchema.optional(),
        label: DynamicStringSchema.optional(),
        variant: z.string().default('default').optional(),
        action: ActionSchema.optional(),
        checks: CheckableSchema.shape.checks,
        isValid: z.boolean().optional(),
    }),
};
const useStyles = makeStyles({
    root: {
        marginTop: tokens.spacingVerticalXS,
        marginBottom: tokens.spacingVerticalXS,
    },
});
export const Button = createReactComponent(FlexibleButtonApi, ({ props, buildChild }) => {
    const classes = useStyles();
    const appearance = (() => {
        switch (props.variant) {
            case 'primary': return 'primary';
            case 'borderless':
            case 'text': return 'transparent';
            case 'outlined': return 'outline';
            default: return 'secondary';
        }
    })();
    return (<FluentButton className={classes.root} appearance={appearance} onClick={props.action} disabled={props.isValid === false}>
      {props.child ? buildChild(props.child) : (props.label ?? null)}
    </FluentButton>);
});
//# sourceMappingURL=Button.js.map