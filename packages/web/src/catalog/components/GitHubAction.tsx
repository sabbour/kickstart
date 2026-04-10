import React, { useState } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema, ActionSchema } from '../../vendor/a2ui/web_core/schema/common-types';
import {
  Body1,
  Button,
  Card,
  CardHeader,
  Caption1,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Spinner,
  Subtitle2,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  CheckmarkCircle20Regular,
  DismissCircle20Regular,
  ShieldCheckmark20Regular,
  Warning20Regular,
} from '@fluentui/react-icons';
import { useAPIConnector } from '../../contexts/APIConnectorContext';
import type { GitHubConnector } from '@kickstart/core';

// ── Security: operation allowlisting (per Zapp's conditions) ──

/** Allowlisted GitHub API operations. */
const ALLOWED_OPERATIONS = new Set([
  'repos/create',
  'repos/update',
  'repos/delete',
  'repos/branches/create',
  'repos/branches/delete',
  'repos/pulls/create',
  'repos/pulls/update',
  'repos/pulls/merge',
  'repos/contents/create',
  'repos/contents/update',
  'repos/actions/secrets/create',
  'repos/issues/create',
  'repos/issues/update',
  'repos/releases/create',
]);

/** Protected branches that cannot be directly written to. */
const PROTECTED_BRANCHES = new Set(['main', 'master', 'production']);

/** Destructive HTTP methods that require typed confirmation. */
const DESTRUCTIVE_METHODS = new Set(['DELETE']);

/** Validate a GitHub API path. */
function validateGitHubPath(path: string): string | null {
  if (!path.startsWith('/repos/') && !path.startsWith('/user/')) {
    return 'Path must start with /repos/ or /user/';
  }
  if (path.length > 500) {
    return 'GitHub API path exceeds maximum length';
  }
  return null;
}

/** Check if the operation targets a protected branch. */
function checkProtectedBranch(path: string, body: Record<string, unknown>): string | null {
  const branchInPath = path.match(/\/branches\/([^/]+)/)?.[1];
  const branchInBody = typeof body.ref === 'string' ? body.ref.replace('refs/heads/', '') : null;
  const baseInBody = typeof body.base === 'string' ? body.base : null;

  for (const branch of [branchInPath, branchInBody, baseInBody]) {
    if (branch && PROTECTED_BRANCHES.has(branch)) {
      return `Direct writes to protected branch "${branch}" are blocked. Use a feature branch and create a pull request instead.`;
    }
  }
  return null;
}

const GitHubActionApi = {
  name: 'GitHubAction',
  schema: z.object({
    title: DynamicStringSchema,
    description: DynamicStringSchema.optional(),
    method: z.enum(['POST', 'PUT', 'PATCH', 'DELETE']),
    path: DynamicStringSchema,
    operationType: DynamicStringSchema.optional(),
    body: z.record(z.unknown()).optional(),
    confirmLabel: DynamicStringSchema.optional(),
    onSuccess: ActionSchema.optional(),
    onError: ActionSchema.optional(),
  }).strict(),
};

type ActionState = 'idle' | 'confirming' | 'executing' | 'success' | 'error';

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalL,
    width: '100%',
  },
  description: {
    color: tokens.colorNeutralForeground2,
    marginTop: tokens.spacingVerticalXS,
  },
  previewSection: {
    marginTop: tokens.spacingVerticalM,
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
  },
  previewRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    marginBottom: tokens.spacingVerticalXXS,
  },
  confirmSection: {
    marginTop: tokens.spacingVerticalM,
    padding: tokens.spacingHorizontalM,
    backgroundColor: tokens.colorPaletteRedBackground1,
    borderRadius: tokens.borderRadiusMedium,
  },
  actions: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalM,
    alignItems: 'center',
  },
  resultSection: {
    marginTop: tokens.spacingVerticalM,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  validationError: {
    marginTop: tokens.spacingVerticalS,
  },
});

export const GitHubAction = createReactComponent(GitHubActionApi, ({ props }) => {
  const classes = useStyles();
  const connector = useAPIConnector('github') as GitHubConnector | undefined;

  const titleText = String(props.title);
  const description = props.description ? String(props.description) : undefined;
  const method = props.method as 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  const apiPath = String(props.path);
  const operationType = props.operationType ? String(props.operationType) : undefined;
  const body = (props.body ?? {}) as Record<string, unknown>;
  const confirmLabel = props.confirmLabel ? String(props.confirmLabel) : `${method} Resource`;

  const isDestructive = DESTRUCTIVE_METHODS.has(method);

  const [state, setState] = useState<ActionState>('idle');
  const [resultMessage, setResultMessage] = useState<string>('');
  const [confirmInput, setConfirmInput] = useState('');

  // Validation checks
  const pathError = validateGitHubPath(apiPath);
  const branchError = checkProtectedBranch(apiPath, body);
  const allowlistError = operationType && !ALLOWED_OPERATIONS.has(operationType)
    ? `Operation type "${operationType}" is not in the allowed operations list`
    : null;
  const validationError = pathError ?? branchError ?? allowlistError;

  // Extract resource name for destructive confirmation
  const pathParts = apiPath.split('/').filter(Boolean);
  const resourceName = pathParts[pathParts.length - 1]?.split('?')[0] ?? '';

  const handleConfirm = () => {
    if (isDestructive) {
      setState('confirming');
    } else {
      executeAction();
    }
  };

  const executeAction = async () => {
    setState('executing');
    setResultMessage('');

    try {
      if (!connector) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setState('success');
        setResultMessage(`${method} operation completed successfully (stub mode)`);
        if (props.onSuccess) (props.onSuccess as () => void)();
        return;
      }

      const res = await connector.request(method, apiPath, method !== 'DELETE' ? body : undefined);

      if (res.ok) {
        let resultData: unknown;
        try {
          resultData = await res.json();
        } catch {
          resultData = null;
        }
        const htmlUrl = (resultData as Record<string, unknown>)?.html_url;
        setState('success');
        setResultMessage(
          htmlUrl
            ? `Operation succeeded: ${String(htmlUrl)}`
            : `${method} operation completed successfully`,
        );
        if (props.onSuccess) (props.onSuccess as () => void)();
      } else {
        let errorBody: string;
        try {
          const errorJson = (await res.json()) as Record<string, unknown>;
          errorBody = typeof errorJson.message === 'string'
            ? errorJson.message
            : JSON.stringify(errorJson);
        } catch {
          errorBody = `HTTP ${res.status}`;
        }

        // Rate limit handling (X-RateLimit headers per Leela's conditions)
        const rateLimitRemaining = res.headers.get('X-RateLimit-Remaining');
        const rateLimitReset = res.headers.get('X-RateLimit-Reset');
        if (res.status === 403 && rateLimitRemaining === '0' && rateLimitReset) {
          const resetDate = new Date(parseInt(rateLimitReset, 10) * 1000);
          errorBody = `GitHub API rate limit exceeded. Resets at ${resetDate.toLocaleTimeString()}.`;
        }

        setState('error');
        setResultMessage(errorBody);
        if (props.onError) (props.onError as () => void)();
      }
    } catch (err) {
      setState('error');
      setResultMessage(err instanceof Error ? err.message : 'Operation failed');
      if (props.onError) (props.onError as () => void)();
    }
  };

  const handleReset = () => {
    setState('idle');
    setResultMessage('');
    setConfirmInput('');
  };

  return (
    <Card className={classes.root}>
      <CardHeader
        header={<Subtitle2>{titleText}</Subtitle2>}
        description={description ? <Caption1 className={classes.description}>{description}</Caption1> : undefined}
      />

      {/* Action preview — always visible */}
      <div className={classes.previewSection}>
        <div className={classes.previewRow}>
          <Caption1 style={{ color: tokens.colorNeutralForeground3, minWidth: '70px' }}>Method:</Caption1>
          <Caption1 style={{ fontWeight: 600 }}>{method}</Caption1>
        </div>
        <div className={classes.previewRow}>
          <Caption1 style={{ color: tokens.colorNeutralForeground3, minWidth: '70px' }}>Endpoint:</Caption1>
          <Caption1 style={{ wordBreak: 'break-all' }}>{apiPath}</Caption1>
        </div>
        {operationType && (
          <div className={classes.previewRow}>
            <Caption1 style={{ color: tokens.colorNeutralForeground3, minWidth: '70px' }}>Operation:</Caption1>
            <Caption1>{operationType}</Caption1>
          </div>
        )}
        {Object.keys(body).length > 0 && (
          <div className={classes.previewRow}>
            <Caption1 style={{ color: tokens.colorNeutralForeground3, minWidth: '70px' }}>Body:</Caption1>
            <Caption1 style={{ wordBreak: 'break-all' }}>
              {JSON.stringify(body, null, 0).slice(0, 200)}
              {JSON.stringify(body).length > 200 ? '…' : ''}
            </Caption1>
          </div>
        )}
      </div>

      {/* Validation errors */}
      {validationError && (
        <MessageBar intent="error" className={classes.validationError}>
          <MessageBarBody>
            <Warning20Regular style={{ marginRight: tokens.spacingHorizontalXS }} />
            {validationError}
          </MessageBarBody>
        </MessageBar>
      )}

      {/* Destructive typed confirmation (per Zapp: type resource name to confirm) */}
      {state === 'confirming' && isDestructive && (
        <div className={classes.confirmSection}>
          <Body1 style={{ fontWeight: 600, color: tokens.colorPaletteRedForeground1 }}>
            ⚠️ Destructive operation
          </Body1>
          <Caption1 style={{ marginTop: tokens.spacingVerticalXS }}>
            This will permanently delete the resource. Type <strong>{resourceName}</strong> to confirm.
          </Caption1>
          <Field style={{ marginTop: tokens.spacingVerticalS }}>
            <Input
              placeholder={`Type "${resourceName}" to confirm`}
              value={confirmInput}
              onChange={(_, data) => setConfirmInput(data.value)}
              aria-label="Confirmation input"
            />
          </Field>
          <div className={classes.actions}>
            <Button appearance="subtle" onClick={handleReset}>
              Cancel
            </Button>
            <Button
              appearance="primary"
              style={{ backgroundColor: tokens.colorPaletteRedBackground3 }}
              disabled={confirmInput !== resourceName}
              onClick={executeAction}
            >
              Delete permanently
            </Button>
          </div>
        </div>
      )}

      {/* Result display */}
      {(state === 'success' || state === 'error') && (
        <div className={classes.resultSection}>
          {state === 'success' ? (
            <>
              <CheckmarkCircle20Regular style={{ color: tokens.colorPaletteGreenForeground1 }} />
              <Caption1 style={{ color: tokens.colorPaletteGreenForeground1 }}>{resultMessage}</Caption1>
            </>
          ) : (
            <>
              <DismissCircle20Regular style={{ color: tokens.colorPaletteRedForeground1 }} />
              <Caption1 style={{ color: tokens.colorPaletteRedForeground1 }}>{resultMessage}</Caption1>
            </>
          )}
        </div>
      )}

      {/* Action buttons */}
      {state !== 'confirming' && (
        <div className={classes.actions}>
          {(state === 'success' || state === 'error') && (
            <Button appearance="subtle" onClick={handleReset}>
              Reset
            </Button>
          )}
          {state === 'idle' && (
            <Button
              appearance="primary"
              style={isDestructive ? { backgroundColor: tokens.colorPaletteRedBackground3 } : undefined}
              onClick={handleConfirm}
              disabled={!!validationError}
              icon={<ShieldCheckmark20Regular />}
            >
              {confirmLabel}
            </Button>
          )}
          {state === 'executing' && (
            <Spinner size="small" label="Executing…" />
          )}
        </div>
      )}

      {!connector && state === 'idle' && (
        <Caption1 style={{ color: tokens.colorNeutralForeground3, marginTop: tokens.spacingVerticalS }}>
          Running in offline mode — action will simulate success
        </Caption1>
      )}
    </Card>
  );
});
