import React, { useState } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema, ActionSchema } from '../../vendor/a2ui/web_core/schema/common-types';
import {
  Body1,
  Body2,
  Button,
  Card,
  CardHeader,
  Caption1,
  Field,
  Input,
  MessageBar,
  MessageBarBody,
  Spinner,
  Subtitle1,
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
import type { AzureARMConnector } from '@kickstart/core';

// ── Validation helpers (per Zapp's security conditions) ──

const GUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RESOURCE_NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,89}$/;

/** Allowlisted ARM resource types that AzureAction may target. */
const ALLOWED_RESOURCE_TYPES = new Set([
  'microsoft.containerservice/managedclusters',
  'microsoft.containerregistry/registries',
  'microsoft.network/publicipaddresses',
  'microsoft.network/virtualnetworks',
  'microsoft.storage/storageaccounts',
  'microsoft.dbforpostgresql/flexibleservers',
  'microsoft.cache/redis',
  'microsoft.web/sites',
  'microsoft.app/containerapps',
  'microsoft.keyvault/vaults',
  'microsoft.operationalinsights/workspaces',
  'microsoft.insights/components',
  'microsoft.managedidentity/userassignedidentities',
  'microsoft.authorization/roleassignments',
]);

/** Validate an ARM path conforms to expected patterns. */
function validateArmPath(path: string): string | null {
  // Length cap (check early to avoid regex on huge strings)
  if (path.length > 500) {
    return 'ARM path exceeds maximum length';
  }
  // Must start with /subscriptions/
  if (!path.startsWith('/subscriptions/')) {
    return 'Path must start with /subscriptions/';
  }
  // Extract and validate subscription ID
  const subMatch = path.match(/^\/subscriptions\/([^/]+)/);
  if (subMatch && !GUID_RE.test(subMatch[1])) {
    return 'Invalid subscription ID format (must be a valid GUID)';
  }
  // Extract and validate resource group name if present
  const rgMatch = path.match(/resourceGroups\/([^/]+)/i);
  if (rgMatch && !RESOURCE_NAME_RE.test(rgMatch[1])) {
    return 'Invalid resource group name';
  }
  // REQUIRE /providers/ — paths without it bypass the resource-type allowlist
  const providerMatch = path.match(/providers\/([^/]+\/[^/?]+)/i);
  if (!providerMatch) {
    return 'Path must target a specific resource provider (must contain /providers/)';
  }
  // Check resource type is in allowlist
  const resourceType = providerMatch[1].toLowerCase();
  if (!ALLOWED_RESOURCE_TYPES.has(resourceType)) {
    return `Resource type "${providerMatch[1]}" is not in the allowed operations list`;
  }
  return null;
}

const AzureActionApi = {
  name: 'AzureAction',
  schema: z.object({
    title: DynamicStringSchema,
    description: DynamicStringSchema.optional(),
    method: z.enum(['PUT', 'POST', 'PATCH', 'DELETE']),
    path: DynamicStringSchema,
    body: z.record(z.unknown()).optional(),
    apiVersion: DynamicStringSchema.optional(),
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

export const AzureAction = createReactComponent(AzureActionApi, ({ props }) => {
  const classes = useStyles();
  const connector = useAPIConnector('azure-arm') as AzureARMConnector | undefined;

  const titleText = String(props.title);
  const description = props.description ? String(props.description) : undefined;
  const method = props.method as 'PUT' | 'POST' | 'PATCH' | 'DELETE';
  const armPath = String(props.path);
  const body = (props.body ?? {}) as Record<string, unknown>;
  const apiVersion = props.apiVersion ? String(props.apiVersion) : '2021-04-01';
  const confirmLabel = props.confirmLabel ? String(props.confirmLabel) : `${method} Resource`;

  const isDestructive = method === 'DELETE';

  const [state, setState] = useState<ActionState>('idle');
  const [resultMessage, setResultMessage] = useState<string>('');
  const [confirmInput, setConfirmInput] = useState('');

  // Validate the ARM path up front
  const pathError = validateArmPath(armPath);

  // Extract resource name from path for destructive confirmation
  const pathParts = armPath.split('/').filter(Boolean);
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
        // Stub mode — simulate success
        await new Promise((resolve) => setTimeout(resolve, 1000));
        setState('success');
        setResultMessage(`${method} operation completed successfully (stub mode)`);
        if (props.onSuccess) (props.onSuccess as () => void)();
        return;
      }

      const fullPath = armPath.includes('api-version')
        ? armPath
        : `${armPath}${armPath.includes('?') ? '&' : '?'}api-version=${apiVersion}`;

      const res = await connector.request(method, fullPath, method !== 'DELETE' ? body : undefined);

      if (res.ok) {
        let resultData: unknown;
        try {
          resultData = await res.json();
        } catch {
          resultData = null;
        }
        const resourceId = (resultData as Record<string, unknown>)?.id;
        setState('success');
        setResultMessage(
          resourceId
            ? `Operation succeeded. Resource: ${String(resourceId)}`
            : `${method} operation completed successfully`,
        );
        if (props.onSuccess) (props.onSuccess as () => void)();
      } else {
        let errorBody: string;
        try {
          const errorJson = (await res.json()) as Record<string, unknown>;
          const errorObj = errorJson.error as Record<string, unknown> | undefined;
          errorBody = errorObj?.message ? String(errorObj.message) : JSON.stringify(errorJson);
        } catch {
          errorBody = `HTTP ${res.status}`;
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
        header={<Subtitle1>{titleText}</Subtitle1>}
        description={description ? <Caption1 className={classes.description}>{description}</Caption1> : undefined}
      />

      {/* Action preview — always visible (per Zapp: explicit action preview) */}
      <div className={classes.previewSection}>
        <div className={classes.previewRow}>
          <Caption1 style={{ color: tokens.colorNeutralForeground3, minWidth: '60px' }}>Method:</Caption1>
          <Caption1 style={{ fontWeight: 600 }}>{method}</Caption1>
        </div>
        <div className={classes.previewRow}>
          <Caption1 style={{ color: tokens.colorNeutralForeground3, minWidth: '60px' }}>Target:</Caption1>
          <Caption1 style={{ wordBreak: 'break-all' }}>{armPath}</Caption1>
        </div>
        {Object.keys(body).length > 0 && (
          <div className={classes.previewRow}>
            <Caption1 style={{ color: tokens.colorNeutralForeground3, minWidth: '60px' }}>Body:</Caption1>
            <Caption1 style={{ wordBreak: 'break-all' }}>
              {JSON.stringify(body, null, 0).slice(0, 200)}
              {JSON.stringify(body).length > 200 ? '…' : ''}
            </Caption1>
          </div>
        )}
      </div>

      {/* Validation error */}
      {pathError && (
        <MessageBar intent="error" className={classes.validationError}>
          <MessageBarBody>
            <Warning20Regular style={{ marginRight: tokens.spacingHorizontalXS }} />
            {pathError}
          </MessageBarBody>
        </MessageBar>
      )}

      {/* Destructive confirmation (per Zapp: type resource name to confirm) */}
      {state === 'confirming' && isDestructive && (
        <div className={classes.confirmSection}>
          <Body1 style={{ fontWeight: 600, color: tokens.colorPaletteRedForeground1, display: 'inline-flex', alignItems: 'center', gap: tokens.spacingHorizontalXS }}>
            <Warning20Regular />
            Destructive operation
          </Body1>
          <Body2 style={{ marginTop: tokens.spacingVerticalXS }}>
            This will permanently delete the resource. Type <strong>{resourceName}</strong> to confirm.
          </Body2>
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
              <Body2 style={{ color: tokens.colorPaletteGreenForeground1 }}>{resultMessage}</Body2>
            </>
          ) : (
            <>
              <DismissCircle20Regular style={{ color: tokens.colorPaletteRedForeground1 }} />
              <Body2 style={{ color: tokens.colorPaletteRedForeground1 }}>{resultMessage}</Body2>
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
              appearance={isDestructive ? 'primary' : 'primary'}
              style={isDestructive ? { backgroundColor: tokens.colorPaletteRedBackground3 } : undefined}
              onClick={handleConfirm}
              disabled={!!pathError}
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

    </Card>
  );
});
