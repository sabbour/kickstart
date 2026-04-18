import React, { useState } from 'react';
import { makeStyles, tokens, Text } from '@fluentui/react-components';
import { KNOWN_COMPONENT_TYPES } from '@kickstart/harness';
import type { A2uiPayloadItem, A2uiMsg, A2uiComponent } from '../../types';

const KICKSTART_CATALOG_ID = 'kickstart';

interface DebugA2UITreeProps {
  a2uiMessages: A2uiPayloadItem[];
}

const useStyles = makeStyles({
  root: {
    paddingTop: tokens.spacingVerticalXXS,
  },
  surfaceBlock: {
    marginBottom: tokens.spacingVerticalXS,
    paddingLeft: tokens.spacingHorizontalS,
    borderLeftWidth: '2px',
    borderLeftStyle: 'solid',
    borderLeftColor: tokens.colorNeutralStroke2,
  },
  surfaceHeader: {
    display: 'block',
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground2,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    marginBottom: tokens.spacingVerticalXXS,
  },
  opRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    paddingLeft: tokens.spacingHorizontalS,
    marginBottom: '2px',
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  componentRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    paddingLeft: tokens.spacingHorizontalXL,
    marginBottom: '2px',
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
  },
  badge: {
    fontSize: tokens.fontSizeBase100,
    paddingLeft: tokens.spacingHorizontalXS,
    paddingRight: tokens.spacingHorizontalXS,
    paddingTop: '1px',
    paddingBottom: '1px',
    borderRadius: tokens.borderRadiusSmall,
    fontFamily: tokens.fontFamilyMonospace,
  },
  badgeOk: {
    backgroundColor: tokens.colorPaletteGreenBackground2,
    color: tokens.colorPaletteGreenForeground1,
  },
  badgeWarn: {
    backgroundColor: tokens.colorPaletteMarigoldBackground2,
    color: tokens.colorPaletteMarigoldForeground1,
  },
  badgeError: {
    backgroundColor: tokens.colorPaletteRedBackground2,
    color: tokens.colorPaletteRedForeground1,
  },
  badgeNeutral: {
    backgroundColor: tokens.colorNeutralBackground3,
    color: tokens.colorNeutralForeground3,
  },
  hidden: {
    fontStyle: 'italic',
    color: tokens.colorNeutralForeground4,
  },
  emptyState: {
    fontStyle: 'italic',
    color: tokens.colorNeutralForeground4,
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase200,
  },
  sectionToggle: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXXS,
    cursor: 'pointer',
    backgroundColor: 'transparent',
    borderTopWidth: '0',
    borderRightWidth: '0',
    borderBottomWidth: '0',
    borderLeftWidth: '0',
    paddingLeft: '0',
    paddingRight: '0',
    paddingTop: '0',
    paddingBottom: tokens.spacingVerticalXXS,
    fontWeight: tokens.fontWeightSemibold as any,
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase200,
    fontFamily: tokens.fontFamilyMonospace,
    ':hover': {
      color: tokens.colorNeutralForeground1,
    },
  },
});

/** Narrows A2uiPayloadItem to A2uiMsg using the version discriminant. */
function isSurfaceMessage(item: A2uiPayloadItem): item is A2uiMsg {
  return (item as A2uiMsg).version === 'v0.9';
}

interface SurfaceOps {
  creates: Array<{ catalogId: string }>;
  updates: Array<{ components: A2uiComponent[] }>;
  deletes: number;
  dataModelUpdates: Array<{ path?: string }>;
}

function groupBySurface(messages: A2uiMsg[]): Map<string, SurfaceOps> {
  const map = new Map<string, SurfaceOps>();

  const getOrCreate = (id: string): SurfaceOps => {
    if (!map.has(id)) {
      map.set(id, { creates: [], updates: [], deletes: 0, dataModelUpdates: [] });
    }
    return map.get(id)!;
  };

  for (const msg of messages) {
    if (msg.createSurface) {
      getOrCreate(msg.createSurface.surfaceId).creates.push({ catalogId: msg.createSurface.catalogId });
    }
    if (msg.updateComponents) {
      getOrCreate(msg.updateComponents.surfaceId).updates.push({ components: msg.updateComponents.components });
    }
    if (msg.deleteSurface) {
      getOrCreate(msg.deleteSurface.surfaceId).deletes += 1;
    }
    if (msg.updateDataModel) {
      getOrCreate(msg.updateDataModel.surfaceId).dataModelUpdates.push({ path: msg.updateDataModel.path });
    }
  }

  return map;
}

function ComponentBadge({ componentType, styles }: { componentType: string; styles: ReturnType<typeof useStyles> }) {
  const isKnown = KNOWN_COMPONENT_TYPES.includes(componentType);
  return (
    <span className={`${styles.badge} ${isKnown ? styles.badgeOk : styles.badgeWarn}`}>
      {isKnown ? '✅ resolved' : '⚠️ unknown type'}
    </span>
  );
}

function CatalogBadge({ catalogId, styles }: { catalogId: string; styles: ReturnType<typeof useStyles> }) {
  const isKnown = catalogId === KICKSTART_CATALOG_ID;
  return (
    <span className={`${styles.badge} ${isKnown ? styles.badgeNeutral : styles.badgeError}`}>
      {isKnown ? `catalog:${catalogId}` : `🔴 bad catalog: ${catalogId}`}
    </span>
  );
}

function SurfaceTree({ surfaceId, ops, styles }: {
  surfaceId: string;
  ops: SurfaceOps;
  styles: ReturnType<typeof useStyles>;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className={styles.surfaceBlock}>
      <button
        className={styles.sectionToggle}
        onClick={() => setOpen(prev => !prev)}
        aria-expanded={open}
        aria-label={`Toggle surface ${surfaceId}`}
      >
        <span>{open ? '▼' : '▶'}</span>
        <Text className={styles.surfaceHeader}>{surfaceId}</Text>
      </button>

      {open && (
        <>
          {ops.creates.map((c, i) => (
            <div key={`create-${i}`} className={styles.opRow}>
              <span>createSurface</span>
              <CatalogBadge catalogId={c.catalogId} styles={styles} />
            </div>
          ))}

          {ops.updates.map((u, i) => (
            <div key={`update-${i}`}>
              <div className={styles.opRow}>
                <span>updateComponents ({u.components.length})</span>
              </div>
              {u.components.map((comp, j) => (
                <div key={`comp-${i}-${j}`} className={styles.componentRow}>
                  <span>{comp.id}</span>
                  <span className={styles.hidden}>·</span>
                  <span>{comp.component}</span>
                  <ComponentBadge componentType={comp.component ?? 'unknown'} styles={styles} />
                </div>
              ))}
            </div>
          ))}

          {ops.deletes > 0 && (
            <div className={styles.opRow}>
              <span>deleteSurface ×{ops.deletes}</span>
            </div>
          )}

          {ops.dataModelUpdates.map((dm, i) => (
            <div key={`dm-${i}`} className={styles.opRow}>
              <span>updateDataModel</span>
              <span>{dm.path}</span>
              <span className={styles.hidden}>[value hidden]</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export function DebugA2UITree({ a2uiMessages }: DebugA2UITreeProps) {
  const styles = useStyles();

  const surfaceMessages = a2uiMessages.filter(isSurfaceMessage);

  if (surfaceMessages.length === 0) {
    return (
      <Text className={styles.emptyState} size={200}>No A2UI surface messages</Text>
    );
  }

  const grouped = groupBySurface(surfaceMessages);

  return (
    <div className={styles.root}>
      {Array.from(grouped.entries()).map(([surfaceId, ops]) => (
        <SurfaceTree key={surfaceId} surfaceId={surfaceId} ops={ops} styles={styles} />
      ))}
    </div>
  );
}
