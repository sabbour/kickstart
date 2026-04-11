import React from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { ComponentIdSchema, DynamicStringSchema } from '../../vendor/a2ui/web_core/schema/common-types';
import { Card as FluentCard, Subtitle2, makeStyles, tokens } from '@fluentui/react-components';
// Flexible CardApi: accepts both `child` (spec) and `children` (common mistake by LLMs),
// plus an optional `title` prop. No .strict() so unknown props don't break rendering.
const FlexibleCardApi = {
    name: 'Card',
    schema: z.object({
        accessibility: z.any().optional(),
        weight: z.number().optional(),
        child: ComponentIdSchema.optional(),
        children: z.array(ComponentIdSchema).optional(),
        title: DynamicStringSchema.optional(),
    }),
};
const useStyles = makeStyles({
    root: {
        marginTop: tokens.spacingVerticalS,
        marginBottom: tokens.spacingVerticalS,
        padding: tokens.spacingHorizontalL,
        width: '100%',
    },
    title: {
        marginBottom: tokens.spacingVerticalS,
    },
});
export const Card = createReactComponent(FlexibleCardApi, ({ props, buildChild }) => {
    const classes = useStyles();
    const childId = props.child || (props.children?.[0]);
    return (<FluentCard className={classes.root}>
      {props.title && typeof props.title === 'string' && (<Subtitle2 className={classes.title} block>{props.title}</Subtitle2>)}
      {childId ? buildChild(childId) : null}
    </FluentCard>);
});
//# sourceMappingURL=Card.js.map