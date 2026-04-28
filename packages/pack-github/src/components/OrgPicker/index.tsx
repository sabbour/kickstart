import React, { useEffect, useState } from 'react';
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
import type { ComponentContribution } from '@aks-kickstart/harness';
import { useGitHubAuthBridge } from '../../auth-bridge.js';

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
type OwnerProp = z.infer<typeof OwnerSchema>;

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
  const [selectedOwner, setSelectedOwner] = useState(props.selectedOwner);

  useEffect(() => {
    setSelectedOwner(props.selectedOwner);
  }, [props.selectedOwner]);

  // Live owner list from the GitHubAuthBridge (issue #179). Falls back to
  // server-supplied props.owners only when the bridge has no session loaded
  // (e.g. playground previews before sign-in completes).
  const bridge = useGitHubAuthBridge();
  const liveOwners: OwnerProp[] | undefined = bridge.session?.owners?.map((o) => ({
    login: o.login,
    type: o.type,
    avatarUrl: o.avatarUrl,
  }));

  const effectiveStatus: OrgPickerProps['status'] = bridge.loading
    ? 'loading'
    : bridge.error
      ? 'error'
      : liveOwners
        ? 'loaded'
        : props.status;
  const effectiveOwners = liveOwners ?? props.owners;
  const effectiveError = bridge.error ?? props.errorMessage;

  return (
    <Card className={containerClass}>
      <CardHeader header={<Text weight="semibold">Select GitHub Account or Organization</Text>} />
      {effectiveStatus === 'loading' && <Spinner size="small" label="Loading accounts…" />}
      {effectiveStatus === 'error' && effectiveError && (
        <Text size={200} style={{ color: tokens.colorPaletteRedForeground1 }}>
          {String(effectiveError)}
        </Text>
      )}
      {effectiveStatus === 'loaded' && effectiveOwners && (
        <div className={classes.list}>
          {effectiveOwners.map((owner) => {
            const isSelected = owner.login === selectedOwner;
            return (
              <div
                key={owner.login}
                className={`${classes.item} ${isSelected ? classes.selectedItem : ''}`}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onClick={() => setSelectedOwner(owner.login)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedOwner(owner.login);
                  }
                }}
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
