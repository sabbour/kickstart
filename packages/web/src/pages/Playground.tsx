/**
 * Playground — A2UI Gallery (masonry card layout).
 *
 * Access via ?playground URL parameter.
 * Gallery view: All scenarios rendered as masonry cards
 * Create view: Custom JSON editor
 */

import React, { useState, useCallback, useRef, useMemo, memo } from 'react';
import {
  Button, CounterBadge, SearchBox,
  Card, CardHeader,
  Textarea, Text, Subtitle2, Caption1, Body1Strong,
  MessageBar, MessageBarBody,
  TabList, Tab,
  Dialog, DialogTrigger, DialogSurface, DialogBody, DialogTitle, DialogContent, DialogActions,
  makeStyles, tokens,
} from '@fluentui/react-components';
import { Dismiss24Regular } from '@fluentui/react-icons';
import { useA2UI } from '../hooks/useA2UI';
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

const ALL_SCENARIOS = [...KICKSTART_SCENARIOS, ...CONTROL_SCENARIOS];

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
    backgroundColor: `rgba(${tokens.colorNeutralBackground1}, 0.8)`,
    borderRadius: tokens.borderRadiusXLarge,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    cursor: 'pointer',
    transition: 'box-shadow 0.2s ease, transform 0.1s ease',
    breakInside: 'avoid' as const,
    marginBottom: tokens.spacingVerticalM,
    ':hover': {
      boxShadow: tokens.shadow8,
      transform: 'translateY(-2px)',
    },
  },
  cardLabel: {
    paddingTop: tokens.spacingVerticalS,
    paddingLeft: tokens.spacingHorizontalM,
    paddingRight: tokens.spacingHorizontalM,
    color: tokens.colorNeutralForeground3,
    fontSize: tokens.fontSizeBase200,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.04em',
  },
  cardBody: {
    padding: tokens.spacingHorizontalM,
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
});

// ---- GalleryCard Component ----
interface GalleryCardProps {
  scenario: ScenarioDef;
  onCardClick: (scenario: ScenarioDef, surfaces: Map<string, SurfaceModel<ReactComponentImplementation>>) => void;
}

const GalleryCard = memo(({ scenario, onCardClick }: GalleryCardProps) => {
  const classes = useStyles();
  const a2ui = useA2UI();

  // Generate scenario surfaces on mount
  useMemo(() => {
    if (scenario.generate) {
      const msgs = scenario.generate();
      a2ui.processMessages(msgs);
    } else if (scenario.keyword) {
      const keyword = scenario.keyword;
      if (keyword === '__welcome__') {
        resetDemoState();
        const resp = getDemoResponse('anything');
        a2ui.processMessages(resp.a2uiMessages);
      } else {
        resetDemoState();
        getDemoResponse('skip'); // burn turn 1 (WELCOME)
        const resp = getDemoResponse(keyword);
        a2ui.processMessages(resp.a2uiMessages);
      }
    }
  }, [scenario, a2ui]);

  const surfaceEntries = Array.from(a2ui.surfaces.entries());

  return (
    <div className={classes.galleryCard} onClick={() => onCardClick(scenario, a2ui.surfaces)}>
      <Caption1 className={classes.cardLabel}>{scenario.label}</Caption1>
      <div className={classes.cardBody}>
        {surfaceEntries.map(([id, surface]) => (
          <div key={id} className="a2ui-component">
            <A2UISurfaceWrapper surface={surface} />
          </div>
        ))}
      </div>
    </div>
  );
});

GalleryCard.displayName = 'GalleryCard';

// ---- Main Playground Component ----

export function Playground() {
  const classes = useStyles();
  const [activeView, setActiveView] = useState<'gallery' | 'create'>('gallery');
  const [filterQuery, setFilterQuery] = useState('');
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<ScenarioDef | null>(null);
  const [selectedSurfaces, setSelectedSurfaces] = useState<Map<string, SurfaceModel<ReactComponentImplementation>>>(new Map());
  const [detailTab, setDetailTab] = useState<'preview' | 'json'>('preview');
  const customCounter = useRef(0);
  const customA2ui = useA2UI(); // For custom JSON editor

  // Filter scenarios
  const filteredScenarios = useMemo(() => {
    if (!filterQuery.trim()) return ALL_SCENARIOS;
    const query = filterQuery.toLowerCase();
    return ALL_SCENARIOS.filter(s => 
      s.label.toLowerCase().includes(query) || 
      s.description.toLowerCase().includes(query)
    );
  }, [filterQuery]);

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

  // Handle clear all
  const handleClearAll = useCallback(() => {
    customA2ui.reset();
    setJsonInput('');
    setJsonError('');
    resetDemoState();
  }, [customA2ui]);

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

  return (
    <div className={`playground-page ${classes.playgroundPage}`}>
      {/* ---- Top bar ---- */}
      <div className={classes.topbar}>
        <div className={classes.topbarLeft}>
          <Subtitle2>A2UI Gallery</Subtitle2>
          <CounterBadge
            count={activeView === 'gallery' ? filteredScenarios.length : customSurfaceEntries.length}
            appearance="filled"
            color="brand"
            overflowCount={999}
          />
        </div>
        {activeView === 'gallery' && (
          <div className={classes.topbarCenter}>
            <SearchBox
              placeholder="Filter scenarios..."
              value={filterQuery}
              onChange={(_e, data) => setFilterQuery(data.value)}
              size="small"
            />
          </div>
        )}
        <div className={classes.topbarActions}>
          {activeView === 'create' && (
            <Button appearance="outline" size="small" onClick={handleClearAll}>Clear All</Button>
          )}
        </div>
      </div>

      {/* ---- Tabs: Gallery / Create ---- */}
      <div className={classes.tabsContainer}>
        <TabList
          selectedValue={activeView}
          onTabSelect={(_e, data) => setActiveView(data.value as 'gallery' | 'create')}
          size="medium"
        >
          <Tab value="gallery">Gallery</Tab>
          <Tab value="create">Create</Tab>
        </TabList>
      </div>

      {/* ---- Gallery View ---- */}
      {activeView === 'gallery' && (
        <div className="playground-gallery-scroll">
          <div className="playground-gallery">
            {filteredScenarios.map(scenario => (
              <GalleryCard key={scenario.id} scenario={scenario} onCardClick={handleCardClick} />
            ))}
          </div>
        </div>
      )}

      {/* ---- Create View (Custom JSON Editor) ---- */}
      {activeView === 'create' && (
        <div className="playground-create-scroll">
          <div className={classes.jsonEditorContainer}>
            <Body1Strong style={{ marginBottom: tokens.spacingVerticalM }}>
              Custom A2UI JSON
            </Body1Strong>
            <Caption1 style={{ marginBottom: tokens.spacingVerticalM, color: tokens.colorNeutralForeground3 }}>
              Paste A2UI JSON messages below and click "Render JSON" to preview them.
            </Caption1>
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
              {selectedScenario?.label}
            </DialogTitle>
            <DialogContent>
              <div className={classes.dialogContent}>
                <Caption1 style={{ color: tokens.colorNeutralForeground3 }}>
                  {selectedScenario?.description}
                </Caption1>

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
                    {Array.from(selectedSurfaces.entries()).map(([id, surface]) => (
                      <div key={id} style={{ marginBottom: tokens.spacingVerticalM }}>
                        <div className="a2ui-component">
                          <A2UISurfaceWrapper surface={surface} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className={classes.jsonCodeBlock}>
                    {getScenarioJson()}
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
