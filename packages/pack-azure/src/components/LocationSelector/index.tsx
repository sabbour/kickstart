import React from 'react';
import { z } from 'zod';
import { Card, CardHeader, Text, tokens, makeStyles } from '@fluentui/react-components';
import type { ComponentContribution } from '@aks-kickstart/harness';

const LocationItemSchema = z.object({
  name: z.string().describe('ARM region name, e.g. "eastus"'),
  displayName: z.string().describe('Human-readable name, e.g. "East US"'),
  regionalDisplayName: z.string().optional().describe('Region with geography, e.g. "(US) East US"'),
  geographyGroup: z.string().optional().describe('Geography group, e.g. "US", "Europe"'),
});

const LocationSelectorSchema = z.object({
  locations: z.array(LocationItemSchema).optional().describe('Available Azure regions'),
  selectedLocation: z.string().optional().describe('Currently selected ARM region name'),
  status: z.enum(['idle', 'loading', 'loaded', 'error']).default('idle'),
  errorMessage: z.string().optional(),
  groupByGeography: z.boolean().default(true),
});

type LocationSelectorProps = z.infer<typeof LocationSelectorSchema>;

const useStyles = makeStyles({
  card: {
    padding: tokens.spacingVerticalM,
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    maxWidth: '480px',
  },
  group: {
    marginTop: tokens.spacingVerticalS,
  },
  groupHeader: {
    color: tokens.colorNeutralForeground3,
    marginBottom: tokens.spacingVerticalXS,
  },
  locationList: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  locationItem: {
    padding: tokens.spacingVerticalXS,
    paddingLeft: tokens.spacingHorizontalS,
    borderLeft: `3px solid ${tokens.colorNeutralStroke1}`,
  },
  selectedItem: {
    borderLeftColor: tokens.colorBrandStroke1,
    backgroundColor: tokens.colorBrandBackground2,
  },
});

export const LocationSelectorRenderer: React.FC<{ props: LocationSelectorProps }> = ({ props }) => {
  const classes = useStyles();

  const locations = props.locations ?? [];
  const grouped = props.groupByGeography
    ? locations.reduce<Record<string, typeof locations>>((acc, loc) => {
        const geo = loc.geographyGroup ?? 'Other';
        (acc[geo] = acc[geo] ?? []).push(loc);
        return acc;
      }, {})
    : { 'All Regions': locations };

  return (
    <Card className={classes.card}>
      <CardHeader header={<Text weight="semibold">Select Azure Region</Text>} />
      {props.status === 'error' && props.errorMessage && (
        <Text size={200} style={{ color: tokens.colorPaletteRedForeground1 }}>
          {String(props.errorMessage)}
        </Text>
      )}
      {Object.entries(grouped).map(([geo, locs]) => (
        <div key={geo} className={classes.group}>
          <Text size={200} weight="semibold" className={classes.groupHeader}>{geo}</Text>
          <div className={classes.locationList}>
            {locs.map((loc) => {
              const isSelected = loc.name === props.selectedLocation;
              return (
                <div
                  key={loc.name}
                  className={`${classes.locationItem} ${isSelected ? classes.selectedItem : ''}`}
                >
                  <Text size={200} weight={isSelected ? 'semibold' : 'regular'}>
                    {String(loc.displayName)}
                  </Text>
                  <Text size={100} style={{ color: tokens.colorNeutralForeground3, display: 'block' }}>
                    {String(loc.name)}
                  </Text>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </Card>
  );
};

export const locationSelectorContribution: ComponentContribution = {
  name: 'azure/LocationSelector',
  propertySchema: LocationSelectorSchema,
  renderer: LocationSelectorRenderer,
};
