import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema, ActionSchema } from '../../vendor/a2ui/web_core/schema/common-types';
import {
  Body2,
  Button,
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
import { useConversationSession } from '../../contexts/ConversationSessionContext';
import type {
  AzureARMConnector,
  AzureLocation,
  AzureResource,
  AzureSubscription,
  AzureResourceGroup,
} from '@kickstart/core';
import { getAzureSession } from '../../services/azure-auth';
import {
  persistAzureTarget,
  startAzureDeployment,
} from '../../services/azure-deployments';
import { isMockMode, isPlaygroundMode } from '../../services/mock-streaming';
import { sanitizeActionContext } from '../../utils/sanitize-action-context';
import { sanitizeAzureUiErrorMessage } from '../../utils/azure-ui-safety';

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

function friendlyType(type: string): string {
  const parts = type.split('/');
  return parts[parts.length - 1] ?? type;
}

function resourceGroupFromId(id: string): string {
  const match = id.match(/resourceGroups\/([^/]+)/i);
  return match?.[1] ?? '—';
}

const STUB_SUBSCRIPTIONS: AzureSubscription[] = [
  {
    subscriptionId: '00000000-0000-0000-0000-000000000001',
    displayName: 'Kickstart Dev Subscription',
    state: 'Enabled',
    tenantId: '00000000-0000-0000-0000-000000000099',
  },
];

const STUB_RESOURCE_GROUPS: AzureResourceGroup[] = [
  {
    id: '/subscriptions/{subscriptionId}/resourceGroups/kickstart-rg',
    name: 'kickstart-rg',
    location: 'eastus',
    provisioningState: 'Succeeded',
  },
  {
    id: '/subscriptions/{subscriptionId}/resourceGroups/networking-rg',
    name: 'networking-rg',
    location: 'eastus2',
    provisioningState: 'Succeeded',
  },
];

const STUB_LOCATIONS: AzureLocation[] = [
  { name: 'eastus', displayName: 'East US' },
  { name: 'eastus2', displayName: 'East US 2' },
  { name: 'westus2', displayName: 'West US 2' },
];

const STUB_RESOURCES: AzureResource[] = [
  {
    id: '/subscriptions/{subscriptionId}/resourceGroups/kickstart-rg/providers/Microsoft.ContainerService/managedClusters/kickstart-aks',
    name: 'kickstart-aks',
    type: 'Microsoft.ContainerService/managedClusters',
    location: 'eastus',
  },
  {
    id: '/subscriptions/{subscriptionId}/resourceGroups/kickstart-rg/providers/Microsoft.ContainerRegistry/registries/kickstartacr',
    name: 'kickstartacr',
    type: 'Microsoft.ContainerRegistry/registries',
    location: 'eastus',
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
  summary: {
    marginTop: tokens.spacingVerticalS,
    color: tokens.colorNeutralForeground2,
  },
  actions: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    justifyContent: 'flex-end',
    marginTop: tokens.spacingVerticalS,
  },
});

const ALLOW_FALLBACK_DATA = isMockMode() || isPlaygroundMode();

export const AzureResourcePicker = createReactComponent(AzureResourcePickerApi, ({ props, context }) => {
  const classes = useStyles();
  const connector = useAPIConnector('azure-arm') as AzureARMConnector | undefined;
  const { backendSessionId } = useConversationSession();

  const label = props.label ? String(props.label) : 'Choose your Azure deployment target';
  const presetSubId = props.subscriptionId ? String(props.subscriptionId) : undefined;
  const presetRg = props.resourceGroup ? String(props.resourceGroup) : undefined;
  const resourceTypeFilter = props.resourceType ? String(props.resourceType) : undefined;
  const isDeploymentTargetMode = !resourceTypeFilter;

  const [subscriptions, setSubscriptions] = useState<AzureSubscription[]>([]);
  const [selectedSubId, setSelectedSubId] = useState<string>(presetSubId ?? '');
  const [resourceGroups, setResourceGroups] = useState<AzureResourceGroup[]>([]);
  const [selectedRg, setSelectedRg] = useState<string>(presetRg ?? '');
  const [locations, setLocations] = useState<AzureLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [resourceGroupMode, setResourceGroupMode] = useState<'existing' | 'new'>('existing');
  const [newResourceGroup, setNewResourceGroup] = useState('');
  const [resources, setResources] = useState<AzureResource[]>([]);
  const [loadingSubs, setLoadingSubs] = useState(false);
  const [loadingRgs, setLoadingRgs] = useState(false);
  const [loadingLocations, setLoadingLocations] = useState(false);
  const [loadingResources, setLoadingResources] = useState(false);
  const [savingTarget, setSavingTarget] = useState(false);
  const [selected, setSelected] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | undefined>();

  const selectedSubscription = useMemo(
    () => subscriptions.find((sub) => sub.subscriptionId === selectedSubId),
    [selectedSubId, subscriptions],
  );

  const selectedResourceGroupName = resourceGroupMode === 'new'
    ? newResourceGroup.trim()
    : selectedRg;

  useEffect(() => {
    let cancelled = false;

    async function loadSubscriptions() {
      setLoadingSubs(true);
      setError(undefined);

      try {
        if (!connector) {
          throw new Error('Azure sign-in is unavailable in this environment.');
        }

        const session = await getAzureSession(connector);
        if (!session.configured) {
          throw new Error(session.error ?? 'Azure sign-in is not configured on the server.');
        }
        if (!session.authenticated) {
          throw new Error('Sign in to Azure before choosing a deployment target.');
        }

        if (cancelled) return;
        setSubscriptions(session.subscriptions);
        if (!presetSubId && session.subscriptions.length === 1) {
          setSelectedSubId(session.subscriptions[0].subscriptionId);
        }
      } catch (loadError) {
        if (cancelled) return;
        if (ALLOW_FALLBACK_DATA) {
          setSubscriptions(STUB_SUBSCRIPTIONS);
          if (!presetSubId && STUB_SUBSCRIPTIONS.length === 1) {
            setSelectedSubId(STUB_SUBSCRIPTIONS[0].subscriptionId);
          }
        } else {
          setSubscriptions([]);
          setError(sanitizeAzureUiErrorMessage(loadError, 'target-load'));
        }
      } finally {
        if (!cancelled) {
          setLoadingSubs(false);
        }
      }
    }

    void loadSubscriptions();

    return () => {
      cancelled = true;
    };
  }, [connector, presetSubId]);

  useEffect(() => {
    if (!selectedSubId) {
      setResourceGroups([]);
      setLocations([]);
      setSelectedRg('');
      setNewResourceGroup('');
      return;
    }

    let cancelled = false;

    setSelectedRg(presetRg ?? '');
    setNewResourceGroup('');
    setSelectedLocation('');
    setResourceGroupMode('existing');

    async function loadTargetContext() {
      setLoadingRgs(true);
      setLoadingLocations(isDeploymentTargetMode);

      try {
        if (!connector) {
          throw new Error('Azure sign-in is unavailable in this environment.');
        }

        const [nextResourceGroups, nextLocations] = await Promise.all([
          connector.listResourceGroups(selectedSubId),
          isDeploymentTargetMode ? connector.listLocations(selectedSubId) : Promise.resolve([] as AzureLocation[]),
        ]);

        if (cancelled) return;

        setResourceGroups(nextResourceGroups);
        setLocations(nextLocations);
        setSelectedLocation((previous) => previous || nextLocations[0]?.name || '');

        if (presetRg) {
          const presetMatch = nextResourceGroups.find((rg) => rg.name.toLowerCase() === presetRg.toLowerCase());
          if (presetMatch) {
            setResourceGroupMode('existing');
            setSelectedRg(presetMatch.name);
            setSelectedLocation((previous) => previous || presetMatch.location || nextLocations[0]?.name || '');
          } else {
            setResourceGroupMode('new');
            setNewResourceGroup(presetRg);
          }
        } else if (nextResourceGroups.length === 0) {
          setResourceGroupMode('new');
        } else if (nextResourceGroups.length === 1) {
          setSelectedRg(nextResourceGroups[0].name);
          setSelectedLocation((previous) => previous || nextResourceGroups[0].location || nextLocations[0]?.name || '');
        }
      } catch (loadError) {
        if (cancelled) return;

        if (ALLOW_FALLBACK_DATA) {
          const fallbackResourceGroups = STUB_RESOURCE_GROUPS.map((rg) => ({
            ...rg,
            id: rg.id.replace('{subscriptionId}', selectedSubId),
          }));
          setResourceGroups(fallbackResourceGroups);
          setLocations(STUB_LOCATIONS);
          setSelectedLocation((previous) => previous || STUB_LOCATIONS[0]?.name || '');
          if (fallbackResourceGroups.length === 1) {
            setSelectedRg(fallbackResourceGroups[0].name);
          }
        } else {
          setResourceGroups([]);
          setLocations([]);
          setError(sanitizeAzureUiErrorMessage(loadError, 'target-load'));
        }
      } finally {
        if (!cancelled) {
          setLoadingRgs(false);
          setLoadingLocations(false);
        }
      }
    }

    void loadTargetContext();

    return () => {
      cancelled = true;
    };
  }, [connector, isDeploymentTargetMode, presetRg, selectedSubId]);

  useEffect(() => {
    if (!isDeploymentTargetMode || !selectedRg || resourceGroupMode !== 'existing') return;

    const matchingGroup = resourceGroups.find((rg) => rg.name === selectedRg);
    if (matchingGroup?.location) {
      setSelectedLocation((previous) => previous || matchingGroup.location);
    }
  }, [isDeploymentTargetMode, resourceGroupMode, resourceGroups, selectedRg]);

  const fetchResources = useCallback(async () => {
    if (!selectedSubId || isDeploymentTargetMode) return;

    setLoadingResources(true);
    setError(undefined);
    try {
      if (!connector) {
        throw new Error('Azure sign-in is unavailable in this environment.');
      }

      const allResources = await connector.listResources(selectedSubId);
      setResources(allResources);
    } catch (loadError) {
      if (ALLOW_FALLBACK_DATA) {
        setResources(STUB_RESOURCES.map((resource) => ({
          ...resource,
          id: resource.id.replace('{subscriptionId}', selectedSubId),
        })));
      } else {
        setError(sanitizeAzureUiErrorMessage(loadError, 'resource-load'));
        setResources([]);
      }
    } finally {
      setLoadingResources(false);
    }
  }, [connector, isDeploymentTargetMode, selectedSubId]);

  useEffect(() => {
    if (!isDeploymentTargetMode && selectedSubId) {
      void fetchResources();
    }
  }, [fetchResources, isDeploymentTargetMode, selectedSubId]);

  const filteredResources = useMemo(() => {
    let result = resources;
    if (selectedRg) {
      result = result.filter((resource) => resourceGroupFromId(resource.id).toLowerCase() === selectedRg.toLowerCase());
    }
    if (resourceTypeFilter) {
      result = result.filter((resource) => resource.type.toLowerCase() === resourceTypeFilter.toLowerCase());
    }
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((resource) =>
        resource.name.toLowerCase().includes(query)
        || friendlyType(resource.type).toLowerCase().includes(query)
        || resource.location.toLowerCase().includes(query));
    }
    return result;
  }, [resourceTypeFilter, resources, searchQuery, selectedRg]);

  const dispatchSelection = useCallback((payload: Record<string, unknown>) => {
    const rawAction = context.componentModel.properties.onSelect;

    if (rawAction && typeof rawAction === 'object' && 'event' in rawAction && rawAction.event) {
      const resolved = context.dataContext.resolveAction(rawAction);
      const safeContext = sanitizeActionContext(resolved.event.context);
      context.dispatchAction({
        event: {
          ...resolved.event,
          context: {
            ...safeContext,
            ...payload,
          },
        },
      });
      return;
    }

    if (props.onSelect) {
      (props.onSelect as () => void)();
    }
  }, [context, props.onSelect]);

  const handleSelectResource = (resource: AzureResource) => {
    setSelected(resource.id);
    dispatchSelection({
      value: resource.id,
      selectedValue: resource.id,
      selectedLabel: resource.name,
      subscriptionId: selectedSubId,
      subscriptionName: selectedSubscription?.displayName,
      resourceGroup: resourceGroupFromId(resource.id),
      resourceId: resource.id,
      resourceName: resource.name,
      resourceType: resource.type,
      location: resource.location,
    });
  };

  const handleStartDeployment = useCallback(async () => {
    if (!backendSessionId) {
      setError('This chat session is not ready to deploy yet. Send a message first so Kickstart can create a backend session.');
      return;
    }

    if (!selectedSubId || !selectedResourceGroupName || !selectedLocation) {
      setError('Choose a subscription, resource group, and region before continuing.');
      return;
    }

    setSavingTarget(true);
    setError(undefined);

    try {
      await persistAzureTarget(backendSessionId, {
        subscriptionId: selectedSubId,
        subscriptionName: selectedSubscription?.displayName,
        resourceGroup: selectedResourceGroupName,
        resourceGroupName: selectedResourceGroupName,
        resourceGroupMode,
        location: selectedLocation,
      });

      const deployment = await startAzureDeployment(backendSessionId);
      if (!deployment.runId || deployment.runId === 'unknown-run') {
        throw new Error('The backend started the deployment without returning a runId.');
      }

      dispatchSelection({
        value: `${selectedSubId}/${selectedResourceGroupName}/${selectedLocation}`,
        selectedValue: `${selectedSubId}/${selectedResourceGroupName}/${selectedLocation}`,
        selectedLabel: `${selectedSubscription?.displayName ?? selectedSubId} · ${selectedResourceGroupName} · ${selectedLocation}`,
        runId: deployment.runId,
        status: deployment.status,
        subscriptionId: selectedSubId,
        subscriptionName: selectedSubscription?.displayName,
        resourceGroup: selectedResourceGroupName,
        resourceGroupMode,
        location: selectedLocation,
      });
    } catch (deploymentError) {
      setError(sanitizeAzureUiErrorMessage(deploymentError, 'deployment-start'));
    } finally {
      setSavingTarget(false);
    }
  }, [
    backendSessionId,
    dispatchSelection,
    resourceGroupMode,
    selectedLocation,
    selectedResourceGroupName,
    selectedSubId,
    selectedSubscription?.displayName,
  ]);

  const canStartDeployment = Boolean(
    backendSessionId
    && selectedSubId
    && selectedResourceGroupName
    && selectedLocation
    && !loadingSubs
    && !loadingRgs
    && !loadingLocations
    && !savingTarget,
  );

  if (isDeploymentTargetMode) {
    return (
      <div className={classes.root}>
        <Caption1 className={classes.label}>{label}</Caption1>

        <div className={classes.cascadeRow}>
          <Field label="Subscription" className={classes.cascadeField}>
            {loadingSubs ? (
              <Spinner size="tiny" label="Loading subscriptions…" />
            ) : (
              <Select
                value={selectedSubId}
                onChange={(_, data) => setSelectedSubId(data.value)}
              >
                <option value="">Select a subscription…</option>
                {subscriptions.map((subscription) => (
                  <option key={subscription.subscriptionId} value={subscription.subscriptionId}>
                    {subscription.displayName}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <Field label="Resource group mode" className={classes.cascadeField}>
            <Select
              value={resourceGroupMode}
              onChange={(_, data) => setResourceGroupMode(data.value === 'new' ? 'new' : 'existing')}
              disabled={resourceGroups.length === 0}
            >
              <option value="existing">Use existing resource group</option>
              <option value="new">Create a new resource group</option>
            </Select>
          </Field>

          <Field label="Region" className={classes.cascadeField}>
            {loadingLocations ? (
              <Spinner size="tiny" label="Loading regions…" />
            ) : (
              <Select
                value={selectedLocation}
                onChange={(_, data) => setSelectedLocation(data.value)}
              >
                <option value="">Select a region…</option>
                {locations.map((location) => (
                  <option key={location.name} value={location.name}>
                    {location.displayName}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>

        {resourceGroupMode === 'new' || resourceGroups.length === 0 ? (
          <Field label="New resource group name">
            <Input
              placeholder="kickstart-rg"
              value={newResourceGroup}
              onChange={(_, data) => setNewResourceGroup(data.value)}
            />
          </Field>
        ) : (
          <Field label="Resource group">
            {loadingRgs ? (
              <Spinner size="tiny" label="Loading resource groups…" />
            ) : (
              <Select
                value={selectedRg}
                onChange={(_, data) => setSelectedRg(data.value)}
              >
                <option value="">Select a resource group…</option>
                {resourceGroups.map((resourceGroup) => (
                  <option key={resourceGroup.name} value={resourceGroup.name}>
                    {resourceGroup.name} ({resourceGroup.location})
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        {error && (
          <MessageBar intent="error" style={{ marginTop: tokens.spacingVerticalS }}>
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        )}

        {(selectedSubId || selectedResourceGroupName || selectedLocation) && (
          <Body2 className={classes.summary}>
            Deploy to{' '}
            <strong>{selectedSubscription?.displayName ?? selectedSubId ?? '—'}</strong>
            {' · '}
            <strong>{selectedResourceGroupName || '—'}</strong>
            {' · '}
            <strong>{selectedLocation || '—'}</strong>
          </Body2>
        )}

        <div className={classes.actions}>
          <Button
            appearance="primary"
            onClick={() => void handleStartDeployment()}
            disabled={!canStartDeployment}
            icon={savingTarget ? <Spinner size="tiny" /> : undefined}
          >
            {savingTarget ? 'Starting deployment…' : 'Start deployment'}
          </Button>
        </div>
      </div>
    );
  }

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
                  {subscriptions.map((subscription) => (
                    <option key={subscription.subscriptionId} value={subscription.subscriptionId}>
                      {subscription.displayName}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          )}

          {showRgDropdown && (
            <Field label="Resource group" className={classes.cascadeField}>
              {loadingRgs ? (
                <Spinner size="tiny" label="Loading…" />
              ) : (
                <Select
                  value={selectedRg}
                  onChange={(_, data) => setSelectedRg(data.value)}
                >
                  <option value="">All resource groups</option>
                  {resourceGroups.map((resourceGroup) => (
                    <option key={resourceGroup.name} value={resourceGroup.name}>
                      {resourceGroup.name} ({resourceGroup.location})
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
              onClick={() => handleSelectResource(resource)}
              role="option"
              aria-selected={selected === resource.id}
            >
              <CardHeader
                header={<Body2 style={{ fontWeight: 600 }}>{resource.name}</Body2>}
                description={(
                  <Caption1>
                    {resourceGroupFromId(resource.id)} · {resource.location}
                  </Caption1>
                )}
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
