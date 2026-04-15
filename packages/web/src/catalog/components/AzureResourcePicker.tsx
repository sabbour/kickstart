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
import { useConversationSession } from '../../contexts/ConversationSessionContext';
import type {
  AzureLocation,
  AzureResource,
  AzureSubscription,
  AzureResourceGroup,
} from '@kickstart/core';
import { getAzureSession } from '../../services/azure-auth';
import {
  AZURE_DISCOVERY_FALLBACK_MESSAGE,
  AzureDiscoveryUnavailableError,
  listAzureLocations,
  listAzureResourceGroups,
  listAzureResources,
  listAzureSubscriptions,
} from '../../services/azure-resources';
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

const NO_SUBSCRIPTIONS_MESSAGE = 'No Azure subscriptions were returned for this Microsoft account.';

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
  const [notice, setNotice] = useState<string | undefined>();
  const [subscriptionDiscoveryUnavailable, setSubscriptionDiscoveryUnavailable] = useState(false);
  const [resourceGroupDiscoveryUnavailable, setResourceGroupDiscoveryUnavailable] = useState(false);
  const [locationDiscoveryUnavailable, setLocationDiscoveryUnavailable] = useState(false);

  const selectedSubscriptionId = selectedSubId.trim();
  const selectedLocationValue = selectedLocation.trim();
  const normalizedSelectedRg = selectedRg.trim();

  const selectedSubscription = useMemo(
    () => subscriptions.find((sub) => sub.subscriptionId === selectedSubscriptionId),
    [selectedSubscriptionId, subscriptions],
  );

  const selectedResourceGroupName = resourceGroupMode === 'new'
    ? newResourceGroup.trim()
    : normalizedSelectedRg;

  useEffect(() => {
    let cancelled = false;

    async function loadSubscriptions() {
      setLoadingSubs(true);
      setError(undefined);
      setNotice(undefined);
      setSubscriptionDiscoveryUnavailable(false);

      try {
        const session = await getAzureSession();
        if (!session.configured) {
          throw new Error(session.error ?? 'Azure sign-in is unavailable in this environment.');
        }
        if (!session.authenticated) {
          throw new Error('Sign in to Azure before choosing a deployment target.');
        }

        const nextSubscriptions = await listAzureSubscriptions();
        if (cancelled) return;

        setSubscriptions(nextSubscriptions);
        if (!presetSubId && nextSubscriptions.length === 1) {
          setSelectedSubId(nextSubscriptions[0].subscriptionId);
        }
        if (!presetSubId && nextSubscriptions.length === 0) {
          setNotice(NO_SUBSCRIPTIONS_MESSAGE);
        }
      } catch (loadError) {
        if (cancelled) return;

        if (ALLOW_FALLBACK_DATA) {
          setSubscriptions(STUB_SUBSCRIPTIONS);
          if (!presetSubId && STUB_SUBSCRIPTIONS.length === 1) {
            setSelectedSubId(STUB_SUBSCRIPTIONS[0].subscriptionId);
          }
          return;
        }

        if (loadError instanceof AzureDiscoveryUnavailableError) {
          setSubscriptions([]);
          setSubscriptionDiscoveryUnavailable(true);
          setNotice(AZURE_DISCOVERY_FALLBACK_MESSAGE);
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
  }, [presetSubId]);

  useEffect(() => {
    if (!selectedSubscriptionId) {
      setResourceGroups([]);
      setLocations([]);
      setResources([]);
      setSelected('');
      setSelectedRg('');
      setNewResourceGroup('');
      setSelectedLocation('');
      setResourceGroupDiscoveryUnavailable(false);
      setLocationDiscoveryUnavailable(false);
      return;
    }

    let cancelled = false;

    async function loadTargetContext() {
      setLoadingRgs(true);
      setLoadingLocations(isDeploymentTargetMode);
      setError(undefined);
      setSelected('');
      setSelectedRg('');
      setNewResourceGroup('');
      setSelectedLocation('');
      setResourceGroupMode('existing');
      setResourceGroupDiscoveryUnavailable(false);
      setLocationDiscoveryUnavailable(false);

      try {
        const [resourceGroupsResult, locationsResult] = await Promise.allSettled([
          listAzureResourceGroups(selectedSubscriptionId),
          isDeploymentTargetMode ? listAzureLocations(selectedSubscriptionId) : Promise.resolve([] as AzureLocation[]),
        ]);

        if (cancelled) return;

        let nextResourceGroups: AzureResourceGroup[] = [];
        let nextLocations: AzureLocation[] = [];
        let nextNotice = subscriptionDiscoveryUnavailable ? AZURE_DISCOVERY_FALLBACK_MESSAGE : undefined;
        let nextError: string | undefined;

        if (resourceGroupsResult.status === 'fulfilled') {
          nextResourceGroups = resourceGroupsResult.value;
        } else if (resourceGroupsResult.reason instanceof AzureDiscoveryUnavailableError) {
          setResourceGroupDiscoveryUnavailable(true);
          nextNotice = AZURE_DISCOVERY_FALLBACK_MESSAGE;
        } else {
          nextError = sanitizeAzureUiErrorMessage(resourceGroupsResult.reason, 'target-load');
        }

        if (locationsResult.status === 'fulfilled') {
          nextLocations = locationsResult.value;
        } else if (locationsResult.reason instanceof AzureDiscoveryUnavailableError) {
          setLocationDiscoveryUnavailable(true);
          nextNotice = AZURE_DISCOVERY_FALLBACK_MESSAGE;
        } else if (!nextError) {
          nextError = sanitizeAzureUiErrorMessage(locationsResult.reason, 'target-load');
        }

        setResourceGroups(nextResourceGroups);
        setLocations(nextLocations);
        setNotice(nextError ? undefined : nextNotice);
        setError(nextError);

        const defaultLocation = nextLocations[0]?.name ?? '';

        if (presetRg) {
          const presetMatch = nextResourceGroups.find((rg) => rg.name.toLowerCase() === presetRg.toLowerCase());
          if (presetMatch) {
            setResourceGroupMode('existing');
            setSelectedRg(presetMatch.name);
            setSelectedLocation(presetMatch.location || defaultLocation);
            return;
          }

          setResourceGroupMode('new');
          setNewResourceGroup(presetRg);
          setSelectedLocation(defaultLocation);
          return;
        }

        if (nextResourceGroups.length === 0) {
          setResourceGroupMode('new');
          setSelectedLocation(defaultLocation);
          return;
        }

        if (nextResourceGroups.length === 1) {
          setSelectedRg(nextResourceGroups[0].name);
          setSelectedLocation(nextResourceGroups[0].location || defaultLocation);
          return;
        }

        setSelectedLocation(defaultLocation);
      } catch (loadError) {
        if (cancelled) return;

        if (ALLOW_FALLBACK_DATA) {
          const fallbackResourceGroups = STUB_RESOURCE_GROUPS.map((rg) => ({
            ...rg,
            id: rg.id.replace('{subscriptionId}', selectedSubscriptionId),
          }));
          setResourceGroups(fallbackResourceGroups);
          setLocations(STUB_LOCATIONS);
          setSelectedLocation(STUB_LOCATIONS[0]?.name ?? '');
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
  }, [isDeploymentTargetMode, presetRg, selectedSubscriptionId, subscriptionDiscoveryUnavailable]);

  useEffect(() => {
    if (!isDeploymentTargetMode || !normalizedSelectedRg || resourceGroupMode !== 'existing') return;

    const matchingGroup = resourceGroups.find((rg) => rg.name === normalizedSelectedRg);
    if (matchingGroup?.location) {
      setSelectedLocation((previous) => previous || matchingGroup.location);
    }
  }, [isDeploymentTargetMode, normalizedSelectedRg, resourceGroupMode, resourceGroups]);

  const fetchResources = useCallback(async () => {
    if (!selectedSubscriptionId || isDeploymentTargetMode) return;

    setLoadingResources(true);
    setError(undefined);
    try {
      const allResources = await listAzureResources({
        subscriptionId: selectedSubscriptionId,
        resourceGroup: normalizedSelectedRg || undefined,
        resourceType: resourceTypeFilter,
      });
      setResources(allResources);
    } catch (loadError) {
      if (ALLOW_FALLBACK_DATA) {
        setResources(STUB_RESOURCES.map((resource) => ({
          ...resource,
          id: resource.id.replace('{subscriptionId}', selectedSubscriptionId),
        })));
      } else {
        setError(sanitizeAzureUiErrorMessage(loadError, 'resource-load'));
        setResources([]);
      }
    } finally {
      setLoadingResources(false);
    }
  }, [isDeploymentTargetMode, normalizedSelectedRg, resourceTypeFilter, selectedSubscriptionId]);

  useEffect(() => {
    if (!isDeploymentTargetMode && selectedSubscriptionId) {
      void fetchResources();
    }
  }, [fetchResources, isDeploymentTargetMode, selectedSubscriptionId]);

  const filteredResources = useMemo(() => {
    let result = resources;
    if (normalizedSelectedRg) {
      result = result.filter((resource) => resourceGroupFromId(resource.id).toLowerCase() === normalizedSelectedRg.toLowerCase());
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
  }, [normalizedSelectedRg, resourceTypeFilter, resources, searchQuery]);

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
      subscriptionId: selectedSubscriptionId,
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

    if (!selectedSubscriptionId || !selectedResourceGroupName || !selectedLocationValue) {
      setError('Choose a subscription, resource group, and region before continuing.');
      return;
    }

    setSavingTarget(true);
    setError(undefined);

    try {
      await persistAzureTarget(backendSessionId, {
        subscriptionId: selectedSubscriptionId,
        subscriptionName: selectedSubscription?.displayName,
        resourceGroup: selectedResourceGroupName,
        resourceGroupName: selectedResourceGroupName,
        resourceGroupMode,
        location: selectedLocationValue,
      });

      const deployment = await startAzureDeployment(backendSessionId);
      if (!deployment.runId || deployment.runId === 'unknown-run') {
        throw new Error('The backend started the deployment without returning a runId.');
      }

      dispatchSelection({
        value: `${selectedSubscriptionId}/${selectedResourceGroupName}/${selectedLocationValue}`,
        selectedValue: `${selectedSubscriptionId}/${selectedResourceGroupName}/${selectedLocationValue}`,
        selectedLabel: `${selectedSubscription?.displayName ?? selectedSubscriptionId} · ${selectedResourceGroupName} · ${selectedLocationValue}`,
        runId: deployment.runId,
        status: deployment.status,
        subscriptionId: selectedSubscriptionId,
        subscriptionName: selectedSubscription?.displayName,
        resourceGroup: selectedResourceGroupName,
        resourceGroupMode,
        location: selectedLocationValue,
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
    selectedLocationValue,
    selectedResourceGroupName,
    selectedSubscription?.displayName,
    selectedSubscriptionId,
  ]);

  const canStartDeployment = Boolean(
    backendSessionId
    && selectedSubscriptionId
    && selectedResourceGroupName
    && selectedLocationValue
    && !loadingSubs
    && !loadingRgs
    && !loadingLocations
    && !savingTarget,
  );

  const showManualSubscriptionInput = subscriptionDiscoveryUnavailable
    || (Boolean(presetSubId) && subscriptions.length === 0);
  const showSubscriptionSelect = !showManualSubscriptionInput && subscriptions.length > 0;
  const showNoSubscriptionsMessage = !showManualSubscriptionInput && subscriptions.length === 0;

  if (isDeploymentTargetMode) {
    return (
      <div className={classes.root}>
        <Caption1 className={classes.label}>{label}</Caption1>

        <div className={classes.cascadeRow}>
          <Field label="Subscription" className={classes.cascadeField}>
            {loadingSubs ? (
              <Spinner size="tiny" label="Loading subscriptions…" />
            ) : showManualSubscriptionInput ? (
              <Input
                placeholder="00000000-0000-0000-0000-000000000000"
                value={selectedSubId}
                onChange={(_, data) => setSelectedSubId(data.value)}
              />
            ) : showNoSubscriptionsMessage ? (
              <Caption1>{NO_SUBSCRIPTIONS_MESSAGE}</Caption1>
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
              disabled={!selectedSubscriptionId}
            >
              <option value="existing">Use existing resource group</option>
              <option value="new">Create a new resource group</option>
            </Select>
          </Field>

          <Field label="Region" className={classes.cascadeField}>
            {loadingLocations ? (
              <Spinner size="tiny" label="Loading regions…" />
            ) : locationDiscoveryUnavailable || locations.length === 0 ? (
              <Input
                placeholder="eastus"
                value={selectedLocation}
                onChange={(_, data) => setSelectedLocation(data.value)}
              />
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

        {resourceGroupMode === 'new' || resourceGroups.length === 0 || resourceGroupDiscoveryUnavailable ? (
          <Field label={resourceGroupMode === 'new' ? 'New resource group name' : 'Resource group name'}>
            <Input
              placeholder="kickstart-rg"
              value={resourceGroupMode === 'new' ? newResourceGroup : selectedRg}
              onChange={(_, data) => {
                if (resourceGroupMode === 'new') {
                  setNewResourceGroup(data.value);
                } else {
                  setSelectedRg(data.value);
                }
              }}
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

        {notice && (
          <MessageBar intent="warning" style={{ marginTop: tokens.spacingVerticalS }}>
            <MessageBarBody>{notice}</MessageBarBody>
          </MessageBar>
        )}

        {error && (
          <MessageBar intent="error" style={{ marginTop: tokens.spacingVerticalS }}>
            <MessageBarBody>{error}</MessageBarBody>
          </MessageBar>
        )}

        {(selectedSubscriptionId || selectedResourceGroupName || selectedLocationValue) && (
          <Body2 className={classes.summary}>
            Deploy to{' '}
            <strong>{selectedSubscription?.displayName ?? selectedSubscriptionId ?? '—'}</strong>
            {' · '}
            <strong>{selectedResourceGroupName || '—'}</strong>
            {' · '}
            <strong>{selectedLocationValue || '—'}</strong>
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

  const showSubDropdown = !presetSubId && showSubscriptionSelect && subscriptions.length > 1;
  const showManualSubscriptionField = !presetSubId && showManualSubscriptionInput;
  const showRgDropdown = !presetRg && resourceGroups.length > 0 && !resourceGroupDiscoveryUnavailable;
  const showManualRgField = !presetRg && resourceGroupDiscoveryUnavailable;

  return (
    <div className={classes.root}>
      <Caption1 className={classes.label}>{label}</Caption1>

      {(showSubDropdown || showManualSubscriptionField || showRgDropdown || showManualRgField) && (
        <div className={classes.cascadeRow}>
          {(showSubDropdown || showManualSubscriptionField) && (
            <Field label="Subscription" className={classes.cascadeField}>
              {loadingSubs ? (
                <Spinner size="tiny" label="Loading…" />
              ) : showManualSubscriptionField ? (
                <Input
                  placeholder="00000000-0000-0000-0000-000000000000"
                  value={selectedSubId}
                  onChange={(_, data) => setSelectedSubId(data.value)}
                />
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

          {(showRgDropdown || showManualRgField) && (
            <Field label="Resource group" className={classes.cascadeField}>
              {loadingRgs ? (
                <Spinner size="tiny" label="Loading…" />
              ) : showManualRgField ? (
                <Input
                  placeholder="my-resource-group"
                  value={selectedRg}
                  onChange={(_, data) => setSelectedRg(data.value)}
                />
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

      {selectedSubscriptionId && (
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

      {notice && (
        <MessageBar intent="warning" style={{ marginBottom: tokens.spacingVerticalS }}>
          <MessageBarBody>{notice}</MessageBarBody>
        </MessageBar>
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
      ) : !selectedSubscriptionId ? (
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
