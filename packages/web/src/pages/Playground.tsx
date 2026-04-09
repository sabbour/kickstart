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
import { Dismiss24Regular, Copy24Regular, Delete24Regular, DocumentCopy24Regular } from '@fluentui/react-icons';
import { useA2UI } from '../hooks/useA2UI';
import { WidgetsProvider, useWidgets } from '../hooks/useWidgets';
import { getDemoResponse, resetDemoState } from '../services/demo-scenarios';
import { A2UISurfaceWrapper } from '../components/A2UI/A2UISurfaceWrapper';
import type { A2uiMsg } from '../types';
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
  TOTAL_ICON_COUNT,
  type IconCategory,
  type IconEntry,
} from './playground-icons';

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
    paddingTop: tokens.spacingVerticalS,
    paddingBottom: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalL,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
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
  errorMessage: {
    marginTop: tokens.spacingVerticalXS,
  },
  emptyState: {
    textAlign: 'center' as const,
    paddingTop: '60px',
    paddingBottom: '60px',
    paddingLeft: tokens.spacingHorizontalXL,
    paddingRight: tokens.spacingHorizontalXL,
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
    marginTop: tokens.spacingVerticalXL,
    marginBottom: tokens.spacingVerticalM,
    paddingBottom: tokens.spacingVerticalS,
    borderBottom: `2px solid ${tokens.colorBrandBackground}`,
  },
});

// ---- GalleryCard Component ----
interface GalleryCardProps {
  scenario: ScenarioDef;
  onCardClick: (scenario: ScenarioDef, surfaces: Map<string, SurfaceModel<ReactComponentImplementation>>) => void;
}

const GalleryCard = memo(({ scenario, onCardClick }: GalleryCardProps) => {
  const classes = useStyles();
  const { surfaces, processMessages } = useA2UI();

  // Process scenario messages in useEffect so the onSurfaceCreated
  // subscription (set up in useA2UI's own useEffect) is active first.
  useEffect(() => {
    if (scenario.generate) {
      const msgs = scenario.generate();
      processMessages(msgs);
    } else if (scenario.keyword) {
      const keyword = scenario.keyword;
      if (keyword === '__welcome__') {
        resetDemoState();
        const resp = getDemoResponse('anything');
        processMessages(resp.a2uiMessages);
      } else {
        resetDemoState();
        getDemoResponse('skip'); // burn turn 1 (WELCOME)
        const resp = getDemoResponse(keyword);
        processMessages(resp.a2uiMessages);
      }
    }
    // processMessages is stable (useCallback with ref-based processor)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario]);

  const surfaceEntries = Array.from(surfaces.entries());

  return (
    <div className={classes.galleryCard} onClick={() => onCardClick(scenario, surfaces)}>
      <Caption1 className={classes.cardLabel}>{scenario.label}</Caption1>
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
  const { surfaces, processMessages } = useA2UI();

  useEffect(() => {
    processMessages(widget.messages);
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
          icon={<DocumentCopy24Regular />}
          onClick={() => onDuplicate(widget.id)}
        />
        <Button
          appearance="subtle"
          size="small"
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
  const { surfaces, processMessages } = useA2UI();

  useEffect(() => {
    processMessages(widget.messages);
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

// Icon sections for the Icons tab (Azure, UI, Fluent 2)
// Icon category sections for the Icons tab
const ICON_SECTIONS = [
  { label: 'Azure Services', categories: AZURE_ICON_CATEGORIES },
  { label: 'UI Icons', categories: UI_ICON_CATEGORIES },
  { label: 'Fluent 2', categories: [FLUENT_ICON_CATEGORY] },
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<ScenarioDef | null>(null);
  const [selectedSurfaces, setSelectedSurfaces] = useState<Map<string, SurfaceModel<ReactComponentImplementation>>>(new Map());
  const [selectedWidget, setSelectedWidget] = useState<string | null>(null);
  const [detailTab, setDetailTab] = useState<'preview' | 'json'>('preview');
  const customCounter = useRef(0);
  const customA2ui = useA2UI(); // For custom JSON editor
  const { widgets, addWidget, updateWidget, deleteWidget, duplicateWidget } = useWidgets();

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

  // Handle clear all
  const handleClearAll = useCallback(() => {
    customA2ui.reset();
    setJsonInput('');
    setJsonError('');
    resetDemoState();
  }, [customA2ui]);

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
          <Subtitle2>A2UI Playground</Subtitle2>
          <CounterBadge
            count={getCounter()}
            appearance="filled"
            color="brand"
            overflowCount={999}
          />
        </div>
        {(activeTab === 'gallery' || activeTab === 'components') && (
          <div className={classes.topbarCenter}>
            <SearchBox
              placeholder="Filter scenarios..."
              value={filterQuery}
              onChange={(_e, data) => setFilterQuery(data.value)}
              size="small"
            />
          </div>
        )}
        {activeTab === 'icons' && (
          <div className={classes.topbarCenter}>
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
        </div>
      </div>

      {/* ---- Tabs: Create | Gallery | Components | Icons | Widgets ---- */}
      <div className={classes.tabsContainer}>
        <TabList
          selectedValue={activeTab}
          onTabSelect={(_e, data) => setActiveTab(data.value as any)}
          size="medium"
        >
          <Tab value="create">Create</Tab>
          <Tab value="gallery">Gallery</Tab>
          <Tab value="components">Components</Tab>
          <Tab value="icons">Icons</Tab>
          <Tab value="widgets">Widgets</Tab>
        </TabList>
      </div>

      {/* ---- Tab 1: Create ---- */}
      {activeTab === 'create' && (
        <div className="playground-create-scroll">
          <div className={classes.jsonEditorContainer}>
            <Body1Strong style={{ marginBottom: tokens.spacingVerticalM }}>
              Custom A2UI JSON
            </Body1Strong>
            <Caption1 style={{ marginBottom: tokens.spacingVerticalM, color: tokens.colorNeutralForeground3 }}>
              Paste A2UI JSON messages below and click "Render JSON" to preview them. Save your work as a Widget for later access.
              <br /><em>AI-assisted creation coming soon (R18 render_ui tool).</em>
            </Caption1>
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
                { version: 'v0.9', updateComponents: { surfaceId: 'my-test', components: [
                  { id: 'root', component: 'Column', children: ['t1'] },
                  { id: 't1', component: 'Text', text: 'Hello!', variant: 'h2' },
                ] } },
              ], null, 2)}
              rows={12}
              resize="vertical"
              spellCheck={false}
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
        </div>
      )}

      {/* ---- Tab 2: Gallery (Scenarios) ---- */}
      {activeTab === 'gallery' && (
        <div className="playground-gallery-scroll">
          <div className="playground-gallery">
            {filteredGalleryScenarios.map(scenario => (
              <GalleryCard key={scenario.id} scenario={scenario} onCardClick={handleCardClick} />
            ))}
          </div>
        </div>
      )}

      {/* ---- Tab 3: Basic Components ---- */}
      {activeTab === 'components' && (
        <div className="playground-gallery-scroll">
          {COMPONENT_GROUPS.map(group => {
            const groupScenarios = filteredComponentScenarios.filter(s => s.group === group);
            if (groupScenarios.length === 0) return null;
            return (
              <div key={group}>
                <Subtitle2 className={classes.groupHeader}>{group}</Subtitle2>
                <div className="playground-gallery">
                  {groupScenarios.map(scenario => (
                    <GalleryCard key={scenario.id} scenario={scenario} onCardClick={handleCardClick} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ---- Tab 4: Icons ---- */}
      {activeTab === 'icons' && (
        <div className="playground-create-scroll">
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
              Click an icon to copy its path to clipboard. Use in A2UI Icon components.
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
                  {cat.icons.map(icon => (
                    <Card
                      key={icon.path}
                      appearance="outline"
                      className={classes.iconCard}
                      onClick={() => handleCopyIcon(icon)}
                      title={`${icon.name}\nClick to copy path`}
                    >
                      <img
                        src={icon.path}
                        alt={icon.name}
                        className={classes.iconSymbol}
                        loading="lazy"
                        style={{ width: 32, height: 32, objectFit: 'contain' }}
                      />
                      <Caption1 style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '100%',
                      }}>{icon.name}</Caption1>
                    </Card>
                  ))}
                </div>
              </div>
            ))}

            {filteredIconCategories.length === 0 && (
              <div className={classes.emptyState}>
                <div className={classes.emptyIcon}>🔍</div>
                <Body1Strong>No icons match "{iconFilter}"</Body1Strong>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- Tab 5: Widgets ---- */}
      {activeTab === 'widgets' && (
        <div className="playground-create-scroll">
          <div className={classes.jsonEditorContainer}>
            <Body1Strong style={{ marginBottom: tokens.spacingVerticalM }}>
              My Widgets
            </Body1Strong>
            {widgets.length === 0 ? (
              <div className={classes.emptyState}>
                <div className={classes.emptyIcon}>📦</div>
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
