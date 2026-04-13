import React from 'react';
import {createReactComponent} from '../../vendor/a2ui/react/adapter';
import {z} from 'zod';
import {DynamicStringSchema} from '../../vendor/a2ui/web_core/schema/common-types';
import {
  Badge as FluentBadge,
  CounterBadge,
  PresenceBadge,
  makeStyles,
  tokens,
} from '@fluentui/react-components';

const FlexibleBadgeApi = {
  name: 'Badge' as const,
  schema: z.object({
    accessibility: z.any().optional(),
    weight: z.number().optional(),
    text: DynamicStringSchema.optional(),
    color: z.enum([
      'brand', 'danger', 'important', 'informative',
      'severe', 'subtle', 'success', 'warning',
    ]).optional(),
    shape: z.enum(['circular', 'rounded', 'square']).optional(),
    size: z.enum(['tiny', 'small', 'medium', 'large', 'extra-large']).optional(),
    appearance: z.enum(['filled', 'ghost', 'outline', 'tint']).optional(),
    variant: z.enum(['badge', 'counter', 'presence']).optional(),
    count: z.number().optional(),
    status: z.enum(['available', 'away', 'busy', 'do-not-disturb', 'offline', 'out-of-office', 'unknown']).optional(),
  }),
};

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalXXS,
    marginBottom: tokens.spacingVerticalXXS,
  },
});

export const Badge = createReactComponent(FlexibleBadgeApi, ({props}) => {
  const classes = useStyles();
  const variant = (props.variant as string) || 'badge';

  if (variant === 'counter') {
    return (
      <CounterBadge
        className={classes.root}
        count={props.count ?? 0}
        color={props.color as any}
        shape={props.shape as any}
        size={props.size as any}
        appearance={props.appearance as any}
        aria-label={typeof props.accessibility?.label === 'string' ? props.accessibility.label : `${props.count ?? 0} items`}
      />
    );
  }

  if (variant === 'presence') {
    return (
      <PresenceBadge
        className={classes.root}
        status={props.status as any ?? 'available'}
        size={props.size as any}
        aria-label={typeof props.accessibility?.label === 'string' ? props.accessibility.label : `Status: ${props.status ?? 'available'}`}
      />
    );
  }

  return (
    <FluentBadge
      className={classes.root}
      color={props.color as any}
      shape={props.shape as any}
      size={props.size as any}
      appearance={props.appearance as any}
    >
      {props.text ?? ''}
    </FluentBadge>
  );
});
