import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema, ActionSchema } from '../../vendor/a2ui/web_core/schema/common-types';
import {
  Body2,
  Caption1,
  Card,
  CardHeader,
  Field,
  Input,
  Select,
  Spinner,
  Badge,
  MessageBar,
  MessageBarBody,
  makeStyles,
  shorthands,
  tokens,
} from '@fluentui/react-components';
import { Search20Regular } from '@fluentui/react-icons';
import { useAPIConnector } from '../../contexts/APIConnectorContext';
import type {
  AzureARMConnector,
  AzureResource,
  AzureSubscription,
  AzureResourceGroup,
} from '@kickstart/core';

const AzureResourcePickerApi = {
  name: 'AzureResourcePicker',
  schema: z.object({
    subscriptionId: DynamicStringSchema.optional(),
    resourceGroup: DynamicStringSchema.optional(),
    resourceType: DynamicStringSchema.optional(),
    label: DynamicStringSchema.optional(),
    onSelect: ActionSchema.optional(),
  }).strict(),
};

/** Friendly display name for ARM resource type strings. */
function friendlyType(type: string): string {
  const parts = type.split('/');
  return parts[parts.length - 1] ?? type;
}

/** Extract resource group name from ARM resource ID. */
function resourceGroupFromId(id: string): string {
  const match = id.match(/resourceGroups\/([^/]+)/i);
  return match?.[1] ?? '—';
}

/** Stub subscriptions for offline mode. */
const STUB_SUBSCRIPTIONS: AzureSubscription[] = [
  {
    subscriptionId: '00000000-0000-0000-0000-000000000001',
    displayName: 'Kickstart Dev Subscription',
    state: 'Enabled',
    tenantId: '00000000-0000-0000-0000-000000000099',
  },
];

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    width: '100%',
  },
  label: {
    marginBottom: tokens.spacingVerticalS,
  },
  cascadeRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    marginBottom: tokens.spacingVerticalS,
    flexWrap: 'wrap',
  },
  cascadeField: {
    flex: 1,
    minWidth: '200px',
  },
  searchRow: {
    marginBottom: tokens.spacingVerticalS,
  },
  resourceList: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  resourceCard: {
    cursor: 'pointer',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    width: '100%',
  },
  resourceCardSelected: {
    cursor: 'pointer',
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    width: '100%',
    ...shorthands.borderColor(tokens.colorBrandStroke1),
    ...shorthands.borderWidth(tokens.strokeWidthThick),
  },
  metaRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalXXS,
    flexWrap: 'wrap',
  },
  spinnerRow: {
    display: 'flex',
    justifyContent: 'center',
    padding: tokens.spacingVerticalL,
  },
  emptyText: {
    textAlign: 'center',
    color: tokens.colorNeutralForeground3,
    padding: tokens.spacingVerticalM,
  },
});

export const AzureResourcePicker = createReactComponent(AzureResourcePickerApi, ({ props }) => {
  const classes = useStyles();
  const connector = useAPIConnector('azure-arm') as AzureARMConnector | undefined;

  const label = props.label ? String(props.label) : 'Select an Azure resource';
  const presetSubId = props.subscriptionId ? String(props.subscriptionId) : undefined;
  const presetRg = props.resourceGroup ? String(props.resourceGroup) : undefined;
  const resourceTypeFilter = props.resourceType ? String(props.resourceType) : undefined;

  // Cascading state
  const [subscriptions, setSubscriptions] = useState<AzureSubscription[]>([]);
  const [selectedSubId, setSelectedSubId] = useState<string>(presetSubId ?? '');
  const [resourceGroups, setResourceGroups] = useState<AzureResourceGroup[]>([]);
  const [selectedRg, setSelectedRg] = useState<string>(presetRg ?? '');
  const [resources, setResources] = useState<AzureResource[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [loadingRgs, setLoadingRgs] = useState(false);
  const [loadingResources, setLoadingResources] = useState(false);
  const [selected, setSelected] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | undefined>();

  // Load subscriptions on mount (if no preset subscription)
  useEffect(() => {
    if (presetSubId) {
      setSelectedSubId(presetSubId);
      return;
    }
    if (!connector) {
      setSubscriptions(STUB_SUBSCRIPTIONS);
      if (STUB_SUBSCRIPTIONS.length === 1) {
        setSelectedSubId(STUB_SUBSCRIPTIONS[0].subscriptionId);
      }
      return;
    }

    setLoadingSubs(true);
    connector
      .listSubscriptions()
      .then((subs) => {
        setSubscriptions(subs);
        // Auto-select if only one subscription
        if (subs.length === 1) {
          setSelectedSubId(subs[0].subscriptionId);
        }
      })
      .catch(() => {
        setSubscriptions(STUB_SUBSCRIPTIONS);
        if (STUB_SUBSCRIPTIONS.length === 1) {
          setSelectedSubId(STUB_SUBSCRIPTIONS[0].subscriptionId);
        }
      })
      .finally(() => setLoadingSubs(false));
  }, [connector, presetSubId]);

  // Load resource groups when subscription changes
  useEffect(() => {
    if (!selectedSubId) {
      setResourceGroups([]);
      setSelectedRg('');
      return;
    }
    if (presetRg) {
      setSelectedRg(presetRg);
      return;
    }
    if (!connector) {
      // Stub mode resource groups
      setResourceGroups([
        { id: `/subscriptions/${selectedSubId}/resourceGroups/kickstart-rg`, name: 'kickstart-rg', location: 'eastus', provisioningState: 'Succeeded' },
        { id: `/subscriptions/${selectedSubId}/resourceGroups/networking-rg`, name: 'networking-rg', location: 'eastus', provisioningState: 'Succeeded' },
      ]);
      return;
    }

    setLoadingRgs(true);
    setSelectedRg('');
    connector
      .listResourceGroups(selectedSubId)
      .then((rgs) => {
        setResourceGroups(rgs);
        if (rgs.length === 1) {
          setSelectedRg(rgs[0].name);
        }
      })
      .catch(() => setResourceGroups([]))
      .finally(() => setLoadingRgs(false));
  }, [connector, selectedSubId, presetRg]);

  // Load resources when subscription + RG are selected
  const fetchResources = useCallback(async () => {
    if (!selectedSubId) return;

    setLoadingResources(true);
    setError(undefined);
    try {
      if (!connector) {
        // Stub resources
        setResources([
          {
            id: `/subscriptions/${selectedSubId}/resourceGroups/${selectedRg || 'kickstart-rg'}/providers/Microsoft.ContainerService/managedClusters/kickstart-aks`,
            name: 'kickstart-aks',
            type: 'Microsoft.ContainerService/managedClusters',
            location: 'eastus',
          },
          {
            id: `/subscriptions/${selectedSubId}/resourceGroups/${selectedRg || 'kickstart-rg'}/providers/Microsoft.ContainerRegistry/registries/kickstartacr`,
            name: 'kickstartacr',
            type: 'Microsoft.ContainerRegistry/registries',
            location: 'eastus',
          },
        ]);
        return;
      }

      const allResources = await connector.listResources(selectedSubId);
      setResources(allResources);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load resources');
      setResources([]);
    } finally {
      setLoadingResources(false);
    }
  }, [connector, selectedSubId, selectedRg]);

  useEffect(() => {
    if (selectedSubId) {
      fetchResources();
    }
  }, [selectedSubId, selectedRg, fetchResources]);

  // Filter resources by resource group and type
  const filteredResources = useMemo(() => {
    let result = resources;
    if (selectedRg) {
      result = result.filter((r) => resourceGroupFromId(r.id).toLowerCase() === selectedRg.toLowerCase());
    }
    if (resourceTypeFilter) {
      result = result.filter((r) => r.type.toLowerCase() === resourceTypeFilter.toLowerCase());
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          friendlyType(r.type).toLowerCase().includes(q) ||
          r.location.toLowerCase().includes(q),
      );
    }
    return result;
  }, [resources, selectedRg, resourceTypeFilter, searchQuery]);

  const handleSelect = (resource: AzureResource) => {
    setSelected(resource.id);
    if (props.onSelect) (props.onSelect as () => void)();
  };

  const showSubDropdown = !presetSubId && subscriptions.length > 1;
  const showRgDropdown = !presetRg && resourceGroups.length > 0;

  return (
    <div className={classes.root}>
      <Caption1 className={classes.label}>{label}</Caption1>

      {(showSubDropdown || showRgDropdown) && (
        <div className={classes.cascadeRow}>
          {showSubDropdown && (
            <Field label="Subscription" className={classes.cascadeField}>
              {loadingSubs ? (
                <Spinner size="tiny" label="Loading…" />
              ) : (
                <Select
                  value={selectedSubId}
                  onChange={(_, data) => setSelectedSubId(data.value)}
                >
                  <option value="">Select a subscription…</option>
                  {subscriptions.map((sub) => (
                    <option key={sub.subscriptionId} value={sub.subscriptionId}>
                      {sub.displayName}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}

          {showRgDropdown && (
            <Field label="Resource Group" className={classes.cascadeField}>
              {loadingRgs ? (
                <Spinner size="tiny" label="Loading…" />
              ) : (
                <Select
                  value={selectedRg}
                  onChange={(_, data) => setSelectedRg(data.value)}
                >
                  <option value="">All resource groups</option>
                  {resourceGroups.map((rg) => (
                    <option key={rg.name} value={rg.name}>
                      {rg.name} ({rg.location})
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}
        </div>
      )}

      {selectedSubId && (
        <div className={classes.searchRow}>
          <Input
            contentBefore={<Search20Regular />}
            placeholder="Search resources…"
            value={searchQuery}
            onChange={(_, data) => setSearchQuery(data.value)}
            style={{ width: '100%' }}
          />
        </div>
      )}

      {error && (
        <MessageBar intent="error" style={{ marginBottom: tokens.spacingVerticalS }}>
          <MessageBarBody>{error}</MessageBarBody>
        </MessageBar>
      )}

      {loadingResources ? (
        <div className={classes.spinnerRow}>
          <Spinner size="small" label="Loading resources…" />
        </div>
      ) : !selectedSubId ? (
        <Caption1 className={classes.emptyText}>Select a subscription to browse resources.</Caption1>
      ) : filteredResources.length === 0 ? (
        <Caption1 className={classes.emptyText}>No resources found.</Caption1>
      ) : (
        <div className={classes.resourceList}>
          {filteredResources.map((resource) => (
            <Card
              key={resource.id}
              className={selected === resource.id ? classes.resourceCardSelected : classes.resourceCard}
              onClick={() => handleSelect(resource)}
              role="option"
              aria-selected={selected === resource.id}
            >
              <CardHeader
                header={<Body2 style={{ fontWeight: 600 }}>{resource.name}</Body2>}
                description={
                  <Caption1>
                    {resourceGroupFromId(resource.id)} · {resource.location}
                  </Caption1>
                }
              />
              <div className={classes.metaRow}>
                <Badge appearance="outline" color="informative" size="small">
                  {friendlyType(resource.type)}
                </Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
});
