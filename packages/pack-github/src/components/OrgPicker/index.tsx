import React from 'react';
import { z } from 'zod';
import {
  Card,
  CardHeader,
  Text,
  Spinner,
  tokens,
  makeStyles,
  Badge,
} from '@fluentui/react-components';
import type { ComponentContribution } from '@kickstart/harness';

const OwnerSchema = z.object({
  login: z.string(),
  type: z.enum(['User', 'Organization']),
  avatarUrl: z.string().optional(),
});

const OrgPickerSchema = z.object({
  status: z.enum(['idle', 'loading', 'loaded', 'error']).default('idle'),
  owners: z.array(OwnerSchema).optional(),
  selectedOwner: z.string().optional(),
  errorMessage: z.string().optional(),
  isActive: z.boolean().default(true),
});

type OrgPickerProps = z.infer<typeof OrgPickerSchema>;

const useStyles = makeStyles({
  card: {
    padding: tokens.spacingVerticalM,
    marginTop: tokens.spacingVerticalS,
    marginBottom: tokens.spacingVerticalS,
    maxWidth: '400px',
  },
  list: {
    marginTop: tokens.spacingVerticalS,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
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

export const OrgPickerRenderer: React.FC<{ props: OrgPickerProps }> = ({ props }) => {
  const classes = useStyles();
  const containerClass = props.isActive ? classes.card : `${classes.card} ${classes.inactive}`;

  return (
    <Card className={containerClass}>
      <CardHeader header={<Text weight="semibold">Select GitHub Account or Organization</Text>} />
      {props.status === 'loading' && <Spinner size="small" label="Loading accounts…" />}
      {props.status === 'error' && props.errorMessage && (
        <Text size={200} style={{ color: tokens.colorPaletteRedForeground1 }}>
          {String(props.errorMessage)}
        </Text>
      )}
      {props.status === 'loaded' && props.owners && (
        <div className={classes.list}>
          {props.owners.map((owner) => {
            const isSelected = owner.login === props.selectedOwner;
            return (
              <div
                key={owner.login}
                className={`${classes.item} ${isSelected ? classes.selectedItem : ''}`}
              >
                <Text size={300} weight={isSelected ? 'semibold' : 'regular'}>
                  {String(owner.login)}
                </Text>
                <Badge
                  size="small"
                  appearance="outline"
                  color={owner.type === 'Organization' ? 'brand' : 'informative'}
                >
                  {String(owner.type)}
                </Badge>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
};

export const orgPickerContribution: ComponentContribution = {
  name: 'github/OrgPicker',
  propertySchema: OrgPickerSchema,
  renderer: OrgPickerRenderer,
};
