import React from 'react';
import { z } from 'zod';
import {
  Body1Strong,
  Button,
  Card,
  CardHeader,
  Caption1,
  Field,
  Input,
  Select,
  Spinner,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import type { ComponentContribution } from '@aks-kickstart/harness';

const AzureLocationSchema = z.object({
  name: z.string(),
  displayName: z.string(),
});

const AzureResourceFormSchema = z.object({
  status: z.enum(['idle', 'loading', 'success', 'error']).default('idle'),
  title: z.string().optional().describe('Form title'),
  subscriptionId: z.string().optional(),
  resourceGroup: z.string().optional(),
  resourceType: z.string().optional().describe('ARM resource type, e.g. Microsoft.ContainerService/managedClusters'),
  locations: z.array(AzureLocationSchema).optional().describe('Available Azure locations'),
  selectedLocation: z.string().optional(),
  errorMessage: z.string().optional(),
  isActive: z.boolean().default(true),
});

type AzureResourceFormProps = z.infer<typeof AzureResourceFormSchema>;

const useStyles = makeStyles({
  card: {
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalL,
    width: '100%',
  },
  formFields: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    marginTop: tokens.spacingVerticalS,
  },
  meta: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
    marginTop: tokens.spacingVerticalS,
    padding: tokens.spacingHorizontalS,
    backgroundColor: tokens.colorNeutralBackground3,
    borderRadius: tokens.borderRadiusMedium,
  },
  actions: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    marginTop: tokens.spacingVerticalM,
    alignItems: 'center',
  },
  inactive: {
    opacity: 0.6,
    pointerEvents: 'none',
  },
});

export const AzureResourceFormRenderer: React.FC<{
  props: AzureResourceFormProps;
  dispatchAction?: (action: unknown) => void;
}> = ({ props, dispatchAction }) => {
  const classes = useStyles();
  const cardClass = props.isActive ? classes.card : `${classes.card} ${classes.inactive}`;

  const isLoading = props.status === 'loading';
  const title = props.title ?? (props.resourceType
    ? `Create ${props.resourceType.split('/').pop() ?? 'Resource'}`
    : 'Create Azure Resource');

  return (
    <Card className={cardClass}>
      <CardHeader header={<Body1Strong>{title}</Body1Strong>} />

      {props.status === 'error' && props.errorMessage && (
        <div style={{ marginTop: tokens.spacingVerticalS }}>
          <Text size={200} style={{ color: tokens.colorPaletteRedForeground1 }}>
            {String(props.errorMessage)}
          </Text>
        </div>
      )}

      {(props.subscriptionId || props.resourceGroup) && (
        <div className={classes.meta}>
          {props.subscriptionId && (
            <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
              Subscription: {String(props.subscriptionId)}
            </Caption1>
          )}
          {props.resourceGroup && (
            <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
              Resource group: {String(props.resourceGroup)}
            </Caption1>
          )}
          {props.resourceType && (
            <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
              Type: {String(props.resourceType)}
            </Caption1>
          )}
        </div>
      )}

      <div className={classes.formFields}>
        <Field label="Resource name">
          <Input
            disabled={isLoading || !props.isActive}
            placeholder="my-resource-name"
            aria-label="Resource name"
          />
        </Field>

        {props.locations && props.locations.length > 0 && (
          <Field label="Location">
            <Select
              defaultValue={props.selectedLocation ?? props.locations[0]?.name}
              disabled={isLoading || !props.isActive}
            >
              {props.locations.map((loc) => (
                <option key={loc.name} value={loc.name}>
                  {loc.displayName}
                </option>
              ))}
            </Select>
          </Field>
        )}
      </div>

      <div className={classes.actions}>
        {isLoading && <Spinner size="small" label="Creating resource…" />}
        {!isLoading && props.status !== 'success' && (
          <Button
            appearance="primary"
            disabled={!props.isActive}
            onClick={() => dispatchAction?.({ event: { name: 'azure:resource_form:create' } })}
          >
            Create
          </Button>
        )}
        {props.status === 'success' && (
          <Text size={200} style={{ color: tokens.colorPaletteGreenForeground1 }}>
            Resource created successfully.
          </Text>
        )}
      </div>
    </Card>
  );
};

export const azureResourceFormContribution: ComponentContribution = {
  name: 'azure/AzureResourceForm',
  propertySchema: AzureResourceFormSchema,
  renderer: AzureResourceFormRenderer,
};
