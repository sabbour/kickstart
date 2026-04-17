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
    title: DynamicStringSchema.describe('Card title, e.g. "Sign in to GitHub"'),
    description: DynamicStringSchema.optional().describe('Optional explanation text'),
    status: z.enum(['idle', 'authenticating', 'authenticated', 'error'])
      .default('idle')
      .describe('Current authentication state'),
    errorMessage: DynamicStringSchema.optional(),
    providerLabel: DynamicStringSchema.optional().describe('Provider name, e.g. "GitHub" or "Azure"'),
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
  return (
    <Card className={classes.root}>
      <CardHeader header={<Text weight="semibold">{String(props.title ?? 'Sign in')}</Text>} />
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
            {props.providerLabel ? `Sign in with ${props.providerLabel}` : 'Sign in'}
          </Button>
        </div>
      )}
    </Card>
  );
});
