import React from 'react';
import { z } from 'zod';
import {
  Body1Strong,
  Card,
  CardHeader,
  Caption1,
  Field,
  MessageBar,
  MessageBarBody,
  Select,
  Spinner,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import type { ComponentContribution } from '@aks-kickstart/harness';

const AzureSubscriptionItemSchema = z.object({
  subscriptionId: z.string(),
  displayName: z.string(),
  state: z.string().optional(),
});

const AzureResourceGroupItemSchema = z.object({
  name: z.string(),
  location: z.string(),
  provisioningState: z.string().optional(),
});

const AzureResourceItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  location: z.string().optional(),
  resourceGroup: z.string().optional(),
});

const AzureResourcePickerSchema = z.object({
  status: z.enum(['idle', 'loading', 'loaded', 'error']).default('idle'),
  label: z.string().optional().describe('Label shown above the picker'),
  subscriptions: z.array(AzureSubscriptionItemSchema).optional(),
  selectedSubscriptionId: z.string().optional(),
  resourceGroups: z.array(AzureResourceGroupItemSchema).optional(),
  selectedResourceGroup: z.string().optional(),
  resources: z.array(AzureResourceItemSchema).optional(),
  selectedResourceId: z.string().optional(),
  resourceType: z.string().optional().describe('Filter by ARM resource type'),
  errorMessage: z.string().optional(),
  isActive: z.boolean().default(true),
});

type AzureResourcePickerProps = z.infer<typeof AzureResourcePickerSchema>;

function friendlyType(type: string): string {
  const parts = type.split('/');
  return parts[parts.length - 1] ?? type;
}

const useStyles = makeStyles({
  root: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    width: '100%',
  },
  cascadeRow: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    flexWrap: 'wrap',
    marginTop: tokens.spacingVerticalS,
  },
  cascadeField: {
    flex: 1,
    minWidth: '200px',
  },
  resourceList: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
    marginTop: tokens.spacingVerticalS,
    maxHeight: '300px',
    overflowY: 'auto',
  },
  resourceItem: {
    padding: tokens.spacingVerticalXS,
    paddingLeft: tokens.spacingHorizontalS,
    borderLeft: `3px solid ${tokens.colorNeutralStroke1}`,
  },
  selectedItem: {
    borderLeftColor: tokens.colorBrandStroke1,
    backgroundColor: tokens.colorBrandBackground2,
  },
  inactive: {
    opacity: 0.6,
    pointerEvents: 'none',
  },
});

export const AzureResourcePickerRenderer: React.FC<{ props: AzureResourcePickerProps }> = ({ props }) => {
  const classes = useStyles();
  const rootClass = props.isActive ? classes.root : `${classes.root} ${classes.inactive}`;

  const isLoading = props.status === 'loading';

  return (
    <div className={rootClass}>
      {props.label && (
        <Text weight="semibold" size={300} style={{ marginBottom: tokens.spacingVerticalS }}>
          {String(props.label)}
        </Text>
      )}

      {props.status === 'error' && props.errorMessage && (
        <MessageBar intent="error">
          <MessageBarBody>{String(props.errorMessage)}</MessageBarBody>
        </MessageBar>
      )}

      {isLoading && <Spinner size="small" label="Loading Azure resources…" />}

      {!isLoading && (
        <div className={classes.cascadeRow}>
          {props.subscriptions && props.subscriptions.length > 0 && (
            <div className={classes.cascadeField}>
              <Field label="Subscription">
                <Select
                  defaultValue={props.selectedSubscriptionId}
                  disabled={!props.isActive}
                >
                  {props.subscriptions.map((sub) => (
                    <option key={sub.subscriptionId} value={sub.subscriptionId}>
                      {String(sub.displayName)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}

          {props.resourceGroups && props.resourceGroups.length > 0 && (
            <div className={classes.cascadeField}>
              <Field label="Resource group">
                <Select
                  defaultValue={props.selectedResourceGroup}
                  disabled={!props.isActive}
                >
                  {props.resourceGroups.map((rg) => (
                    <option key={rg.name} value={rg.name}>
                      {String(rg.name)}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}
        </div>
      )}

      {props.resources && props.resources.length > 0 && !isLoading && (
        <div className={classes.resourceList}>
          {props.resources.map((resource) => {
            const isSelected = resource.id === props.selectedResourceId;
            return (
              <div
                key={resource.id}
                className={`${classes.resourceItem} ${isSelected ? classes.selectedItem : ''}`}
                role="option"
                aria-selected={isSelected}
              >
                <Text size={200} weight={isSelected ? 'semibold' : 'regular'}>
                  {String(resource.name)}
                </Text>
                <Caption1 style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>
                  {props.resourceType
                    ? friendlyType(String(props.resourceType))
                    : friendlyType(resource.type)}{' '}
                  · {resource.resourceGroup ?? resource.location ?? ''}
                </Caption1>
              </div>
            );
          })}
        </div>
      )}

      {!isLoading && props.status === 'loaded' && (!props.resources || props.resources.length === 0) && (
        <Caption1 style={{ color: tokens.colorNeutralForeground3, marginTop: tokens.spacingVerticalS }}>
          No resources found{props.resourceType ? ` of type ${friendlyType(String(props.resourceType))}` : ''}.
        </Caption1>
      )}
    </div>
  );
};

export const azureResourcePickerContribution: ComponentContribution = {
  name: 'azure/AzureResourcePicker',
  propertySchema: AzureResourcePickerSchema,
  renderer: AzureResourcePickerRenderer,
};
