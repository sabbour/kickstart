/**
 * Playground — A2UI Gallery (5-tab architecture).
 *
 * Access via ?playground URL parameter.
 * Tabs: Create | Gallery | Components | Icons | Widgets
 */

import React, { useState, useCallback, useRef, useMemo, useEffect, memo } from 'react';
import {
  Button, CounterBadge, SearchBox,
  Card, CardHeader,
  Textarea, Text, Subtitle2, Caption1, Body1Strong, Body1,
  MessageBar, MessageBarBody,
  TabList, Tab, Input,
  Dialog, DialogTrigger, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions,
  makeStyles, tokens,
} from '@fluentui/react-components';
import { Dismiss24Regular, Copy24Regular, Delete24Regular, DocumentCopy24Regular, Sparkle24Regular } from '@fluentui/react-icons';
import { useA2UI } from '../hooks/useA2UI';
import { WidgetsProvider, useWidgets } from '../hooks/useWidgets';
import { getDemoResponse, resetDemoState } from '../services/demo-scenarios';
import { A2UISurfaceWrapper } from '../components/A2UI/A2UISurfaceWrapper';
import type { A2uiMsg, ChatMessage } from '../types';
import type { SurfaceModel } from '../vendor/a2ui/web_core/index';
import type { ReactComponentImplementation } from '../vendor/a2ui/react/adapter';
import {
  KICKSTART_SCENARIOS,
  CONTROL_SCENARIOS,
  type ScenarioDef,
} from './playground-scenarios';
import {
  ALL_ICON_CATEGORIES,
  AZURE_ICON_CATEGORIES,
  UI_ICON_CATEGORIES,
  FLUENT_ICON_CATEGORY,
  FLUENT_REACT_ICON_CATEGORY,
  TOTAL_ICON_COUNT,
  type IconCategory,
  type IconEntry,
} from './playground-icons';
import { getFluentIcon } from '../catalog/icons/fluent-icons';

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

// Scenario grouping for tabs
const GALLERY_GROUPS = ['Kickstart Scenarios', 'Data Binding', 'Events & Actions', 'Surface Lifecycle', 'Dynamic Patterns'];
const COMPONENT_GROUPS = ['Layout', 'Content', 'Inputs', 'Custom Controls'];

const GALLERY_SCENARIOS = [...KICKSTART_SCENARIOS, ...CONTROL_SCENARIOS].filter(s => GALLERY_GROUPS.includes(s.group));
const COMPONENT_SCENARIOS = CONTROL_SCENARIOS.filter(s => COMPONENT_GROUPS.includes(s.group));

const useStyles = makeStyles({
  playgroundPage: {
    fontFamily: tokens.fontFamilyBase,
  },
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
    flexShrink: 0,
  },
  tabsContainer: {
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    flexShrink: 0,
    display: 'flex',
    flexDirection: 'column' as const,
  },
  tabHint: {
    paddingLeft: tokens.spacingHorizontalXXS,
    paddingBottom: tokens.spacingVerticalS,
    color: tokens.colorNeutralForeground4,
    fontSize: tokens.fontSizeBase200,
    lineHeight: tokens.lineHeightBase200,
  },
  galleryCard: {
    backgroundColor: tokens.colorNeutralBackground1,
    borderRadius: tokens.borderRadiusXLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    boxShadow: tokens.shadow4,
    cursor: 'pointer',
    transition: 'box-shadow 0.2s ease, transform 0.15s ease',
    breakInside: 'avoid' as const,
    marginBottom: tokens.spacingVerticalM,
    overflow: 'hidden',
    ':hover': {
      boxShadow: tokens.shadow16,
      transform: 'translateY(-3px)',
    },
    ':focus-visible': {
      outline: `2px solid ${tokens.colorBrandStroke1}`,
      outlineOffset: '2px',
      boxShadow: tokens.shadow16,
    },
  },
  cardLabel: {
    display: 'block',
    paddingTop: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    fontWeight: tokens.fontWeightSemibold,
  },
  cardDescription: {
    display: 'block',
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalXS,
    color: tokens.colorNeutralForeground4,
    fontSize: tokens.fontSizeBase200,
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
    alignItems: 'center',
    width: '100%',
    maxWidth: '600px',
    position: 'relative',
    borderRadius: tokens.borderRadiusMedium,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    backgroundColor: tokens.colorNeutralBackground1,
    transition: 'border-color 0.15s ease',
    ':focus-within': {
      borderTopColor: tokens.colorBrandStroke1,
      borderRightColor: tokens.colorBrandStroke1,
      borderBottomColor: tokens.colorBrandStroke1,
      borderLeftColor: tokens.colorBrandStroke1,
    },
  },
  createInput: {
    flex: 1,
    minHeight: '44px',
    maxHeight: '200px',
    border: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    fontSize: tokens.fontSizeBase400,
    fontFamily: tokens.fontFamilyBase,
    color: tokens.colorNeutralForeground1,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: '80px',
    paddingTop: '11px',
    paddingBottom: '11px',
    boxSizing: 'border-box' as const,
    lineHeight: '1.43',
    '::placeholder': {
      color: tokens.colorNeutralForeground3,
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
  widgetGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
    gap: tokens.spacingVerticalM,
    marginTop: tokens.spacingVerticalM,
  },
  widgetCard: {
    cursor: 'pointer',
    transition: 'box-shadow 0.2s ease',
    ':hover': {
      boxShadow: tokens.shadow8,
    },
  },
  widgetActions: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
    marginTop: tokens.spacingVerticalS,
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

// ---- GalleryCardErrorBoundary ----
// Isolates crashes in individual gallery cards so one broken card
// doesn't bring down the whole gallery.
interface ErrorBoundaryState { hasError: boolean; message: string }
class GalleryCardErrorBoundary extends React.Component<
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

// ---- GalleryCard Component ----
interface GalleryCardProps {
  scenario: ScenarioDef;
  onCardClick: (scenario: ScenarioDef, surfaces: Map<string, SurfaceModel<ReactComponentImplementation>>) => void;
}

const GalleryCard = memo(({ scenario, onCardClick }: GalleryCardProps) => {
  const classes = useStyles();
  const { surfaces, processMessages, processor } = useA2UI();

  // Process scenario messages in useEffect.
  // Cleanup deletes surfaces so React 19 Strict Mode double-fire doesn't crash.
  useEffect(() => {
    let createdIds: string[] = [];
    if (scenario.generate) {
      const msgs = scenario.generate();
      createdIds = processMessages(msgs);
    } else if (scenario.keyword) {
      const keyword = scenario.keyword;
      if (keyword === '__welcome__') {
        resetDemoState();
        const resp = getDemoResponse('anything');
        createdIds = processMessages(resp.a2uiMessages);
      } else {
        resetDemoState();
        getDemoResponse('skip'); // burn turn 1 (WELCOME)
        const resp = getDemoResponse(keyword);
        createdIds = processMessages(resp.a2uiMessages);
      }
    }
    return () => {
      for (const id of createdIds) {
        try { processor.model.deleteSurface(id); } catch { /* already gone */ }
      }
    };
    // processMessages and processor are stable (useCallback / ref-based)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario]);

  const surfaceEntries = Array.from(surfaces.entries());

  return (
    <div
      className={classes.galleryCard}
      role="button"
      tabIndex={0}
      aria-label={scenario.label}
      onClick={() => onCardClick(scenario, surfaces)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onCardClick(scenario, surfaces); } }}
    >
      <Caption1 className={classes.cardLabel}>
        {scenario.label}
        {scenario.catalog && (
          <span className={classes.catalogBadge}>{scenario.catalog}</span>
        )}
      </Caption1>
      {scenario.description && (
        <Caption1 className={classes.cardDescription}>{scenario.description}</Caption1>
      )}
      <div className={classes.cardBody}>
        {surfaceEntries.length === 0 ? (
          <div style={{ padding: '12px 0', color: tokens.colorNeutralForeground4, fontSize: tokens.fontSizeBase200 }}>
            Loading…
          </div>
        ) : (
          surfaceEntries.map(([id, surface]) => (
            <div key={id} className="a2ui-component">
              <A2UISurfaceWrapper surface={surface} />
            </div>
          ))
        )}
      </div>
    </div>
  );
});

GalleryCard.displayName = 'GalleryCard';

// ---- WidgetCard Component ----
interface WidgetCardProps {
  widget: { id: string; name: string; createdAt: number; messages: A2uiMsg[] };
  onWidgetClick: (widgetId: string) => void;
  onDuplicate: (widgetId: string) => void;
  onDelete: (widgetId: string) => void;
}

const WidgetCard = memo(({ widget, onWidgetClick, onDuplicate, onDelete }: WidgetCardProps) => {
  const classes = useStyles();
  const { surfaces, processMessages, processor } = useA2UI();

  useEffect(() => {
    const createdIds = processMessages(widget.messages);
    return () => {
      for (const id of createdIds) {
        try { processor.model.deleteSurface(id); } catch { /* already gone */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widget.messages]);

  const surfaceEntries = Array.from(surfaces.entries());

  return (
    <Card
      appearance="outline"
      className={classes.widgetCard}
      onClick={() => onWidgetClick(widget.id)}
    >
      <CardHeader header={<Body1Strong>{widget.name}</Body1Strong>} />
      <div className={classes.cardBody}>
        {surfaceEntries.map(([id, surface]) => (
          <div key={id} className="a2ui-component">
            <A2UISurfaceWrapper surface={surface} />
          </div>
        ))}
      </div>
      <div className={classes.widgetActions} onClick={(e) => e.stopPropagation()}>
        <Button
          appearance="subtle"
          size="small"
          aria-label="Duplicate widget"
          icon={<DocumentCopy24Regular />}
          onClick={() => onDuplicate(widget.id)}
        />
        <Button
          appearance="subtle"
          size="small"
          aria-label="Delete widget"
          icon={<Delete24Regular />}
          onClick={() => onDelete(widget.id)}
        />
      </div>
    </Card>
  );
});

WidgetCard.displayName = 'WidgetCard';

// ---- WidgetPreview Component (for dialog) ----
interface WidgetPreviewProps {
  widget: { id: string; name: string; createdAt: number; messages: A2uiMsg[] };
}

const WidgetPreview = memo(({ widget }: WidgetPreviewProps) => {
  const { surfaces, processMessages, processor } = useA2UI();

  useEffect(() => {
    const createdIds = processMessages(widget.messages);
    return () => {
      for (const id of createdIds) {
        try { processor.model.deleteSurface(id); } catch { /* already gone */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widget.messages]);

  const surfaceEntries = Array.from(surfaces.entries());

  return (
    <>
      {surfaceEntries.map(([id, surface]) => (
        <div key={id} style={{ marginBottom: tokens.spacingVerticalM }}>
          <div className="a2ui-component">
            <A2UISurfaceWrapper surface={surface} />
          </div>
        </div>
      ))}
    </>
  );
});

WidgetPreview.displayName = 'WidgetPreview';

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
  const [activeTab, setActiveTab] = useState<'create' | 'gallery' | 'components' | 'icons' | 'widgets'>('gallery');
  const [filterQuery, setFilterQuery] = useState('');
  const [iconFilter, setIconFilter] = useState('');
  const [iconSection, setIconSection] = useState<string>('Azure Services');
  const [jsonInput, setJsonInput] = useState('');
  const [widgetName, setWidgetName] = useState('My Widget');
  const [jsonError, setJsonError] = useState('');
  const [createPrompt, setCreatePrompt] = useState('');
  const [showAdvancedJson, setShowAdvancedJson] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<ScenarioDef | null>(null);
  const [selectedSurfaces, setSelectedSurfaces] = useState<Map<string, SurfaceModel<ReactComponentImplementation>>>(new Map());
  const [selectedWidget, setSelectedWidget] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'preview' | 'json'>('preview');
  const customCounter = useRef(0);
  const customA2ui = useA2UI(); // For custom JSON editor
  const createA2ui = useA2UI(); // For Create tab chat
  const [createLoading, setCreateLoading] = useState(false);
  const createSessionIdRef = useRef<string | undefined>(undefined);
  const createEndRef = useRef<HTMLDivElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const iconSearchRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const createInputRef = useRef<HTMLTextAreaElement>(null);
  const [createMessages, setCreateMessages] = useState<ChatMessage[]>([]);
  const { widgets, addWidget, updateWidget, deleteWidget, duplicateWidget } = useWidgets();
  const [inspireLoading, setInspireLoading] = useState(false);
  const inspireAbortRef = useRef<AbortController | null>(null);

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
      const res = await fetch('/api/inspirations/widgets?stream=true', { signal: controller.signal });
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
        const res = await fetch('/api/inspirations/widgets');
        if (res.ok) {
          const ideas = await res.json();
          if (Array.isArray(ideas) && ideas.length > 0) {
            setCreatePrompt(ideas[0].prompt);
          }
        }
      } catch { /* ignore */ }
      setInspireLoading(false);
    } finally {
      inspireAbortRef.current = null;
    }
  }, []);

  // Filter scenarios
  const filteredGalleryScenarios = useMemo(() => {
    if (!filterQuery.trim()) return GALLERY_SCENARIOS;
    const query = filterQuery.toLowerCase();
    return GALLERY_SCENARIOS.filter(s => 
      s.label.toLowerCase().includes(query) || 
      s.description.toLowerCase().includes(query)
    );
  }, [filterQuery]);

  const filteredComponentScenarios = useMemo(() => {
    if (!filterQuery.trim()) return COMPONENT_SCENARIOS;
    const query = filterQuery.toLowerCase();
    return COMPONENT_SCENARIOS.filter(s => 
      s.label.toLowerCase().includes(query) || 
      s.description.toLowerCase().includes(query)
    );
  }, [filterQuery]);

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

  // Filter scenarios (old variable for compatibility)
  const filteredScenarios = filteredGalleryScenarios;

  // Handle card click → open detail dialog
  const handleCardClick = useCallback((scenario: ScenarioDef, surfaces: Map<string, SurfaceModel<ReactComponentImplementation>>) => {
    setSelectedScenario(scenario);
    setSelectedSurfaces(surfaces);
    setDetailTab('preview');
    setDialogOpen(true);
  }, []);

  // Handle custom JSON render
  const handleJsonRender = useCallback(() => {
    setJsonError('');
    try {
      const parsed = JSON.parse(jsonInput);
      const msgs: A2uiMsg[] = Array.isArray(parsed) ? parsed : [parsed];
      for (const m of msgs) {
        if (!m.version) throw new Error('Each message must have a "version" field');
      }
      customA2ui.processMessages(msgs);
      customCounter.current++;
      setJsonInput('');
    } catch (err: any) {
      setJsonError(err.message || 'Invalid JSON');
    }
  }, [jsonInput, customA2ui]);

  // Handle save as widget
  const handleSaveAsWidget = useCallback(() => {
    setJsonError('');
    try {
      const parsed = JSON.parse(jsonInput);
      const msgs: A2uiMsg[] = Array.isArray(parsed) ? parsed : [parsed];
      for (const m of msgs) {
        if (!m.version) throw new Error('Each message must have a "version" field');
      }
      addWidget(widgetName, msgs);
      setWidgetName('My Widget');
      setJsonInput('');
      setActiveTab('widgets');
    } catch (err: any) {
      setJsonError(err.message || 'Invalid JSON');
    }
  }, [jsonInput, widgetName, addWidget]);

  // Handle "Start Blank" — create empty widget and switch to widgets tab
  const handleStartBlank = useCallback(() => {
    const blankMessages: A2uiMsg[] = [
      { version: 'v0.9', createSurface: { surfaceId: 'blank-widget', catalogId: 'kickstart' } },
      { version: 'v0.9', updateComponents: { surfaceId: 'blank-widget', components: [
        { id: 'root', component: 'Column', children: ['t1'] },
        { id: 't1', component: 'Text', text: 'New widget — edit the JSON to build something!', variant: 'body1' },
      ] } },
    ];
    addWidget('Untitled widget', blankMessages);
    setActiveTab('widgets');
  }, [addWidget]);

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
        if (activeTab === 'gallery' || activeTab === 'components') {
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
      const res = await fetch('/api/playground', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: createSessionIdRef.current,
          message: text,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `API error: ${res.status}` }));
        throw new Error(err.error || `API error: ${res.status}`);
      }

      const data = await res.json() as { sessionId: string; message: string; a2ui?: object[] };

      if (data.sessionId && !createSessionIdRef.current) {
        createSessionIdRef.current = data.sessionId;
      }

      // Process A2UI components through the surface system
      let surfaceIds: string[] | undefined;
      if (data.a2ui && data.a2ui.length > 0) {
        const surfaceId = `pg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const components = normalizePlaygroundComponents(data.a2ui as any[]);
        const a2uiMessages: A2uiMsg[] = [
          { version: 'v0.9', createSurface: { surfaceId, catalogId: 'kickstart' } },
          { version: 'v0.9', updateComponents: { surfaceId, components } },
        ];
        surfaceIds = createA2ui.processMessages(a2uiMessages);
      }

      const assistantMsg: ChatMessage = {
        id: `create-${Date.now()}-assistant`,
        role: 'assistant',
        text: data.message,
        surfaceIds: surfaceIds && surfaceIds.length > 0 ? surfaceIds : undefined,
        timestamp: Date.now(),
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
  }, [createLoading, createA2ui]);

  // Handle clear all
  const handleClearAll = useCallback(() => {
    customA2ui.reset();
    setJsonInput('');
    setJsonError('');
    resetDemoState();
    // Also reset the Create tab chat
    createA2ui.reset();
    setCreateMessages([]);
    createSessionIdRef.current = undefined;
  }, [customA2ui, createA2ui]);

  // Arrow key navigation within the gallery grid
  const handleGalleryKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp'].includes(e.key)) return;
    const cards = galleryRef.current?.querySelectorAll<HTMLElement>('[role="button"]');
    if (!cards || cards.length === 0) return;
    const arr = Array.from(cards);
    const idx = arr.indexOf(document.activeElement as HTMLElement);
    if (idx === -1) return;
    e.preventDefault();
    const next = e.key === 'ArrowRight' || e.key === 'ArrowDown'
      ? Math.min(idx + 1, arr.length - 1)
      : Math.max(idx - 1, 0);
    arr[next]?.focus();
  }, []);

  // Handle copy icon path
  const handleCopyIcon = useCallback((icon: IconEntry) => {
    navigator.clipboard.writeText(icon.path);
  }, []);

  // Handle widget click
  const handleWidgetClick = useCallback((widgetId: string) => {
    setSelectedWidget(widgetId);
    setDetailTab('preview');
    setDialogOpen(true);
  }, []);

  // Get JSON for selected scenario
  const getScenarioJson = useCallback(() => {
    if (!selectedScenario) return '';
    
    if (selectedScenario.generate) {
      const msgs = selectedScenario.generate();
      return JSON.stringify(msgs, null, 2);
    }

    const keyword = selectedScenario.keyword!;
    let msgs: A2uiMsg[];
    if (keyword === '__welcome__') {
      resetDemoState();
      msgs = getDemoResponse('anything').a2uiMessages;
    } else {
      resetDemoState();
      getDemoResponse('skip'); // burn turn 1 (WELCOME)
      msgs = getDemoResponse(keyword).a2uiMessages;
    }
    return JSON.stringify(msgs, null, 2);
  }, [selectedScenario]);

  const customSurfaceEntries = Array.from(customA2ui.surfaces.entries());

  // Determine counter for topbar
  const getCounter = () => {
    switch (activeTab) {
      case 'gallery': return filteredGalleryScenarios.length;
      case 'components': return filteredComponentScenarios.length;
      case 'icons': return filteredIconCount;
      case 'widgets': return widgets.length;
      case 'create': return customSurfaceEntries.length;
      default: return 0;
    }
  };

  return (
    <div className={`playground-page ${classes.playgroundPage}`}>
      {/* ---- Top bar ---- */}
      <div className={classes.topbar}>
        <div className={classes.topbarLeft}>
          <Body1Strong style={{ color: tokens.colorNeutralForeground2 }}>A2UI Playground</Body1Strong>
          <CounterBadge
            count={getCounter()}
            appearance="filled"
            color="brand"
            overflowCount={999}
            size="small"
          />
        </div>
        {(activeTab === 'gallery' || activeTab === 'components') && (
          <div className={classes.topbarCenter} ref={searchBoxRef}>
            <SearchBox
              placeholder="Filter scenarios..."
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
          {activeTab === 'create' && (
            <Button appearance="outline" size="small" onClick={handleClearAll}>Clear All</Button>
          )}
          <Caption1 style={{ color: tokens.colorNeutralForeground3, marginLeft: '12px' }}>
            v{(window as any).__BUILD_VERSION__ || '0.0.0'} · {(window as any).__BUILD_SHA__ || 'dev'}
          </Caption1>
        </div>
      </div>

      {/* ---- Tabs: Create | Gallery | Components | Icons | Widgets ---- */}
      <div className={classes.tabsContainer}>
        <TabList
          selectedValue={activeTab}
          onTabSelect={(_e, data) => setActiveTab(data.value as any)}
          size="medium"
        >
          <Tab id="tab-create" value="create" aria-controls="panel-create">Create</Tab>
          <Tab id="tab-gallery" value="gallery" aria-controls="panel-gallery">Ideas</Tab>
          <Tab id="tab-components" value="components" aria-controls="panel-components">Components</Tab>
          <Tab id="tab-icons" value="icons" aria-controls="panel-icons">Icons</Tab>
          <Tab id="tab-widgets" value="widgets" aria-controls="panel-widgets">Widgets</Tab>
        </TabList>
        <Caption1 style={{ color: tokens.colorNeutralForeground3, paddingTop: tokens.spacingVerticalXS, paddingBottom: tokens.spacingVerticalXS }}>
          {activeTab === 'create' && 'Build A2UI components with AI'}
          {activeTab === 'gallery' && 'Browse pre-built demo scenarios'}
          {activeTab === 'components' && 'A2UI component reference'}
          {activeTab === 'icons' && 'Fluent icon browser'}
          {activeTab === 'widgets' && 'Your saved widget library'}
        </Caption1>
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
                <img src="assets/icons/commands/go.svg" width="16" height="16" alt="" />
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
              <Input
                value={widgetName}
                onChange={(_e, data) => setWidgetName(data.value)}
                placeholder="Widget name..."
                aria-label="Widget name"
                style={{ marginBottom: tokens.spacingVerticalM }}
              />
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
                  disabled={!jsonInput.trim() || !widgetName.trim()}
                >
                  Save as Widget
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
                  <Input
                    value={widgetName}
                    onChange={(_e, data) => setWidgetName(data.value)}
                    placeholder="Widget name..."
                    style={{ marginBottom: tokens.spacingVerticalM }}
                  />
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
                    <Button appearance="outline" size="medium" onClick={handleSaveAsWidget} disabled={!jsonInput.trim() || !widgetName.trim()}>
                      Save as Widget
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
              <input
                className={classes.createInput}
                value={createPrompt}
                onChange={(e) => setCreatePrompt(e.target.value)}
                placeholder="Continue the conversation..."
                aria-label="Continue the conversation"
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreateSend(createPrompt); }}
                disabled={createLoading}
                style={{ paddingRight: '48px' }}
              />
              <button
                className="hero-send-btn"
                aria-label="Send"
                title="Send"
                onClick={() => handleCreateSend(createPrompt)}
                disabled={!createPrompt.trim() || createLoading}
                style={{ position: 'absolute', right: '8px' }}
              >
                <img src="assets/icons/commands/go.svg" width="16" height="16" alt="" />
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

      {/* ---- Tab 2: Gallery (Scenarios) ---- */}
      {activeTab === 'gallery' && (
        <div id="panel-gallery" role="tabpanel" aria-labelledby="tab-gallery" className="playground-gallery-scroll">
          <div className="playground-gallery" ref={galleryRef} onKeyDown={handleGalleryKeyDown}>
            {filteredGalleryScenarios.map(scenario => (
              <GalleryCardErrorBoundary key={scenario.id} label={scenario.label}>
                <GalleryCard scenario={scenario} onCardClick={handleCardClick} />
              </GalleryCardErrorBoundary>
            ))}
          </div>
        </div>
      )}

      {/* ---- Tab 3: Basic Components ---- */}
      {activeTab === 'components' && (
        <div id="panel-components" role="tabpanel" aria-labelledby="tab-components" className="playground-gallery-scroll">
          {COMPONENT_GROUPS.map(group => {
            const groupScenarios = filteredComponentScenarios.filter(s => s.group === group);
            if (groupScenarios.length === 0) return null;
            return (
              <div key={group}>
                <Subtitle2 className={classes.groupHeader}>{group}</Subtitle2>
                <div className="playground-gallery">
                  {groupScenarios.map(scenario => (
                    <GalleryCardErrorBoundary key={scenario.id} label={scenario.label}>
                      <GalleryCard scenario={scenario} onCardClick={handleCardClick} />
                    </GalleryCardErrorBoundary>
                  ))}
                </div>
              </div>
            );
          })}
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

      {/* ---- Tab 5: Widgets ---- */}
      {activeTab === 'widgets' && (
        <div id="panel-widgets" role="tabpanel" aria-labelledby="tab-widgets" className="playground-create-scroll">
          <div className={classes.jsonEditorContainer}>
            <Body1Strong style={{ marginBottom: tokens.spacingVerticalM }}>
              My Widgets
            </Body1Strong>
            {widgets.length === 0 ? (
              <div className={classes.emptyState}>
                <div className={classes.emptyIcon}>
                  <img src="/assets/icons/fluent/card-ui.svg" alt="" width="32" height="32" style={{ opacity: 0.4 }} />
                </div>
                <Body1Strong>No widgets yet</Body1Strong>
                <Caption1 style={{ color: tokens.colorNeutralForeground3, marginTop: tokens.spacingVerticalS }}>
                  Go to the Create tab to build your first widget.
                </Caption1>
              </div>
            ) : (
              <div className={classes.widgetGrid}>
                {widgets.map(widget => (
                  <WidgetCard
                    key={widget.id}
                    widget={widget}
                    onWidgetClick={handleWidgetClick}
                    onDuplicate={duplicateWidget}
                    onDelete={deleteWidget}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- Detail Dialog ---- */}
      <Dialog open={dialogOpen} onOpenChange={(_e, data) => setDialogOpen(data.open)}>
        <DialogSurface className={classes.dialogSurface}>
          <DialogBody>
            <DialogTitle
              action={
                <Button
                  appearance="subtle"
                  aria-label="Dismiss"
                  icon={<Dismiss24Regular />}
                  onClick={() => setDialogOpen(false)}
                />
              }
            >
              {selectedScenario?.label || widgets.find(w => w.id === selectedWidget)?.name}
            </DialogTitle>
            <DialogContent>
              <div className={classes.dialogContent}>
                {selectedScenario && (
                  <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                    {selectedScenario.description}
                  </Caption1>
                )}

                {/* Detail Tabs */}
                <TabList
                  selectedValue={detailTab}
                  onTabSelect={(_e, data) => setDetailTab(data.value as 'preview' | 'json')}
                  size="small"
                  className={classes.detailTabs}
                >
                  <Tab value="preview">Preview</Tab>
                  <Tab value="json">JSON</Tab>
                </TabList>

                {detailTab === 'preview' ? (
                  <div>
                    {selectedScenario && Array.from(selectedSurfaces.entries()).map(([id, surface]) => (
                      <div key={id} style={{ marginBottom: tokens.spacingVerticalM }}>
                        <div className="a2ui-component">
                          <A2UISurfaceWrapper surface={surface} />
                        </div>
                      </div>
                    ))}
                    {selectedWidget && (() => {
                      const widget = widgets.find(w => w.id === selectedWidget);
                      if (!widget) return null;
                      return <WidgetPreview widget={widget} />;
                    })()}
                  </div>
                ) : (
                  <div className={classes.jsonCodeBlock}>
                    {selectedScenario ? getScenarioJson() : JSON.stringify(widgets.find(w => w.id === selectedWidget)?.messages, null, 2)}
                  </div>
                )}
              </div>
            </DialogContent>
            <DialogActions>
              <Button appearance="secondary" onClick={() => setDialogOpen(false)}>Close</Button>
            </DialogActions>
          </DialogBody>
        </DialogSurface>
      </Dialog>
    </div>
  );
}

// ---- Wrapper Component with WidgetsProvider ----

export function Playground() {
  return (
    <WidgetsProvider>
      <PlaygroundInner />
    </WidgetsProvider>
  );
}
