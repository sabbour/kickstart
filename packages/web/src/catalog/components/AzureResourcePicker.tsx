import React, { useEffect, useState } from 'react';
import { createReactComponent } from '../../vendor/a2ui/react/adapter';
import { z } from 'zod';
import { DynamicStringSchema, ActionSchema } from '../../vendor/a2ui/web_core/schema/common-types';
import {
  Body2,
  Caption1,
  Card,
  CardHeader,
  Spinner,
  Badge,
  makeStyles,
  shorthands,
  tokens,
} from '@fluentui/react-components';
import { useAPIConnector } from '../../contexts/APIConnectorContext';
import type { AzureARMConnector, AzureResource } from '@kickstart/core';

const AzureResourcePickerApi = {
  name: 'AzureResourcePicker',
  schema: z.object({
    subscriptionId: DynamicStringSchema.optional(),
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

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    width: '100%',
  },
  label: {
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

  const subscriptionId = props.subscriptionId ? String(props.subscriptionId) : 'stub-subscription-id';
  const label = props.label ? String(props.label) : 'Select an Azure resource';

  const [resources, setResources] = useState<AzureResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string>('');

  useEffect(() => {
    if (!connector) return;
    setLoading(true);
    connector
      .listResources(subscriptionId)
      .then(setResources)
      .catch(() => setResources([]))
      .finally(() => setLoading(false));
  }, [connector, subscriptionId]);

  const handleSelect = (resource: AzureResource) => {
    setSelected(resource.id);
    if (props.onSelect) (props.onSelect as () => void)();
  };

  return (
    <div className={classes.root}>
      <Caption1 className={classes.label}>{label}</Caption1>

      {loading ? (
        <div className={classes.spinnerRow}>
          <Spinner size="small" label="Loading resources…" />
        </div>
      ) : resources.length === 0 ? (
        <Caption1 className={classes.emptyText}>No resources found.</Caption1>
      ) : (
        <div className={classes.resourceList}>
          {resources.map((resource) => (
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
