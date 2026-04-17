import React from 'react';
import { z } from 'zod';
import {
  Card,
  CardHeader,
  Text,
  Field,
  Input,
  tokens,
  makeStyles,
} from '@fluentui/react-components';
import type { ComponentContribution } from '@kickstart/harness';

const SecretSetterSchema = z.object({
  secretName: z.string(),
  hint: z.string().optional(),
  status: z.enum(['idle', 'saving', 'saved', 'error']).default('idle'),
  errorMessage: z.string().optional(),
  isActive: z.boolean().default(true),
});

type SecretSetterProps = z.infer<typeof SecretSetterSchema>;

const useStyles = makeStyles({
  card: {
    padding: tokens.spacingVerticalM,
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    maxWidth: '420px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    marginTop: tokens.spacingVerticalS,
  },
  secretName: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
  },
  inactive: {
    opacity: 0.6,
    pointerEvents: 'none',
  },
});

export const SecretSetterRenderer: React.FC<{ props: SecretSetterProps }> = ({ props }) => {
  const classes = useStyles();
  const containerClass = props.isActive ? classes.card : `${classes.card} ${classes.inactive}`;

  return (
    <Card className={containerClass}>
      <CardHeader
        header={<Text weight="semibold">Set GitHub Secret</Text>}
      />
      <Text size={300}>
        Secret: <span className={classes.secretName}>{String(props.secretName)}</span>
      </Text>
      {props.hint && (
        <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
          {String(props.hint)}
        </Text>
      )}
      {props.status !== 'saved' && props.isActive && (
        <div className={classes.form}>
          <Field label={String(props.secretName)}>
            <Input
              type="password"
              placeholder="Paste secret value…"
              disabled
              aria-label={`Value for ${String(props.secretName)}`}
            />
          </Field>
        </div>
      )}
      {props.status === 'saved' && (
        <Text size={200} style={{ color: tokens.colorPaletteGreenForeground1 }}>
          Secret saved successfully.
        </Text>
      )}
      {props.status === 'error' && props.errorMessage && (
        <Text size={200} style={{ color: tokens.colorPaletteRedForeground1 }}>
          {String(props.errorMessage)}
        </Text>
      )}
    </Card>
  );
};

export const secretSetterContribution: ComponentContribution = {
  name: 'github/SecretSetter',
  propertySchema: SecretSetterSchema,
  renderer: SecretSetterRenderer,
};
