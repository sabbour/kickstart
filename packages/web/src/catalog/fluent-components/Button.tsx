import React from 'react';
import {createReactComponent} from '../../vendor/a2ui/react/adapter';
import {z} from 'zod';
import {
  ComponentIdSchema,
  ActionSchema,
  CheckableSchema,
} from '../../vendor/a2ui/web_core/schema/common-types';
import {Button as FluentButton, makeStyles, tokens} from '@fluentui/react-components';

// v0.9 Button: the visible label is a `child` Text component. There is no
// top-level `label` / `onClick` / `onChange` — interactions flow through
// `action: { event: { name, payload? } }`. Any legacy prop is rejected by the
// strict schema and the component falls back to _ErrorComponent with a
// "non-spec property" error. See #984 + https://a2ui.org/specification/v0.9-a2ui/.
const FlexibleButtonApi = {
  name: 'Button' as const,
  schema: z
    .object({
      accessibility: z.any().optional(),
      weight: z.number().optional(),
      child: ComponentIdSchema.optional(),
      variant: z.string().optional(),
      action: ActionSchema.optional(),
      checks: CheckableSchema.shape.checks,
      isValid: z.boolean().optional(),
    })
    .strict(),
};

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalXS,
    marginBottom: tokens.spacingVerticalXS,
  },
});

export const Button = createReactComponent(FlexibleButtonApi, ({props, buildChild}) => {
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

  return (
    <FluentButton
      className={classes.root}
      appearance={appearance as 'primary' | 'transparent' | 'outline' | 'secondary'}
      onClick={props.action}
      disabled={props.isValid === false}
    >
      {props.child ? buildChild(props.child) : null}
    </FluentButton>
  );
});
