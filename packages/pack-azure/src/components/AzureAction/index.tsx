import React from 'react';
import { z } from 'zod';
import {
  Card, CardHeader, Text, Button, Spinner, tokens, makeStyles,
} from '@fluentui/react-components';
import type { ComponentContribution } from '@aks-kickstart/harness';

/**
 * AzureAction — confirm gate component.
 *
 * This component renders a confirmation UI for ARM write operations.
 * It does NOT call ARM directly from the browser.
 * On confirm, it dispatches the azure:arm_write or azure:deploy userAction
 * via the A2UI user-action protocol, which causes the Runner to:
 *   1. Pause the agent turn
 *   2. Emit a user_action_required SSE event
 *   3. Wait for the browser to POST a typed result to /api/converse/resume
 *
 * The component is intentionally passive: it only renders state.
 * Interactive confirmation is handled by the A2UI user-action flow.
 */

const AzureActionSchema = z.object({
  title: z.string().describe('Action title, e.g. "Deploy to Azure"'),
  description: z.string().optional().describe('What this action will do'),
  status: z
    .enum(['pending', 'confirming', 'executing', 'succeeded', 'failed', 'canceled'])
    .default('pending'),
  whatIfSummary: z.string().optional().describe('Pre-computed what-if summary'),
  resourcePath: z.string().optional().describe('ARM resource path (for display only)'),
  destructive: z.boolean().default(false).describe('Whether this action deletes resources'),
  errorMessage: z.string().optional(),
});

type AzureActionProps = z.infer<typeof AzureActionSchema>;

const useStyles = makeStyles({
  card: {
    padding: tokens.spacingVerticalM,
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    maxWidth: '480px',
  },
  body: {
    marginTop: tokens.spacingVerticalS,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  whatIf: {
    padding: tokens.spacingVerticalXS,
    paddingLeft: tokens.spacingHorizontalS,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
    borderLeft: `3px solid ${tokens.colorBrandStroke1}`,
  },
  destructiveWarning: {
    padding: tokens.spacingVerticalXS,
    paddingLeft: tokens.spacingHorizontalS,
    backgroundColor: tokens.colorPaletteRedBackground1,
    borderRadius: tokens.borderRadiusMedium,
    borderLeft: `3px solid ${tokens.colorPaletteRedBorder1}`,
  },
  actions: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalS,
  },
});

export const AzureActionRenderer: React.FC<{
  props: AzureActionProps;
  dispatchAction?: (action: unknown) => void;
}> = ({ props, dispatchAction }) => {
  const classes = useStyles();

  const isTerminal = props.status === 'succeeded' || props.status === 'failed' || props.status === 'canceled';
  const isPending = props.status === 'pending';
  const isExecuting = props.status === 'executing' || props.status === 'confirming';

  return (
    <Card className={classes.card}>
      <CardHeader
        header={<Text weight="semibold">{String(props.title)}</Text>}
      />
      <div className={classes.body}>
        {props.description && (
          <Text size={300}>{String(props.description)}</Text>
        )}
        {props.resourcePath && (
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            {String(props.resourcePath)}
          </Text>
        )}
        {props.whatIfSummary && (
          <div className={classes.whatIf}>
            <Text size={200} weight="semibold">What-if preview</Text>
            <Text size={200} style={{ display: 'block' }}>{String(props.whatIfSummary)}</Text>
          </div>
        )}
        {props.destructive && isPending && (
          <div className={classes.destructiveWarning}>
            <Text size={200} style={{ color: tokens.colorPaletteRedForeground1 }}>
              This action will delete resources. Review carefully before confirming.
            </Text>
          </div>
        )}
        {props.status === 'succeeded' && (
          <Text size={200} style={{ color: tokens.colorPaletteGreenForeground1 }}>
            Action completed successfully.
          </Text>
        )}
        {props.status === 'failed' && props.errorMessage && (
          <Text size={200} style={{ color: tokens.colorPaletteRedForeground1 }}>
            {String(props.errorMessage)}
          </Text>
        )}
        {props.status === 'canceled' && (
          <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
            Action was canceled.
          </Text>
        )}
        {isExecuting && (
          <Spinner size="small" label={props.status === 'confirming' ? 'Waiting for confirmation…' : 'Executing…'} />
        )}
        {!isTerminal && !isExecuting && (
          <div className={classes.actions}>
            <Button
              appearance={props.destructive ? 'primary' : 'primary'}
              style={props.destructive ? { backgroundColor: tokens.colorPaletteRedBackground3 } : undefined}
              onClick={() => dispatchAction?.({ event: { name: 'azure:arm_write:confirm' } })}
            >
              Confirm
            </Button>
            <Button
              appearance="secondary"
              onClick={() => dispatchAction?.({ event: { name: 'azure:arm_write:cancel' } })}
            >Cancel</Button>
          </div>
        )}
      </div>
    </Card>
  );
};

export const azureActionContribution: ComponentContribution = {
  name: 'azure/AzureAction',
  propertySchema: AzureActionSchema,
  renderer: AzureActionRenderer,
};
