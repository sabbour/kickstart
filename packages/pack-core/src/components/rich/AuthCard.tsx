import React from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema } from '../../vendor/a2ui/schema/common-types';
import {
  Card, CardHeader, Button, Spinner, Text, Badge,
  makeStyles, tokens
} from '@fluentui/react-components';

const AuthCardApi = {
  name: 'AuthCard' as const,
  schema: z.object({
    // provider matches what agents emit per rich-component-schemas.ts
    provider: z.enum(['azure', 'github']).optional().describe('Authentication provider ("azure" or "github")'),
    title: DynamicStringSchema.nullable().optional().describe('Card title override; defaults to "Sign in to <Provider>"'),
    description: DynamicStringSchema.nullable().optional().describe('Optional explanation text'),
    status: z.enum(['idle', 'authenticating', 'authenticated', 'error'])
      .default('idle')
      .describe('Current authentication state'),
    errorMessage: DynamicStringSchema.optional(),
    // providerLabel is a display-only override; if omitted, derived from provider
    providerLabel: DynamicStringSchema.optional().describe('Provider display name override'),
    checks: z.array(z.any()).optional(),
  }),
};

const useStyles = makeStyles({
  root: {
    padding: tokens.spacingVerticalM,
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
  },
  actions: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalM,
  },
});

export const AuthCard = createReactComponent(AuthCardApi, ({ props }) => {
  const classes = useStyles();
  const derivedLabel = props.provider === 'azure' ? 'Azure'
    : props.provider === 'github' ? 'GitHub'
    : undefined;
  const label = props.providerLabel ?? derivedLabel;
  const title = props.title ?? (label ? `Sign in to ${label}` : 'Sign in');
  return (
    <Card className={classes.root}>
      <CardHeader header={<Text weight="semibold">{String(title)}</Text>} />
      {props.description && <Text>{String(props.description)}</Text>}
      {props.status === 'authenticating' && <Spinner size="small" label="Signing in…" />}
      {props.status === 'authenticated' && (
        <Badge appearance="filled" color="success">Authenticated</Badge>
      )}
      {props.status === 'error' && props.errorMessage && (
        <Text style={{ color: tokens.colorPaletteRedForeground1 }}>{String(props.errorMessage)}</Text>
      )}
      {(props.status === 'idle' || props.status === 'error') && (
        <div className={classes.actions}>
          <Button appearance="primary">
            {label ? `Sign in with ${label}` : 'Sign in'}
          </Button>
        </div>
      )}
    </Card>
  );
});
