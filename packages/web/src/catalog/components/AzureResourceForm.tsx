import React, { useState } from 'react';
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
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import { useAPIConnector } from '../../contexts/APIConnectorContext';
import type { AzureARMConnector } from '@kickstart/core';

const AzureResourceFormApi = {
  name: 'AzureResourceForm',
  schema: z.object({
    title: DynamicStringSchema.optional(),
    subscriptionId: DynamicStringSchema.optional(),
    resourceGroup: DynamicStringSchema.optional(),
    resourceType: DynamicStringSchema.optional(),
  }).strict(),
};

const AZURE_LOCATIONS = [
  { value: 'eastus', label: 'East US' },
  { value: 'eastus2', label: 'East US 2' },
  { value: 'westus', label: 'West US' },
  { value: 'westus2', label: 'West US 2' },
  { value: 'westeurope', label: 'West Europe' },
  { value: 'northeurope', label: 'North Europe' },
  { value: 'southeastasia', label: 'Southeast Asia' },
  { value: 'australiaeast', label: 'Australia East' },
];

const AZURE_SKUS = ['Standard', 'Premium', 'Basic', 'Free'];

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
  errorMsg: {
    color: tokens.colorPaletteRedForeground1,
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

  const [name, setName] = useState('');
  const [location, setLocation] = useState('eastus');
  const [sku, setSku] = useState('Standard');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    setError(undefined);
    setSuccess(false);

    try {
      await context.dispatchAction({
        event: {
          name: 'api:azure-arm.createResource',
          context: {
            subscriptionId,
            resourceGroup,
            resourceType,
            resourceName: name.trim(),
            location,
            sku,
          },
        },
      });
      setSuccess(true);
      setName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create resource');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setName('');
    setLocation('eastus');
    setSku('Standard');
    setSuccess(false);
    setError(undefined);
  };

  return (
    <Card className={classes.root}>
      <CardHeader header={<Subtitle2>{title}</Subtitle2>} />

      <form onSubmit={handleSubmit} className={classes.form}>
        <Field label="Resource name" required>
          <Input
            placeholder="e.g. my-aks-cluster"
            value={name}
            onChange={(_, data) => setName(data.value)}
            disabled={submitting}
          />
        </Field>

        <Field label="Location">
          <Select
            value={location}
            onChange={(_, data) => setLocation(data.value)}
            disabled={submitting}
          >
            {AZURE_LOCATIONS.map((loc) => (
              <option key={loc.value} value={loc.value}>
                {loc.label}
              </option>
            ))}
          </Select>
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
          <Caption1 className={classes.errorMsg}>{error}</Caption1>
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
            disabled={submitting || !name.trim()}
            icon={submitting ? <Spinner size="tiny" /> : undefined}
          >
            {submitting ? 'Creating…' : 'Create resource'}
          </Button>
        </div>
      </form>
    </Card>
  );
});
