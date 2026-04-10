import React, { useCallback, useEffect, useState } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema } from '../../vendor/a2ui/web_core/schema/common-types';
import {
  Body1,
  Button,
  Card,
  CardHeader,
  Caption1,
  Field,
  Input,
  Select,
  Spinner,
  Subtitle2,
  Switch,
  MessageBar,
  MessageBarBody,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useAPIConnector } from '../../contexts/APIConnectorContext';
import type { AzureARMConnector, AzureLocation } from '@kickstart/core';

const AzureResourceFormApi = {
  name: 'AzureResourceForm',
  schema: z.object({
    title: DynamicStringSchema.optional(),
    subscriptionId: DynamicStringSchema.optional(),
    resourceGroup: DynamicStringSchema.optional(),
    resourceType: DynamicStringSchema.optional(),
    apiVersion: DynamicStringSchema.optional(),
  }).strict(),
};

/** Fallback locations when ARM is unavailable. */
const FALLBACK_LOCATIONS: AzureLocation[] = [
  { name: 'eastus', displayName: 'East US' },
  { name: 'eastus2', displayName: 'East US 2' },
  { name: 'westus', displayName: 'West US' },
  { name: 'westus2', displayName: 'West US 2' },
  { name: 'westeurope', displayName: 'West Europe' },
  { name: 'northeurope', displayName: 'North Europe' },
  { name: 'southeastasia', displayName: 'Southeast Asia' },
  { name: 'australiaeast', displayName: 'Australia East' },
];

const AZURE_SKUS = ['Standard', 'Premium', 'Basic', 'Free'];

/** Describes a dynamically generated form field. */
interface FormFieldDef {
  name: string;
  label: string;
  type: 'string' | 'enum' | 'boolean' | 'integer';
  required: boolean;
  options?: string[];
  description?: string;
}

/** Derive basic field definitions from a resource type name. */
function getDefaultFields(resourceType: string): FormFieldDef[] {
  const typeLower = resourceType.toLowerCase();
  const fields: FormFieldDef[] = [
    { name: 'name', label: 'Resource name', type: 'string', required: true },
  ];

  if (typeLower.includes('managedclusters')) {
    fields.push(
      { name: 'kubernetesVersion', label: 'Kubernetes version', type: 'enum', required: false, options: ['1.31', '1.30', '1.29', '1.28'] },
      { name: 'dnsPrefix', label: 'DNS prefix', type: 'string', required: false },
      { name: 'enableRBAC', label: 'Enable RBAC', type: 'boolean', required: false },
    );
  } else if (typeLower.includes('registries')) {
    fields.push(
      { name: 'adminUserEnabled', label: 'Admin user', type: 'boolean', required: false },
    );
  } else if (typeLower.includes('storageaccounts')) {
    fields.push(
      { name: 'accessTier', label: 'Access tier', type: 'enum', required: false, options: ['Hot', 'Cool', 'Archive'] },
      { name: 'httpsOnly', label: 'HTTPS only', type: 'boolean', required: false },
    );
  }

  return fields;
}

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    width: '100%',
    padding: tokens.spacingHorizontalL,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    marginTop: tokens.spacingVerticalS,
  },
  actions: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    justifyContent: 'flex-end',
    marginTop: tokens.spacingVerticalS,
  },
  successMsg: {
    color: tokens.colorPaletteGreenForeground1,
    marginTop: tokens.spacingVerticalXS,
  },
});

export const AzureResourceForm = createReactComponent(AzureResourceFormApi, ({ props, context }) => {
  const classes = useStyles();
  const connector = useAPIConnector('azure-arm') as AzureARMConnector | undefined;

  const title = props.title ? String(props.title) : 'Create Azure Resource';
  const subscriptionId = props.subscriptionId ? String(props.subscriptionId) : 'stub-subscription-id';
  const resourceGroup = props.resourceGroup ? String(props.resourceGroup) : 'kickstart-rg';
  const resourceType = props.resourceType ? String(props.resourceType) : 'Microsoft.ContainerService/managedClusters';

  const [locations, setLocations] = useState<AzureLocation[]>(FALLBACK_LOCATIONS);
  const [location, setLocation] = useState('eastus');
  const [sku, setSku] = useState('Standard');
  const [formValues, setFormValues] = useState<Record<string, string | boolean>>({});
  const [dynamicFields, setDynamicFields] = useState<FormFieldDef[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [loadingLocations, setLoadingLocations] = useState(false);

  // Fetch real locations when connector is available
  useEffect(() => {
    if (!connector?.isAuthenticated()) return;
    setLoadingLocations(true);
    connector
      .listLocations(subscriptionId)
      .then((locs) => {
        if (locs.length > 0) setLocations(locs);
      })
      .catch(() => { /* keep fallback locations */ })
      .finally(() => setLoadingLocations(false));
  }, [connector, subscriptionId]);

  // Generate dynamic fields based on resource type
  useEffect(() => {
    const fields = getDefaultFields(resourceType);
    setDynamicFields(fields);
    // Initialize form values for new fields
    const initial: Record<string, string | boolean> = {};
    for (const f of fields) {
      if (f.type === 'boolean') initial[f.name] = false;
      else if (f.type === 'enum' && f.options?.length) initial[f.name] = f.options[0];
      else initial[f.name] = '';
    }
    setFormValues(initial);
  }, [resourceType]);

  const setFieldValue = useCallback((name: string, value: string | boolean) => {
    setFormValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  const resourceName = String(formValues['name'] ?? '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resourceName.trim()) return;

    setSubmitting(true);
    setError(undefined);
    setSuccess(false);

    try {
      // Build properties from form values (excluding 'name')
      const properties: Record<string, unknown> = { location, sku };
      for (const [key, val] of Object.entries(formValues)) {
        if (key !== 'name' && val !== '' && val !== false) {
          properties[key] = val;
        }
      }

      await context.dispatchAction({
        event: {
          name: 'api:azure-arm.createResource',
          context: {
            subscriptionId,
            resourceGroup,
            resourceType,
            resourceName: resourceName.trim(),
            location,
            sku,
            ...properties,
          },
        },
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create resource');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setLocation('eastus');
    setSku('Standard');
    setSuccess(false);
    setError(undefined);
    // Reset dynamic fields
    const initial: Record<string, string | boolean> = {};
    for (const f of dynamicFields) {
      if (f.type === 'boolean') initial[f.name] = false;
      else if (f.type === 'enum' && f.options?.length) initial[f.name] = f.options[0];
      else initial[f.name] = '';
    }
    setFormValues(initial);
  };

  const renderField = (field: FormFieldDef) => {
    const value = formValues[field.name];
    switch (field.type) {
      case 'boolean':
        return (
          <Field key={field.name} label={field.label}>
            <Switch
              checked={!!value}
              onChange={(_, data) => setFieldValue(field.name, data.checked)}
              disabled={submitting}
            />
          </Field>
        );
      case 'enum':
        return (
          <Field key={field.name} label={field.label} required={field.required}>
            <Select
              value={String(value ?? '')}
              onChange={(_, data) => setFieldValue(field.name, data.value)}
              disabled={submitting}
            >
              {field.options?.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </Select>
          </Field>
        );
      case 'integer':
      case 'string':
      default:
        return (
          <Field key={field.name} label={field.label} required={field.required}>
            <Input
              type={field.type === 'integer' ? 'number' : 'text'}
              placeholder={field.description ?? `Enter ${field.label.toLowerCase()}`}
              value={String(value ?? '')}
              onChange={(_, data) => setFieldValue(field.name, data.value)}
              disabled={submitting}
            />
          </Field>
        );
    }
  };

  return (
    <Card className={classes.root}>
      <CardHeader header={<Subtitle2>{title}</Subtitle2>} />

      <form onSubmit={handleSubmit} className={classes.form}>
        {dynamicFields.map(renderField)}

        <Field label="Location">
          {loadingLocations ? (
            <Spinner size="tiny" label="Loading locations…" />
          ) : (
            <Select
              value={location}
              onChange={(_, data) => setLocation(data.value)}
              disabled={submitting}
            >
              {locations.map((loc) => (
                <option key={loc.name} value={loc.name}>
                  {loc.displayName}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="SKU">
          <Select
            value={sku}
            onChange={(_, data) => setSku(data.value)}
            disabled={submitting}
          >
            {AZURE_SKUS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>

        <Body1 style={{ color: tokens.colorNeutralForeground3 }}>
          Resource group: <strong>{resourceGroup}</strong> · Type: <strong>{resourceType.split('/').pop()}</strong>
        </Body1>

        {success && (
          <Caption1 className={classes.successMsg}>
            ✓ Resource creation initiated successfully.
          </Caption1>
        )}
        {error && (
          <MessageBar intent="error">
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        )}

        <div className={classes.actions}>
          <Button
            appearance="subtle"
            type="button"
            onClick={handleReset}
            disabled={submitting}
          >
            Reset
          </Button>
          <Button
            appearance="primary"
            type="submit"
            disabled={submitting || !resourceName.trim()}
            icon={submitting ? <Spinner size="tiny" /> : undefined}
          >
            {submitting ? 'Creating…' : 'Create resource'}
          </Button>
        </div>
      </form>

      {!connector && (
        <Caption1 style={{ color: tokens.colorNeutralForeground3, marginTop: tokens.spacingVerticalS }}>
          Running in offline mode — form uses fallback data
        </Caption1>
      )}
    </Card>
  );
});
