/**
 * Playground — Create / Components / Icons / Workspace (sidebar layout).
 *
 * Access via ?playground URL parameter.
 * Left sidebar navigation: Create | Components | Icons | Workspace
 *
 * Registry is fetched live from /api/packs (Step 5).
 */

import React, { useState, useCallback, useRef, useMemo, useEffect, memo } from 'react';
import {
  Button, CounterBadge, SearchBox, Switch,
  Card, CardHeader,
  Textarea, Subtitle2, Caption1, Body1Strong,
  MessageBar, MessageBarBody,
  TabList, Tab,
  Dialog, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions,
  makeStyles, mergeClasses, tokens,
} from '@fluentui/react-components';
import {
  Dismiss24Regular, Sparkle24Regular,
  Add24Regular, Grid24Regular, Icons24Regular,
  Navigation24Regular, FolderOpen24Regular, Copy24Regular,
  ArrowRight24Regular, Lightbulb24Regular,
} from '@fluentui/react-icons';
import { useA2UI } from '../hooks/useA2UI';
import type { ActionHandler } from '../hooks/useActionDispatch';
import { usePackRegistry } from '../hooks/usePackRegistry';
import type { ComponentContribution } from '@aks-kickstart/harness';
import { useDebug } from '../contexts/DebugContext';
import { A2UISurfaceWrapper } from '../components/A2UI/A2UISurfaceWrapper';
import { A2UIEnvelopePreview } from '../components/A2UI/A2UIEnvelopePreview';
import { DebugPanel } from '../components/Chat/DebugPanel';
import type { ChatMessage, DebugMetadata } from '../types';
import { PlaygroundWorkspace } from './PlaygroundWorkspace';
import {
  AZURE_ICON_CATEGORIES,
  UI_ICON_CATEGORIES,
  FLUENT_ICON_CATEGORY,
  FLUENT_REACT_ICON_CATEGORY,
  type IconEntry,
} from './playground-icons';
import { getFluentIcon } from '../catalog/icons/fluent-icons';
import { apiFetch } from '../services/api-client';
import { usePlaygroundMockMode } from '../contexts/PlaygroundMockModeContext';
import { FALLBACK_WIDGET_IDEAS } from '../lib/fallback-ideas';
import { COMPONENT_PREVIEWS } from '../catalog/component-previews';
import {
  SCENARIOS,
  groupScenariosByPack,
  type AggregatedScenario,
} from '../catalog/component-scenarios';
import {
  COMPONENT_GRID_MIN_COL_PX,
  COMPONENT_GRID_MAX_CARD_PX,
  COMPONENT_GRID_GAP_PX,
  COMPONENT_COMPACT_MIN_COL_PX,
  COMPONENT_COMPACT_MAX_CARD_PX,
  COMPONENT_CARD_PREVIEW_MIN_HEIGHT_PX,
  COMPONENT_CARD_COMPACT_MIN_HEIGHT_PX,
} from './playground-layout-constants';


// ── LLM → A2UI component normalizer ─────────────────────────────────────
// The LLM may output components in two formats:
//   1. Flat A2UI format:  { id, component, text, children: ["id1", "id2"] }
//   2. Nested tree format: { type, id, props: {...}, children: [{...nested...}] }
// This function normalizes both into the flat A2UI updateComponents format
// and ensures a "root" component exists.

const TYPE_MAP: Record<string, string> = {
  TextBlock: 'Text', Container: 'Column', ColumnSet: 'Row',
  ActionSet: 'Row', 'Action.Submit': 'Button', 'Action.OpenUrl': 'Button',
  'Input.Text': 'TextField', 'Input.Number': 'TextField',
  'Input.Toggle': 'CheckBox', 'Input.ChoiceSet': 'ChoicePicker',
  FactSet: 'Column', Table: 'Markdown', ProgressBar: 'ProgressSteps',
  Badge: 'Text', Chart: 'Markdown',
};

function normalizePlaygroundComponents(raw: any[]): any[] {
  // Detect format: if any item has "component" key, assume flat format
  const isFlat = raw.every((c: any) => typeof c.component === 'string');
  if (isFlat) {
    // Already flat — just ensure "root" exists
    const hasRoot = raw.some((c: any) => c.id === 'root');
    if (hasRoot) return raw;
    // Wrap all top-level items in a root Column
    const childIds = raw.map((c: any) => c.id).filter(Boolean);
    return [{ id: 'root', component: 'Column', children: childIds }, ...raw];
  }

  // Nested tree format — flatten recursively
  const flat: any[] = [];
  let counter = 0;

  function flatten(node: any, assignId?: string): string {
    const id = assignId || node.id || `auto-${counter++}`;
    const type = TYPE_MAP[node.type] || node.type || 'Text';
    const props = node.props || {};
    const children = node.children;

    const comp: any = { id, component: type };

    // Spread props to top-level
    for (const [k, v] of Object.entries(props)) {
      if (k !== 'id' && k !== 'component') comp[k] = v;
    }

    // Handle special type conversions
    if (node.type === 'Action.Submit' || node.type === 'Action.OpenUrl') {
      const label = props.title || 'Action';
      const labelId = `${id}-label`;
      flat.push({ id: labelId, component: 'Text', text: label });
      comp.component = 'Button';
      comp.child = labelId;
      delete comp.title;
      if (node.type === 'Action.OpenUrl' && props.url) {
        comp.action = { name: 'open-url', data: { url: props.url } };
      }
    } else if (node.type === 'FactSet' && props.facts) {
      // Convert facts to Text children
      const childIds: string[] = [];
      for (const fact of props.facts as any[]) {
        const fid = `${id}-fact-${counter++}`;
        flat.push({ id: fid, component: 'Text', text: `**${fact.title}:** ${fact.value}` });
        childIds.push(fid);
      }
      comp.children = childIds;
      delete comp.facts;
    } else if (node.type === 'Badge') {
      comp.text = props.text || '';
      comp.variant = 'caption';
    } else if ((node.type === 'Table' || node.type === 'Chart') && !comp.content) {
      // Convert Table/Chart to Markdown fallback
      comp.component = 'Markdown';
      if (node.type === 'Table' && props.columns && props.rows) {
        const cols = props.columns as any[];
        const rows = props.rows as any[];
        let md = '| ' + cols.map((c: any) => c.label || c.key).join(' | ') + ' |\n';
        md += '| ' + cols.map(() => '---').join(' | ') + ' |\n';
        for (const row of rows) {
          md += '| ' + cols.map((c: any) => row.cells?.[c.key] || '').join(' | ') + ' |\n';
        }
        comp.content = md;
      } else if (node.type === 'Chart') {
        comp.content = `**${props.title || 'Chart'}** _(chart visualization)_`;
      }
    } else if (node.type === 'ProgressBar') {
      comp.component = 'ProgressSteps';
      comp.steps = [{ label: props.label || 'Progress', status: 'active' }];
      delete comp.value;
      delete comp.status;
      delete comp.label;
    }

    // Recursively flatten children
    if (Array.isArray(children) && children.length > 0) {
      if (typeof children[0] === 'string') {
        // Already ID references
        comp.children = children;
      } else {
        // Nested objects — flatten them
        const childIds: string[] = [];
        for (const child of children) {
          if (typeof child === 'object' && child !== null) {
            const childId = flatten(child);
            childIds.push(childId);
          }
        }
        if (type === 'Button' || type === 'Card') {
          comp.child = childIds[0];
        } else {
          comp.children = childIds;
        }
      }
    }

    flat.push(comp);
    return id;
  }

  // If there are multiple top-level items, wrap them in a root Column
  if (raw.length === 1) {
    flatten(raw[0], 'root');
  } else {
    const childIds = raw.map((node: any) => flatten(node));
    flat.push({ id: 'root', component: 'Column', children: childIds });
  }

  return flat;
}

// Registry-derived groupings — populated from registry at render time.
// Components are grouped by pack name (prefix of component.name, e.g. "core" for "core/Button").
// The list is empty until pack-core lands (Step 4) and registry is wired in (Step 5).

function packNameFromId(id: string): string {
  return id.split('/')[0] ?? id;
}

function groupByPack<T>(items: T[], getId: (item: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const item of items) {
    const pack = packNameFromId(getId(item));
    const list = grouped.get(pack) ?? [];
    list.push(item);
    grouped.set(pack, list);
  }
  return grouped;
}

const SIDEBAR_WIDTH = '240px';
const SIDEBAR_COLLAPSED_BP = '768px';

const useStyles = makeStyles({
  playgroundPage: {
    fontFamily: tokens.fontFamilyBase,
  },
  // ---- Sidebar + Main shell ----
  shellRow: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
    minHeight: 0,
  },
  sidebar: {
    width: SIDEBAR_WIDTH,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: tokens.colorNeutralBackground2,
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    overflow: 'hidden',
    [`@media (max-width: ${SIDEBAR_COLLAPSED_BP})`]: {
      position: 'fixed' as const,
      top: 0,
      left: 0,
      bottom: 0,
      zIndex: 1000,
      transform: 'translateX(-100%)',
      transition: 'transform 0.25s ease',
      boxShadow: 'none',
    },
  },
  sidebarOpen: {
    [`@media (max-width: ${SIDEBAR_COLLAPSED_BP})`]: {
      transform: 'translateX(0)',
      boxShadow: tokens.shadow64,
    },
  },
  sidebarOverlay: {
    display: 'none',
    [`@media (max-width: ${SIDEBAR_COLLAPSED_BP})`]: {
      display: 'block',
      position: 'fixed' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.3)',
      zIndex: 999,
    },
  },
  sidebarBrand: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    flexShrink: 0,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  sidebarNav: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
  },
  sidebarFooter: {
    flexShrink: 0,
    paddingTop: tokens.spacingVerticalXS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  mainContent: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minWidth: 0,
  },
  // ---- Top bar (now inside main content) ----
  topbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: tokens.spacingVerticalXS,
    paddingBottom: tokens.spacingVerticalXS,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    backgroundColor: tokens.colorNeutralBackground1,
    flexShrink: 0,
    gap: tokens.spacingHorizontalM,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  topbarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    minWidth: 0,
  },
  topbarCenter: {
    flex: 1,
    maxWidth: '400px',
  },
  topbarActions: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
    alignItems: 'center',
    flexShrink: 0,
  },
  menuButton: {
    display: 'none',
    [`@media (max-width: ${SIDEBAR_COLLAPSED_BP})`]: {
      display: 'inline-flex',
    },
  },
  catalogBadge: {
    display: 'inline-block',
    fontSize: '10px',
    lineHeight: '16px',
    fontWeight: tokens.fontWeightSemibold,
    padding: `0 ${tokens.spacingHorizontalSNudge}`,
    borderRadius: tokens.borderRadiusSmall,
    backgroundColor: tokens.colorNeutralBackground4,
    color: tokens.colorNeutralForeground3,
    textTransform: 'lowercase' as const,
    letterSpacing: '0.02em',
    marginLeft: tokens.spacingHorizontalS,
    verticalAlign: 'middle',
  },
  cardBody: {
    padding: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalM,
  },
  dialogContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
  },
  jsonCodeBlock: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase400,
    whiteSpace: 'pre' as const,
    color: tokens.colorNeutralForeground1,
    backgroundColor: tokens.colorNeutralBackground3,
    padding: tokens.spacingVerticalM,
    borderRadius: tokens.borderRadiusMedium,
    overflowX: 'auto',
    maxHeight: '400px',
    overflow: 'auto',
  },
  jsonEditorContainer: {
    padding: tokens.spacingHorizontalXL,
    maxWidth: '800px',
    margin: '0 auto',
  },
  jsonTextarea: {
    width: '100%',
    fontFamily: tokens.fontFamilyMonospace,
  },
  jsonActions: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
    marginTop: tokens.spacingVerticalM,
  },
  createHero: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: '120px',
    paddingBottom: '60px',
    paddingLeft: tokens.spacingHorizontalXXL,
    paddingRight: tokens.spacingHorizontalXXL,
    gap: tokens.spacingVerticalL,
  },
  createHeading: {
    fontSize: '28px',
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    textAlign: 'center' as const,
  },
  createInputRow: {
    display: 'flex',
    alignItems: 'flex-end',
    width: '100%',
    maxWidth: '600px',
    position: 'relative',
    // Match main chat composer: large radius, stroke-1, spacing-s/m padding.
    borderRadius: tokens.borderRadiusLarge,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    backgroundColor: tokens.colorNeutralBackground1,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
    ':focus-within': {
      borderTopColor: tokens.colorBrandStroke1,
      borderRightColor: tokens.colorBrandStroke1,
      borderBottomColor: tokens.colorBrandStroke1,
      borderLeftColor: tokens.colorBrandStroke1,
      boxShadow: `0 0 0 1px ${tokens.colorBrandStroke1}`,
    },
  },
  createInput: {
    flex: 1,
    minHeight: '24px',
    maxHeight: '160px',
    border: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    // Match chat-textarea: 300 font size + 1.5 line-height.
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase300,
    fontFamily: tokens.fontFamilyBase,
    color: tokens.colorNeutralForeground1,
    paddingLeft: 0,
    paddingRight: '80px',
    paddingTop: tokens.spacingVerticalXS,
    paddingBottom: tokens.spacingVerticalXS,
    boxSizing: 'border-box' as const,
    '::placeholder': {
      color: tokens.colorNeutralForegroundDisabled,
    },
  },
  createSubtext: {
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    textAlign: 'center' as const,
  },
  startBlankLink: {
    color: tokens.colorBrandForeground1,
    cursor: 'pointer',
    textDecoration: 'underline',
    ':hover': {
      color: tokens.colorBrandForeground2,
    },
  },
  advancedToggle: {
    marginTop: tokens.spacingVerticalXXL,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    ':hover': {
      color: tokens.colorNeutralForeground1,
    },
  },
  errorMessage: {
    marginTop: tokens.spacingVerticalXS,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    textAlign: 'center' as const,
    paddingTop: '60px',
    paddingBottom: '60px',
    paddingLeft: tokens.spacingHorizontalXL,
    paddingRight: tokens.spacingHorizontalXL,
    gap: tokens.spacingVerticalS,
  },
  emptyIcon: {
    fontSize: '32px',
    marginBottom: tokens.spacingVerticalM,
    opacity: 0.4,
  },
  dialogSurface: {
    maxWidth: '90vw',
    width: '800px',
  },
  detailTabs: {
    marginBottom: tokens.spacingVerticalM,
  },
  jsonCopyRow: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginBottom: tokens.spacingVerticalXS,
  },
  compCardClickable: {
    cursor: 'pointer',
    ':hover': {
      boxShadow: tokens.shadow8,
    },
    ':focus-visible': {
      outline: `2px solid ${tokens.colorBrandStroke1}`,
      outlineOffset: '2px',
    },
  },
  // Component grid: 4–5 cards/row at standard viewports (1280/1440/1920).
  // Geometry comes from playground-layout-constants.ts so Playwright asserts
  // against the same source of truth. See #995 (restores #986's intent).
  componentGrid: {
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fill, minmax(${COMPONENT_GRID_MIN_COL_PX}px, 1fr))`,
    gap: `${COMPONENT_GRID_GAP_PX}px`,
    padding: `0 ${tokens.spacingHorizontalL} ${tokens.spacingVerticalL}`,
    '& > *': {
      maxWidth: `${COMPONENT_GRID_MAX_CARD_PX}px`,
    },
  },
  // Compact grid for pack sections where every component lacks a preview.
  componentCompactGrid: {
    display: 'grid',
    gridTemplateColumns: `repeat(auto-fill, minmax(${COMPONENT_COMPACT_MIN_COL_PX}px, 1fr))`,
    gap: tokens.spacingVerticalS,
    padding: `0 ${tokens.spacingHorizontalL} ${tokens.spacingVerticalL}`,
    '& > *': {
      maxWidth: `${COMPONENT_COMPACT_MAX_CARD_PX}px`,
    },
  },
  compCardPreview: {
    minHeight: `${COMPONENT_CARD_PREVIEW_MIN_HEIGHT_PX}px`,
    display: 'flex',
    flexDirection: 'column' as const,
  },
  compCardCompact: {
    minHeight: `${COMPONENT_CARD_COMPACT_MIN_HEIGHT_PX}px`,
  },
  emptyPreviewLabel: {
    marginTop: tokens.spacingVerticalXS,
    color: tokens.colorNeutralForeground4,
    fontSize: tokens.fontSizeBase100,
    fontStyle: 'italic',
  },
  compPackBanner: {
    margin: `0 ${tokens.spacingHorizontalL} ${tokens.spacingVerticalM}`,
    padding: `${tokens.spacingVerticalS} ${tokens.spacingHorizontalM}`,
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  iconGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
    gap: tokens.spacingVerticalM,
    marginTop: tokens.spacingVerticalM,
  },
  iconCard: {
    cursor: 'pointer',
    textAlign: 'center' as const,
    paddingTop: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalL,
    transition: 'background-color 0.2s ease',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  iconSymbol: {
    display: 'block',
    marginBottom: tokens.spacingVerticalS,
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  groupHeader: {
    display: 'block',
    marginTop: tokens.spacingVerticalXXL,
    marginBottom: tokens.spacingVerticalL,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    borderBottom: `2px solid ${tokens.colorBrandBackground}`,
  },
  // ---- Create tab: chat active layout ----
  createChatShell: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: tokens.colorNeutralBackground2,
  },
  createMsgArea: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    paddingTop: tokens.spacingVerticalXL,
    paddingBottom: tokens.spacingVerticalL,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    // Keep messages from growing too wide
    '& > *': {
      maxWidth: '760px',
      width: '100%',
      marginLeft: 'auto',
      marginRight: 'auto',
    },
  },
  createBubbleRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
    maxWidth: '760px',
    width: '100%',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  createBubbleUser: {
    alignSelf: 'flex-end',
    backgroundColor: tokens.colorBrandBackground,
    color: tokens.colorNeutralForegroundOnBrand,
    borderRadius: `${tokens.borderRadiusXLarge} ${tokens.borderRadiusXLarge} ${tokens.borderRadiusMedium} ${tokens.borderRadiusXLarge}`,
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    maxWidth: '75%',
    wordBreak: 'break-word',
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase300,
  },
  createBubbleAssistant: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: `${tokens.borderRadiusXLarge} ${tokens.borderRadiusXLarge} ${tokens.borderRadiusXLarge} ${tokens.borderRadiusMedium}`,
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    maxWidth: '85%',
    wordBreak: 'break-word',
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase300,
    whiteSpace: 'pre-wrap' as const,
  },
  createBubbleStreaming: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorBrandStroke1}`,
    borderLeft: `3px solid ${tokens.colorBrandBackground}`,
    borderRadius: `${tokens.borderRadiusXLarge} ${tokens.borderRadiusXLarge} ${tokens.borderRadiusXLarge} ${tokens.borderRadiusMedium}`,
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    maxWidth: '85%',
    wordBreak: 'break-word',
    fontSize: tokens.fontSizeBase300,
    lineHeight: tokens.lineHeightBase300,
    whiteSpace: 'pre-wrap' as const,
  },
  createSurfaceBlock: {
    alignSelf: 'flex-start',
    width: '100%',
    maxWidth: '100%',
    marginTop: tokens.spacingVerticalXS,
  },
  createTypingDots: {
    alignSelf: 'flex-start',
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
    alignItems: 'center',
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    backgroundColor: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: tokens.borderRadiusXLarge,
    '& span': {
      width: '6px',
      height: '6px',
      borderRadius: tokens.borderRadiusCircular,
      backgroundColor: tokens.colorNeutralForeground3,
      animationName: {
        '0%, 80%, 100%': { transform: 'scale(0.6)', opacity: '0.4' },
        '40%': { transform: 'scale(1)', opacity: '1' },
      },
      animationDuration: '1.2s',
      animationIterationCount: 'infinite',
      animationTimingFunction: 'ease-in-out',
    },
    '& span:nth-child(2)': { animationDelay: '0.2s' },
    '& span:nth-child(3)': { animationDelay: '0.4s' },
  },
  createInputBar: {
    flexShrink: 0,
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    paddingTop: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalM,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
  },
  createChatFooter: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    justifyContent: 'center',
    marginTop: tokens.spacingVerticalS,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
  },
  createFooterSep: {
    color: tokens.colorNeutralForeground3,
  },
});

// ---- ComponentCardErrorBoundary ----
// Isolates crashes in individual component cards so one broken card
// doesn't bring down the whole grid.
interface ErrorBoundaryState { hasError: boolean; message: string }
class ComponentCardErrorBoundary extends React.Component<
  React.PropsWithChildren<{ label?: string }>,
  ErrorBoundaryState
> {
  constructor(props: React.PropsWithChildren<{ label?: string }>) {
    super(props);
    this.state = { hasError: false, message: '' };
  }
  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, message: String(error) };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '8px', color: tokens.colorStatusDangerForeground1, fontSize: tokens.fontSizeBase200 }}>
          {this.props.label ?? 'Card'} failed to render
        </div>
      );
    }
    return this.props.children;
  }
}

// ---- ComponentCard Component ----
// Renders a live A2UI preview thumbnail for a single component entry.
// Uses COMPONENT_PREVIEWS for example props; falls back to metadata-only
// for components that have no registered example (e.g. complex rich components).
// Click opens the component detail dialog (preview + JSON view).
interface ComponentCardProps {
  comp: ComponentContribution;
  onCardClick: (comp: ComponentContribution) => void;
  compact?: boolean;
}

const ComponentCard = memo(({ comp, onCardClick, compact = false }: ComponentCardProps) => {
  const classes = useStyles();
  const exampleComponents = COMPONENT_PREVIEWS[comp.name];
  const surfaceId = `component-preview-${comp.name}`;
  const hasPreview = !!exampleComponents;
  const isCompact = compact || !hasPreview;

  return (
    <Card
      appearance="outline"
      style={{ padding: tokens.spacingVerticalM }}
      className={mergeClasses(
        classes.compCardClickable,
        isCompact ? classes.compCardCompact : classes.compCardPreview,
      )}
      role="button"
      tabIndex={0}
      aria-label={`Open ${comp.name} detail`}
      onClick={() => onCardClick(comp)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCardClick(comp); } }}
      data-component-card={comp.name}
      data-component-has-preview={hasPreview ? 'true' : 'false'}
    >
      <Body1Strong style={{ fontFamily: tokens.fontFamilyMonospace, fontSize: tokens.fontSizeBase200 }}>
        {comp.name.split('/')[1] ?? comp.name}
      </Body1Strong>
      <Caption1 style={{ color: tokens.colorNeutralForeground3, fontFamily: tokens.fontFamilyMonospace }}>
        {comp.name}
      </Caption1>
      {hasPreview ? (
        <div
          className={classes.cardBody}
          style={{ marginTop: tokens.spacingVerticalS, pointerEvents: 'none', flex: 1 }}
          data-testid="component-card-preview"
        >
          {/* A2UIEnvelopePreview — same render pipeline as Chat */}
          <A2UIEnvelopePreview
            surfaceId={surfaceId}
            components={exampleComponents}
            loading={
              <div style={{ padding: '8px 0', color: tokens.colorNeutralForeground4, fontSize: tokens.fontSizeBase200 }}>
                Loading…
              </div>
            }
          />
        </div>
      ) : (
        <div className={classes.emptyPreviewLabel}>No preview</div>
      )}
    </Card>
  );
});

ComponentCard.displayName = 'ComponentCard';

// ---- ScenarioCard Component (Ideas tab — #987) ----
// Renders a live A2UI preview thumbnail for a curated scenario composition
// (2–4 pack + core components). Click opens the scenario detail dialog
// (preview + JSON view) — same interaction pattern as ComponentCard.
interface ScenarioCardProps {
  scenario: AggregatedScenario;
  onCardClick: (scenario: AggregatedScenario) => void;
}

const ScenarioCard = memo(({ scenario, onCardClick }: ScenarioCardProps) => {
  const classes = useStyles();
  const surfaceId = `scenario-preview-${scenario.key}`;

  return (
    <Card
      appearance="outline"
      style={{ padding: tokens.spacingVerticalM }}
      className={mergeClasses(classes.compCardClickable, classes.compCardPreview)}
      role="button"
      tabIndex={0}
      aria-label={`Open ${scenario.title} scenario detail`}
      onClick={() => onCardClick(scenario)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCardClick(scenario); } }}
      data-scenario-card={scenario.key}
    >
      <Body1Strong style={{ fontSize: tokens.fontSizeBase300 }}>
        {scenario.title}
      </Body1Strong>
      <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
        {scenario.description}
      </Caption1>
      <div
        className={classes.cardBody}
        style={{ marginTop: tokens.spacingVerticalS, pointerEvents: 'none', flex: 1 }}
        data-testid="scenario-card-preview"
      >
        {/* A2UIEnvelopePreview — same render engine as Components tab */}
        <A2UIEnvelopePreview
          surfaceId={surfaceId}
          components={scenario.components as Array<Record<string, any>>}
          loading={
            <div style={{ padding: '8px 0', color: tokens.colorNeutralForeground4, fontSize: tokens.fontSizeBase200 }}>
              Loading…
            </div>
          }
        />
      </div>
    </Card>
  );
});

ScenarioCard.displayName = 'ScenarioCard';

// Icon sections for the Icons tab (Azure, UI, Fluent 2, Fluent React)
// Icon category sections for the Icons tab
const ICON_SECTIONS = [
  { label: 'Azure Services', categories: AZURE_ICON_CATEGORIES },
  { label: 'UI Icons', categories: UI_ICON_CATEGORIES },
  { label: 'Fluent 2', categories: [FLUENT_ICON_CATEGORY] },
  { label: 'Fluent React', categories: [FLUENT_REACT_ICON_CATEGORY] },
];

// ---- Main Playground Component (Inner) ----

function PlaygroundInner() {
  const classes = useStyles();
  const { debugEnabled, toggleDebug } = useDebug();
  const [mockMode, setMockMode] = usePlaygroundMockMode();
  const [activeTab, setActiveTab] = useState<'create' | 'ideas' | 'components' | 'icons' | 'workspace'>('create');
  const [filterQuery, setFilterQuery] = useState('');
  const [iconFilter, setIconFilter] = useState('');
  const [iconSection, setIconSection] = useState<string>('Azure Services');
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [createPrompt, setCreatePrompt] = useState('');
  const [showAdvancedJson, setShowAdvancedJson] = useState(false);
  const customCounter = useRef(0);
  // No-op handler: neither the JSON editor nor the Create tab widget previews
  // have an LLM conversation to advance — absorb all component actions silently.
  const playgroundInnerActionHandler = useCallback<ActionHandler>(() => {}, []);
  const customA2ui = useA2UI({ actionHandler: playgroundInnerActionHandler }); // For custom JSON editor
  const createA2ui = useA2UI({ actionHandler: playgroundInnerActionHandler }); // For Create tab chat
  const [createLoading, setCreateLoading] = useState(false);
  const createSessionIdRef = useRef<string | undefined>(undefined);
  const createEndRef = useRef<HTMLDivElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const iconSearchRef = useRef<HTMLDivElement>(null);
  const createInputRef = useRef<HTMLTextAreaElement>(null);
  const [createMessages, setCreateMessages] = useState<ChatMessage[]>([]);
  const [inspireLoading, setInspireLoading] = useState(false);
  const inspireAbortRef = useRef<AbortController | null>(null);
  const lastInspireIdxRef = useRef<number>(-1);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Component detail dialog state
  const [selectedComponent, setSelectedComponent] = useState<ComponentContribution | null>(null);
  const [componentDialogOpen, setComponentDialogOpen] = useState(false);
  const [componentDetailTab, setComponentDetailTab] = useState<'preview' | 'json'>('preview');
  const [jsonCopied, setJsonCopied] = useState(false);
  // Ideas tab (scenario detail dialog) state (#987)
  const [selectedScenario, setSelectedScenario] = useState<AggregatedScenario | null>(null);
  const [scenarioDialogOpen, setScenarioDialogOpen] = useState(false);
  const [scenarioDetailTab, setScenarioDetailTab] = useState<'preview' | 'json'>('preview');
  const [scenarioJsonCopied, setScenarioJsonCopied] = useState(false);

  // Registry-driven data — fetched live from /api/packs
  const { registry, loading: registryLoading, error: registryError } = usePackRegistry();

  // Abort in-flight inspiration stream on unmount
  useEffect(() => {
    return () => { inspireAbortRef.current?.abort(); };
  }, []);

  // Auto-resize create textarea
  useEffect(() => {
    if (createInputRef.current) {
      createInputRef.current.style.height = '0';
      createInputRef.current.style.height = Math.max(44, Math.min(createInputRef.current.scrollHeight, 200)) + 'px';
    }
  }, [createPrompt]);

  const handleInspire = useCallback(async () => {
    inspireAbortRef.current?.abort();
    setInspireLoading(true);
    setCreatePrompt('');

    const controller = new AbortController();
    inspireAbortRef.current = controller;

    try {
      const res = await apiFetch('/api/inspirations/widgets?stream=true', { signal: controller.signal }, debugEnabled);
      if (!res.ok || !res.body) throw new Error('Streaming API error');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') { setInspireLoading(false); return; }
            if (data.startsWith('[ERROR]')) throw new Error(data.slice(8));
            accumulated += data;
            setCreatePrompt(accumulated);
          }
        }
      }
      setInspireLoading(false);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setCreatePrompt('');
      try {
        const res = await apiFetch('/api/inspirations/widgets', undefined, debugEnabled);
        if (res.ok) {
          const ideas = await res.json();
          if (Array.isArray(ideas) && ideas.length > 0) {
            setCreatePrompt(ideas[0].prompt);
            setInspireLoading(false);
            return;
          }
        }
      } catch { /* API call failed */ }
      // Fallback to client-side ideas if API is unavailable — pick an index
      // that differs from the previous one so consecutive clicks vary.
      if (FALLBACK_WIDGET_IDEAS.length > 0) {
        let idx = Math.floor(Math.random() * FALLBACK_WIDGET_IDEAS.length);
        if (FALLBACK_WIDGET_IDEAS.length > 1 && idx === lastInspireIdxRef.current) {
          idx = (idx + 1) % FALLBACK_WIDGET_IDEAS.length;
        }
        lastInspireIdxRef.current = idx;
        setCreatePrompt(FALLBACK_WIDGET_IDEAS[idx].prompt);
      }
      setInspireLoading(false);
    } finally {
      inspireAbortRef.current = null;
    }
  }, [debugEnabled]);

  // Registry-driven filtered components (Phase C)
  const filteredComponents = useMemo((): ComponentContribution[] => {
    const comps = registry.components;
    if (!filterQuery.trim()) return comps;
    const query = filterQuery.toLowerCase();
    return comps.filter(c => c.name.toLowerCase().includes(query));
  }, [filterQuery, registry]);

  // Filter icons across selected section
  const filteredIconCategories = useMemo(() => {
    const section = ICON_SECTIONS.find(s => s.label === iconSection);
    if (!section) return [];
    if (!iconFilter.trim()) return section.categories;
    const query = iconFilter.toLowerCase();
    return section.categories
      .map(cat => ({
        ...cat,
        icons: cat.icons.filter(icon => icon.name.toLowerCase().includes(query)),
      }))
      .filter(cat => cat.icons.length > 0);
  }, [iconFilter, iconSection]);

  const filteredIconCount = useMemo(
    () => filteredIconCategories.reduce((sum, cat) => sum + cat.icons.length, 0),
    [filteredIconCategories],
  );

  // Handle custom JSON render
  const handleJsonRender = useCallback(() => {
    setJsonError('');
    try {
      const parsed = JSON.parse(jsonInput);
      const msgs: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
      for (const m of msgs as any[]) {
        if (!m.version) throw new Error('Each message must have a "version" field');
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      customA2ui.processMessages(msgs as any);
      customCounter.current++;
      setJsonInput('');
    } catch (err: any) {
      setJsonError(err.message || 'Invalid JSON');
    }
  }, [jsonInput, customA2ui]);

  // Handle save as JSON — render the pasted JSON and reset
  const handleSaveAsWidget = useCallback(() => {
    setJsonError('');
    try {
      const parsed = JSON.parse(jsonInput);
      const msgs: unknown[] = Array.isArray(parsed) ? parsed : [parsed];
      for (const m of msgs as any[]) {
        if (!m.version) throw new Error('Each message must have a "version" field');
      }
      setJsonInput('');
    } catch (err: any) {
      setJsonError(err.message || 'Invalid JSON');
    }
  }, [jsonInput]);

  // Handle "Start Blank" — render a blank A2UI surface in the JSON editor
  const handleStartBlank = useCallback(() => {
    const blankMessages = [
      { version: 'v0.9', createSurface: { surfaceId: 'blank-widget', catalogId: 'kickstart' } },
      { version: 'v0.9', updateComponents: { surfaceId: 'blank-widget', components: [
        { id: 'root', component: 'Column', children: ['t1'] },
        { id: 't1', component: 'Text', text: 'New surface — edit the JSON to build something!', variant: 'body1' },
      ] } },
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    customA2ui.processMessages(blankMessages as any);
    setActiveTab('create');
    setShowAdvancedJson(true);
  }, [customA2ui]);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    if (createMessages.length > 0 || createLoading) {
      createEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [createMessages, createLoading]);

  // Keyboard shortcuts: Ctrl+K or / focuses the active search input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isEditing = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable;
      if (isEditing) return;
      if (e.key === '/' || (e.key === 'k' && (e.ctrlKey || e.metaKey))) {
        if (activeTab === 'components') {
          e.preventDefault();
          searchBoxRef.current?.querySelector<HTMLInputElement>('input')?.focus();
        } else if (activeTab === 'icons') {
          e.preventDefault();
          iconSearchRef.current?.querySelector<HTMLInputElement>('input')?.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [activeTab]);

  // Handle create from prompt — calls /api/playground (dedicated A2UI endpoint)
  const handleCreateSend = useCallback(async (text: string) => {
    if (!text.trim() || createLoading) return;
    setCreatePrompt('');

    const userMsg: ChatMessage = {
      id: `create-${Date.now()}-user`,
      role: 'user',
      text,
      timestamp: Date.now(),
    };
    setCreateMessages(prev => [...prev, userMsg]);
    setCreateLoading(true);

    try {
      const res = await apiFetch('/api/playground', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: createSessionIdRef.current,
          message: text,
        }),
      }, debugEnabled);

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `API error: ${res.status}` }));
        throw new Error(err.error || `API error: ${res.status}`);
      }

      const data = await res.json() as {
        sessionId: string;
        message: string;
        a2ui?: object[];
        model?: string;
        rawResponse?: string;
      };

      if (data.sessionId && !createSessionIdRef.current) {
        createSessionIdRef.current = data.sessionId;
      }

      // Process A2UI components through the surface system
      let surfaceIds: string[] | undefined;
      if (data.a2ui && data.a2ui.length > 0) {
        const surfaceId = `pg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const components = normalizePlaygroundComponents(data.a2ui as any[]);
        const a2uiMessages = [
          { version: 'v0.9', createSurface: { surfaceId, catalogId: 'kickstart' } },
          { version: 'v0.9', updateComponents: { surfaceId, components } },
        ];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        surfaceIds = createA2ui.processMessages(a2uiMessages as any);
      }

      // Capture debug metadata when debug mode is on
      const debugInfo: DebugMetadata | undefined = debugEnabled
        ? { model: data.model, rawResponse: data.rawResponse }
        : undefined;

      const assistantMsg: ChatMessage = {
        id: `create-${Date.now()}-assistant`,
        role: 'assistant',
        text: data.message,
        surfaceIds: surfaceIds && surfaceIds.length > 0 ? surfaceIds : undefined,
        timestamp: Date.now(),
        debugInfo,
      };
      setCreateMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `create-${Date.now()}-error`,
        role: 'assistant',
        text: `⚠️ ${err.message || 'Connection failed'}`,
        timestamp: Date.now(),
      };
      setCreateMessages(prev => [...prev, errorMsg]);
    } finally {
      setCreateLoading(false);
    }
  }, [createLoading, createA2ui, debugEnabled]);

  // Handle clear all
  const handleClearAll = useCallback(() => {
    customA2ui.reset();
    setJsonInput('');
    setJsonError('');
    createA2ui.reset();
    setCreateMessages([]);
    createSessionIdRef.current = undefined;
  }, [customA2ui, createA2ui]);

  // Handle copy icon path
  const handleCopyIcon = useCallback((icon: IconEntry) => {
    navigator.clipboard.writeText(icon.path);
  }, []);

  // Component detail dialog handlers
  const handleComponentCardClick = useCallback((comp: ComponentContribution) => {
    setSelectedComponent(comp);
    setComponentDetailTab('preview');
    setJsonCopied(false);
    setComponentDialogOpen(true);
  }, []);

  // Memoize the JSON for the selected component
  const componentJson = useMemo(() => {
    if (!selectedComponent) return '';
    const descriptors = COMPONENT_PREVIEWS[selectedComponent.name];
    return descriptors ? JSON.stringify(descriptors, null, 2) : '';
  }, [selectedComponent]);

  const handleCopyComponentJson = useCallback(() => {
    if (!componentJson) return;
    navigator.clipboard.writeText(componentJson).then(() => {
      setJsonCopied(true);
      setTimeout(() => setJsonCopied(false), 2000);
    }).catch(() => { /* clipboard unavailable */ });
  }, [componentJson]);

  // Ideas tab (#987) — scenario dialog handlers + memoized JSON
  const scenariosByPack = useMemo(() => groupScenariosByPack(SCENARIOS), []);
  const handleScenarioCardClick = useCallback((scenario: AggregatedScenario) => {
    setSelectedScenario(scenario);
    setScenarioDetailTab('preview');
    setScenarioJsonCopied(false);
    setScenarioDialogOpen(true);
  }, []);
  const scenarioJson = useMemo(() => {
    if (!selectedScenario) return '';
    return JSON.stringify(selectedScenario.components, null, 2);
  }, [selectedScenario]);
  const handleCopyScenarioJson = useCallback(() => {
    if (!scenarioJson) return;
    navigator.clipboard.writeText(scenarioJson).then(() => {
      setScenarioJsonCopied(true);
      setTimeout(() => setScenarioJsonCopied(false), 2000);
    }).catch(() => { /* clipboard unavailable */ });
  }, [scenarioJson]);

  const customSurfaceEntries = Array.from(customA2ui.surfaces.entries());

  // Determine counter for topbar
  const getCounter = () => {
    switch (activeTab) {
      case 'components': return filteredComponents.length;
      case 'icons': return filteredIconCount;
      case 'create': return customSurfaceEntries.length;
      case 'ideas': return SCENARIOS.length;
      default: return 0;
    }
  };

  // Tab label map for topbar heading
  const TAB_LABELS: Record<string, string> = {
    create: 'Create',
    ideas: 'Ideas',
    components: 'Components',
    icons: 'Icons',
    workspace: 'Workspace',
  };
  const TAB_DESCRIPTIONS: Record<string, string> = {
    create: 'Build A2UI components with AI',
    ideas: 'Curated scenario compositions from every pack',
    components: 'A2UI component reference',
    icons: 'Fluent icon browser',
    workspace: 'Test the full file manager, editor, and diagram experience.',
  };

  const handleTabSelect = useCallback((_e: any, data: any) => {
    setActiveTab(data.value as any);
    setSidebarOpen(false);
  }, []);

  return (
    <div className={mergeClasses('playground-page', classes.playgroundPage)}>
      <div className={classes.shellRow}>
        {/* ---- Mobile overlay ---- */}
        {sidebarOpen && (
          <div
            className={classes.sidebarOverlay}
            onClick={() => setSidebarOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* ---- Left Sidebar ---- */}
        <aside
          id="playground-sidebar"
          className={mergeClasses(classes.sidebar, sidebarOpen && classes.sidebarOpen)}
          aria-label="Playground navigation"
        >
          <div className={classes.sidebarBrand}>
            <Body1Strong style={{ color: tokens.colorNeutralForeground2 }}>A2UI Playground</Body1Strong>
          </div>

          <nav className={classes.sidebarNav}>
            <TabList
              vertical
              selectedValue={activeTab}
              onTabSelect={handleTabSelect}
              size="medium"
            >
              <Tab id="tab-create" value="create" aria-controls="panel-create" icon={<Add24Regular />}>Create</Tab>
              <Tab id="tab-ideas" value="ideas" aria-controls="panel-ideas" icon={<Lightbulb24Regular />}>Ideas</Tab>
              <Tab id="tab-components" value="components" aria-controls="panel-components" icon={<Grid24Regular />}>Components</Tab>
              <Tab id="tab-icons" value="icons" aria-controls="panel-icons" icon={<Icons24Regular />}>Icons</Tab>
              <Tab id="tab-workspace" value="workspace" aria-controls="panel-workspace" icon={<FolderOpen24Regular />}>Workspace</Tab>
            </TabList>


          </nav>

          <div className={classes.sidebarFooter}>
            {debugEnabled && (
              <button
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: tokens.fontSizeBase200, color: tokens.colorPaletteYellowForeground1,
                  padding: `${tokens.spacingVerticalXXS} 0`, marginBottom: tokens.spacingVerticalXS,
                }}
                aria-label="Debug mode active — click to disable"
                title="Debug mode ON (Ctrl+Shift+D to toggle)"
                onClick={toggleDebug}
              >
                🐛 Debug
              </button>
            )}
            <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
              v{__BUILD_VERSION__}
            </Caption1>
          </div>
        </aside>

        {/* ---- Main Content ---- */}
        <div className={classes.mainContent}>
          {/* ---- Top bar ---- */}
          <div className={classes.topbar}>
            <div className={classes.topbarLeft}>
              <Button
                className={classes.menuButton}
                appearance="subtle"
                icon={<Navigation24Regular />}
                aria-label="Toggle navigation"
                aria-expanded={sidebarOpen}
                aria-controls="playground-sidebar"
                onClick={() => setSidebarOpen(prev => !prev)}
              />
              <Body1Strong style={{ color: tokens.colorNeutralForeground2 }}>
                {TAB_LABELS[activeTab]}
              </Body1Strong>
              <CounterBadge
                count={getCounter()}
                appearance="filled"
                color="brand"
                overflowCount={999}
                size="small"
              />
            </div>
            {activeTab === 'components' && (
              <div className={classes.topbarCenter} ref={searchBoxRef}>
                <SearchBox
                  placeholder="Filter components..."
                  value={filterQuery}
                  onChange={(_e, data) => setFilterQuery(data.value)}
                  size="small"
                />
              </div>
            )}
            {activeTab === 'icons' && (
              <div className={classes.topbarCenter} ref={iconSearchRef}>
                <SearchBox
                  placeholder="Filter icons..."
                  value={iconFilter}
                  onChange={(_e, data) => setIconFilter(data.value)}
                  size="small"
                />
              </div>
            )}
            <div className={classes.topbarActions}>
              <Switch
                checked={mockMode}
                onChange={(_event, data) => setMockMode(data.checked)}
                label={mockMode ? 'Mock data' : 'Real services'}
                title="Toggle mocked UserAction/API behavior for playground testing"
              />
              {activeTab === 'create' && (
                <Button appearance="outline" size="small" onClick={handleClearAll}>Clear All</Button>
              )}
              <Caption1 style={{ color: tokens.colorNeutralForeground3, marginLeft: '12px' }}>
                {TAB_DESCRIPTIONS[activeTab]}
              </Caption1>
            </div>
          </div>

      {/* ---- Tab 1: Create (empty state — no messages yet) ---- */}
      {activeTab === 'create' && createMessages.length === 0 && (
        <div id="panel-create" role="tabpanel" aria-labelledby="tab-create" className="playground-create-scroll">
          {/* Hero section */}
          <div className={classes.createHero}>
            <div className={classes.createHeading}>What component would you like to imagine?</div>
            <div className={classes.createInputRow}>
              {inspireLoading && <div className="hero-input-progress" />}
              <textarea
                ref={createInputRef}
                className={classes.createInput}
                value={createPrompt}
                onChange={(e) => setCreatePrompt(e.target.value)}
                placeholder="Describe your A2UI widget..."
                aria-label="Describe your A2UI widget"
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCreateSend(createPrompt); } }}
                disabled={createLoading}
                rows={1}
                style={{ resize: 'none', overflowY: 'hidden' }}
              />
              <button
                className={`hero-inspire-btn${inspireLoading ? ' loading' : ''}`}
                aria-label="Inspire me"
                title="Inspire me"
                onClick={handleInspire}
                disabled={inspireLoading || createLoading}
              >
                <Sparkle24Regular />
              </button>
              <button
                className="hero-send-btn"
                aria-label="Create"
                title="Create"
                onClick={() => handleCreateSend(createPrompt)}
                disabled={!createPrompt.trim() || createLoading}
                style={{ position: 'absolute', right: '8px' }}
              >
                <ArrowRight24Regular style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
            <div className={classes.createSubtext}>
              or{' '}
              <span
                className={classes.startBlankLink}
                onClick={handleStartBlank}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleStartBlank(); } }}
              >
                Start Blank
              </span>
            </div>

            {/* Advanced: raw JSON editor toggle */}
            <div
              className={classes.advancedToggle}
              onClick={() => setShowAdvancedJson(!showAdvancedJson)}
              role="button"
              tabIndex={0}
              aria-expanded={showAdvancedJson}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowAdvancedJson(v => !v); } }}
            >
              {showAdvancedJson ? '▾' : '▸'} Advanced: paste raw A2UI JSON
            </div>
          </div>

          {/* Collapsible JSON editor */}
          {showAdvancedJson && (
            <div className={classes.jsonEditorContainer}>
              <Textarea
                className={classes.jsonTextarea}
                value={jsonInput}
                onChange={(_e, data) => setJsonInput(data.value)}
                placeholder={JSON.stringify([
                  { version: 'v0.9', createSurface: { surfaceId: 'my-test', catalogId: 'kickstart' } },
                  { version: 'v0.9', updateComponents: { surfaceId: 'my-test', components: [
                    { id: 'root', component: 'Column', children: ['t1'] },
                    { id: 't1', component: 'Text', text: 'Hello!', variant: 'h2' },
                  ] } },
                ], null, 2)}
                rows={12}
                resize="vertical"
                spellCheck={false}
                aria-label="A2UI JSON input"
              />
              {jsonError && (
                <MessageBar intent="error" className={classes.errorMessage}>
                  <MessageBarBody>{jsonError}</MessageBarBody>
                </MessageBar>
              )}
              <div className={classes.jsonActions}>
                <Button
                  appearance="primary"
                  size="medium"
                  onClick={handleJsonRender}
                  disabled={!jsonInput.trim()}
                >
                  Render JSON
                </Button>
                <Button
                  appearance="outline"
                  size="medium"
                  onClick={handleSaveAsWidget}
                  disabled={!jsonInput.trim()}
                >
                  Reset
                </Button>
              </div>

              {/* Rendered Custom Surfaces */}
              {customSurfaceEntries.length > 0 && (
                <div style={{ marginTop: tokens.spacingVerticalXL }}>
                  <Body1Strong style={{ marginBottom: tokens.spacingVerticalM }}>
                    Rendered Surfaces ({customSurfaceEntries.length})
                  </Body1Strong>
                  <div className="playground-surfaces">
                    {customSurfaceEntries.map(([id, surface]) => (
                      <Card key={id} appearance="outline" style={{ marginBottom: tokens.spacingVerticalM }}>
                        <CardHeader
                          header={<Caption1 style={{ fontFamily: tokens.fontFamilyMonospace }}>{id}</Caption1>}
                        />
                        <div className={classes.cardBody}>
                          <div className="a2ui-component">
                            <A2UISurfaceWrapper surface={surface} />
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---- Tab 1: Create (chat active — conversation in progress) ---- */}
      {activeTab === 'create' && createMessages.length > 0 && (
        <div id="panel-create" role="tabpanel" aria-labelledby="tab-create" className={classes.createChatShell}>
          {/* Scrollable message area */}
          <div className={classes.createMsgArea} role="log" aria-live="polite" aria-label="Chat messages">
            {createMessages.map((msg, index) => (
              <div key={msg.id} className={classes.createBubbleRow}>
                <div className={msg.role === 'user' ? classes.createBubbleUser : classes.createBubbleAssistant}>
                  {msg.text}
                </div>
                {/* Render A2UI surfaces returned with this message */}
                {msg.surfaceIds && msg.surfaceIds.map(sid => {
                  const surface = createA2ui.getSurface(sid);
                  return surface ? (
                    <div key={sid} className={classes.createSurfaceBlock}>
                      <A2UISurfaceWrapper surface={surface} isActive={index === createMessages.length - 1} />
                    </div>
                  ) : null;
                })}
                {/* Debug panel — shown only when debug mode is active on assistant messages */}
                {debugEnabled && msg.role === 'assistant' && (
                  <DebugPanel debugInfo={msg.debugInfo} />
                )}
              </div>
            ))}

            {/* Loading: waiting for response */}
            {createLoading && (
              <div className={classes.createTypingDots}>
                <span /><span /><span />
              </div>
            )}

            {/* Advanced JSON editor (collapsible, scrolls with messages) */}
            {showAdvancedJson && (
              <div style={{ maxWidth: '760px', width: '100%', margin: `${tokens.spacingVerticalL} auto 0` }}>
                <div className={classes.jsonEditorContainer} style={{ padding: 0 }}>
                  <Textarea
                    className={classes.jsonTextarea}
                    value={jsonInput}
                    onChange={(_e, data) => setJsonInput(data.value)}
                    placeholder={JSON.stringify([
                      { version: 'v0.9', createSurface: { surfaceId: 'my-test', catalogId: 'kickstart' } },
                    ], null, 2)}
                    rows={8}
                    resize="vertical"
                    spellCheck={false}
                  />
                  {jsonError && (
                    <MessageBar intent="error" className={classes.errorMessage}>
                      <MessageBarBody>{jsonError}</MessageBarBody>
                    </MessageBar>
                  )}
                  <div className={classes.jsonActions}>
                    <Button appearance="primary" size="medium" onClick={handleJsonRender} disabled={!jsonInput.trim()}>
                      Render JSON
                    </Button>
                    <Button appearance="outline" size="medium" onClick={handleSaveAsWidget} disabled={!jsonInput.trim()}>
                      Reset
                    </Button>
                  </div>
                  {customSurfaceEntries.length > 0 && (
                    <div style={{ marginTop: tokens.spacingVerticalXL }}>
                      <Body1Strong style={{ marginBottom: tokens.spacingVerticalM }}>
                        Rendered Surfaces ({customSurfaceEntries.length})
                      </Body1Strong>
                      <div className="playground-surfaces">
                        {customSurfaceEntries.map(([id, surface]) => (
                          <Card key={id} appearance="outline" style={{ marginBottom: tokens.spacingVerticalM }}>
                            <CardHeader header={<Caption1 style={{ fontFamily: tokens.fontFamilyMonospace }}>{id}</Caption1>} />
                            <div className={classes.cardBody}>
                              <div className="a2ui-component"><A2UISurfaceWrapper surface={surface} /></div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div ref={createEndRef} />
          </div>

          {/* Pinned input bar */}
          <div className={classes.createInputBar}>
            <div className={classes.createInputRow} style={{ maxWidth: '600px', width: '100%' }}>
              {inspireLoading && <div className="hero-input-progress" />}
              <button
                className={`hero-inspire-btn${inspireLoading ? ' loading' : ''}`}
                aria-label="Inspire me"
                title="Inspire me"
                onClick={handleInspire}
                disabled={inspireLoading || createLoading}
              >
                <Sparkle24Regular />
              </button>
              <input
                className={classes.createInput}
                value={createPrompt}
                onChange={(e) => setCreatePrompt(e.target.value)}
                placeholder="Continue the conversation..."
                aria-label="Continue the conversation"
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateSend(createPrompt); }}
                disabled={createLoading}
                style={{ paddingRight: '48px', paddingLeft: '40px' }}
              />
              <button
                className="hero-send-btn"
                aria-label="Send"
                title="Send"
                onClick={() => handleCreateSend(createPrompt)}
                disabled={!createPrompt.trim() || createLoading}
                style={{ position: 'absolute', right: '8px' }}
              >
                <ArrowRight24Regular style={{ width: '16px', height: '16px' }} />
              </button>
            </div>
            <div className={classes.createChatFooter}>
              <span
                className={classes.startBlankLink}
                onClick={handleStartBlank}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleStartBlank(); } }}
              >Start Blank</span>
              <span className={classes.createFooterSep}>·</span>
              <span
                className={classes.startBlankLink}
                onClick={() => setShowAdvancedJson(v => !v)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowAdvancedJson(v => !v); } }}
              >
                {showAdvancedJson ? 'Hide JSON' : 'Advanced JSON'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ---- Tab 2: Ideas (curated scenario compositions — #987) ---- */}
      {activeTab === 'ideas' && (
        <div id="panel-ideas" role="tabpanel" aria-labelledby="tab-ideas" className="playground-gallery-scroll" data-testid="playground-ideas-panel">
          {Array.from(scenariosByPack.entries()).map(([pack, packScenarios]) => (
            <div key={pack}>
              <Subtitle2 className={classes.groupHeader}>{pack}</Subtitle2>
              <div className={classes.componentGrid}>
                {packScenarios.map((scenario) => (
                  <ComponentCardErrorBoundary key={scenario.key} label={scenario.key}>
                    <ScenarioCard scenario={scenario} onCardClick={handleScenarioCardClick} />
                  </ComponentCardErrorBoundary>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---- Tab 3: Components (grouped by pack name — Phase C) ---- */}
      {activeTab === 'components' && (
        <div id="panel-components" role="tabpanel" aria-labelledby="tab-components" className="playground-gallery-scroll">
          {registryError ? (
            registryError.includes('401') ? (
              <div className={classes.emptyState}>
                <div className={classes.emptyIcon}>
                  <img src="/assets/icons/fluent/grid.svg" alt="" width="32" height="32" style={{ opacity: 0.4 }} />
                </div>
                <Body1Strong>Sign in to view components</Body1Strong>
                <Caption1 style={{ color: tokens.colorNeutralForeground3, marginTop: tokens.spacingVerticalS }}>
                  The component registry requires authentication. See issue <a href="https://github.com/azure-management-and-platforms/kickstart/issues/955" target="_blank" rel="noopener noreferrer">#955</a>.
                </Caption1>
              </div>
            ) : (
              <MessageBar intent="error" style={{ margin: tokens.spacingHorizontalL }}>
                <MessageBarBody>Failed to load registry: {registryError}</MessageBarBody>
              </MessageBar>
            )
          ) : filteredComponents.length === 0 ? (
            <div className={classes.emptyState}>
              <div className={classes.emptyIcon}>
                <img src="/assets/icons/fluent/grid.svg" alt="" width="32" height="32" style={{ opacity: 0.4 }} />
              </div>
              <Body1Strong>{registryLoading ? 'Loading components…' : 'No components registered'}</Body1Strong>
              {!registryLoading && (
                <Caption1 style={{ color: tokens.colorNeutralForeground3, marginTop: tokens.spacingVerticalS }}>
                  Components come from registered packs.
                </Caption1>
              )}
            </div>
          ) : (
            Array.from(groupByPack(filteredComponents, c => c.name).entries()).map(([pack, comps]) => {
              const allEmpty = comps.every(c => !COMPONENT_PREVIEWS[c.name]);
              return (
                <div key={pack}>
                  <Subtitle2 className={classes.groupHeader}>{pack}</Subtitle2>
                  {allEmpty && (
                    <div className={classes.compPackBanner}>
                      Previews unavailable for pack-only components — showing compact cards.
                    </div>
                  )}
                  <div className={allEmpty ? classes.componentCompactGrid : classes.componentGrid}>
                    {comps.map(comp => (
                      <ComponentCardErrorBoundary key={comp.name} label={comp.name}>
                        <ComponentCard comp={comp} onCardClick={handleComponentCardClick} compact={allEmpty} />
                      </ComponentCardErrorBoundary>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ---- Tab 4: Icons ---- */}
      {activeTab === 'icons' && (
        <div id="panel-icons" role="tabpanel" aria-labelledby="tab-icons" className="playground-create-scroll">
          <div style={{ padding: tokens.spacingHorizontalL }}>
            {/* Section tabs */}
            <TabList
              selectedValue={iconSection}
              onTabSelect={(_e, data) => setIconSection(data.value as string)}
              size="small"
              style={{ marginBottom: tokens.spacingVerticalM }}
            >
              {ICON_SECTIONS.map(section => (
                <Tab key={section.label} value={section.label}>{section.label}</Tab>
              ))}
            </TabList>

            <Caption1 style={{ display: 'block', marginBottom: tokens.spacingVerticalM, color: tokens.colorNeutralForeground3 }}>
              Click an icon to copy its name to clipboard. Azure/UI/Fluent 2 use path references; Fluent React icons use the registered name.
            </Caption1>

            {filteredIconCategories.map(cat => (
              <div key={cat.id}>
                <Subtitle2 className={classes.groupHeader}>
                  {cat.label}
                  <Caption1 style={{ marginLeft: tokens.spacingHorizontalS, color: tokens.colorNeutralForeground3 }}>
                    ({cat.icons.length})
                  </Caption1>
                </Subtitle2>
                <div className={classes.iconGrid}>
                  {cat.icons.map(icon => {
                    const FluentReactIcon = cat.type === 'fluent-react' ? getFluentIcon(icon.name) : null;
                    return (
                      <Card
                        key={icon.path}
                        appearance="outline"
                        className={classes.iconCard}
                        onClick={() => handleCopyIcon(icon)}
                        title={`${icon.name}\nClick to copy name`}
                        aria-label={`${icon.name} — copy icon name`}
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCopyIcon(icon); } }}
                      >
                        {FluentReactIcon ? (
                          <span style={{ width: 32, height: 32, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: tokens.colorNeutralForeground1 }}>
                            <FluentReactIcon fontSize={24} />
                          </span>
                        ) : (
                          <img
                            src={icon.path}
                            alt={icon.name}
                            className={classes.iconSymbol}
                            loading="lazy"
                            style={{ width: 32, height: 32, objectFit: 'contain' }}
                          />
                        )}
                        <Caption1 style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '100%',
                        }}>{icon.name}</Caption1>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}

            {filteredIconCategories.length === 0 && (
              <div className={classes.emptyState}>
                <div className={classes.emptyIcon}>
                  <img src="/assets/icons/general/search.svg" alt="" width="32" height="32" style={{ opacity: 0.4 }} />
                </div>
                <Body1Strong>No icons match "{iconFilter}"</Body1Strong>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- Tab 5: Workspace ---- */}
      {activeTab === 'workspace' && (
        <div id="panel-workspace" role="tabpanel" aria-labelledby="tab-workspace" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <PlaygroundWorkspace />
        </div>
      )}

      {/* ---- Component Detail Dialog ---- */}
      <Dialog open={componentDialogOpen} onOpenChange={(_e, data) => setComponentDialogOpen(data.open)}>
        <DialogSurface className={classes.dialogSurface}>
          <DialogBody>
            <DialogTitle
              action={
                <Button
                  appearance="subtle"
                  aria-label="Dismiss"
                  icon={<Dismiss24Regular />}
                  onClick={() => setComponentDialogOpen(false)}
                />
              }
            >
              {selectedComponent?.name}
            </DialogTitle>
            <DialogContent>
              <div className={classes.dialogContent}>
                {/* Detail Tabs */}
                <TabList
                  selectedValue={componentDetailTab}
                  onTabSelect={(_e, data) => setComponentDetailTab(data.value as 'preview' | 'json')}
                  size="small"
                  className={classes.detailTabs}
                >
                  <Tab value="preview">Preview</Tab>
                  <Tab value="json">JSON</Tab>
                </TabList>

                {componentDetailTab === 'preview' ? (
                  <div>
                    {selectedComponent && COMPONENT_PREVIEWS[selectedComponent.name] ? (
                      /* A2UIEnvelopePreview — same render engine as Chat */
                      <A2UIEnvelopePreview
                        surfaceId={`comp-detail-${selectedComponent.name}`}
                        components={COMPONENT_PREVIEWS[selectedComponent.name]}
                        loading={
                          <div style={{ padding: tokens.spacingVerticalL, color: tokens.colorNeutralForeground4, fontSize: tokens.fontSizeBase200 }}>
                            Loading preview…
                          </div>
                        }
                      />
                    ) : (
                      <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                        No preview available for this component.
                      </Caption1>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className={classes.jsonCopyRow}>
                      <Button
                        appearance="subtle"
                        size="small"
                        icon={<Copy24Regular />}
                        onClick={handleCopyComponentJson}
                        disabled={!componentJson}
                        aria-label="Copy JSON to clipboard"
                      >
                        {jsonCopied ? 'Copied!' : 'Copy'}
                      </Button>
                    </div>
                    {componentJson ? (
                      <pre className={classes.jsonCodeBlock}>{componentJson}</pre>
                    ) : (
                      <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                        No JSON preview registered for this component.
                      </Caption1>
                    )}
                  </div>
                )}
              </div>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setComponentDialogOpen(false)}>Close</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>

      {/* ---- Scenario Detail Dialog (Ideas tab — #987) ---- */}
      <Dialog open={scenarioDialogOpen} onOpenChange={(_e, data) => setScenarioDialogOpen(data.open)}>
        <DialogSurface className={classes.dialogSurface}>
          <DialogBody>
            <DialogTitle
              action={
                <Button
                  appearance="subtle"
                  aria-label="Dismiss"
                  icon={<Dismiss24Regular />}
                  onClick={() => setScenarioDialogOpen(false)}
                />
              }
            >
              {selectedScenario?.title}
            </DialogTitle>
            <DialogContent>
              <div className={classes.dialogContent}>
                {selectedScenario && (
                  <Caption1 style={{ display: 'block', marginBottom: tokens.spacingVerticalS, color: tokens.colorNeutralForeground3 }}>
                    {selectedScenario.pack} · {selectedScenario.description}
                  </Caption1>
                )}
                <TabList
                  selectedValue={scenarioDetailTab}
                  onTabSelect={(_e, data) => setScenarioDetailTab(data.value as 'preview' | 'json')}
                  size="small"
                  className={classes.detailTabs}
                >
                  <Tab value="preview">Preview</Tab>
                  <Tab value="json">JSON</Tab>
                </TabList>

                {scenarioDetailTab === 'preview' ? (
                  <div>
                    {selectedScenario ? (
                      <A2UIEnvelopePreview
                        surfaceId={`scenario-detail-${selectedScenario.key}`}
                        components={selectedScenario.components as Array<Record<string, any>>}
                        loading={
                          <div style={{ padding: tokens.spacingVerticalL, color: tokens.colorNeutralForeground4, fontSize: tokens.fontSizeBase200 }}>
                            Loading preview…
                          </div>
                        }
                      />
                    ) : (
                      <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                        No scenario selected.
                      </Caption1>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className={classes.jsonCopyRow}>
                      <Button
                        appearance="subtle"
                        size="small"
                        icon={<Copy24Regular />}
                        onClick={handleCopyScenarioJson}
                        disabled={!scenarioJson}
                        aria-label="Copy scenario JSON to clipboard"
                      >
                        {scenarioJsonCopied ? 'Copied!' : 'Copy'}
                      </Button>
                    </div>
                    {scenarioJson ? (
                      <pre className={classes.jsonCodeBlock}>{scenarioJson}</pre>
                    ) : (
                      <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                        No JSON available for this scenario.
                      </Caption1>
                    )}
                  </div>
                )}
              </div>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setScenarioDialogOpen(false)}>Close</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
        </div>{/* end mainContent */}
      </div>{/* end shellRow */}
    </div>
  );
}

// ---- Playground export ----

export function Playground() {
  return (
    <PlaygroundInner />
  );
}
