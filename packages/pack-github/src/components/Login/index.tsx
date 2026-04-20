import React from 'react';
import { z } from 'zod';
import {
  Card,
  CardHeader,
  Text,
  Spinner,
  Button,
  Avatar,
  tokens,
  makeStyles,
} from '@fluentui/react-components';
import type { ComponentContribution } from '@aks-kickstart/harness';

const LoginSchema = z.object({
  status: z.enum(['idle', 'loading', 'success', 'error']).default('idle'),
  viewerSummary: z
    .object({
      login: z.string(),
      name: z.string().nullable().optional(),
      avatarUrl: z.string().optional(),
    })
    .optional(),
  errorMessage: z.string().optional(),
  reason: z.string().optional(),
  isActive: z.boolean().default(true),
});

type LoginProps = z.infer<typeof LoginSchema>;

const useStyles = makeStyles({
  card: {
    padding: tokens.spacingVerticalM,
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    maxWidth: '400px',
  },
  viewer: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalS,
  },
  inactive: {
    opacity: 0.6,
    pointerEvents: 'none',
  },
});

export const LoginRenderer: React.FC<{ props: LoginProps }> = ({ props }) => {
  const classes = useStyles();
  const containerClass = props.isActive ? classes.card : `${classes.card} ${classes.inactive}`;

  return (
    <Card className={containerClass}>
      <CardHeader header={<Text weight="semibold">Sign in to GitHub</Text>} />
      {props.reason && (
        <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
          {String(props.reason)}
        </Text>
      )}
      {props.status === 'loading' && (
        <Spinner size="small" label="Authenticating with GitHub…" />
      )}
      {props.status === 'error' && props.errorMessage && (
        <Text size={200} style={{ color: tokens.colorPaletteRedForeground1 }}>
          {String(props.errorMessage)}
        </Text>
      )}
      {props.status === 'success' && props.viewerSummary && (
        <div className={classes.viewer}>
          <Avatar
            name={String(props.viewerSummary.name ?? props.viewerSummary.login)}
            image={props.viewerSummary.avatarUrl ? { src: props.viewerSummary.avatarUrl } : undefined}
            size={32}
          />
          <Text size={300} weight="semibold">
            {String(props.viewerSummary.name ?? props.viewerSummary.login)}
          </Text>
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            @{String(props.viewerSummary.login)}
          </Text>
        </div>
      )}
      {props.status === 'idle' && props.isActive && (
        <Button appearance="primary" disabled>
          Sign in with GitHub
        </Button>
      )}
    </Card>
  );
};

export const loginContribution: ComponentContribution = {
  name: 'github/Login',
  propertySchema: LoginSchema,
  renderer: LoginRenderer,
};
