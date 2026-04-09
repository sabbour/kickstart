/**
 * Playground — standalone A2UI test harness (split-pane layout).
 *
 * Access via ?playground URL parameter.
 * Left panel:  collapsible scenario explorer + JSON editor
 * Right panel: rendered surfaces + activity log
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  Button, CounterBadge,
  Card, CardHeader,
  Accordion, AccordionItem, AccordionHeader, AccordionPanel,
  Textarea, Text, Subtitle2, Caption1, Body1Strong,
  MessageBar, MessageBarBody,
  makeStyles, tokens,
} from '@fluentui/react-components';
import { useA2UI } from '../hooks/useA2UI';
import { getDemoResponse, resetDemoState } from '../services/demo-scenarios';
import { A2UISurfaceWrapper } from '../components/A2UI/A2UISurfaceWrapper';
import type { A2uiMsg } from '../types';
import {
  KICKSTART_SCENARIOS,
  CONTROL_SCENARIOS,
  SCENARIO_GROUPS,
  getGroupedScenarios,
  type ScenarioDef,
} from './playground-scenarios';

const ALL_SCENARIOS = [...KICKSTART_SCENARIOS, ...CONTROL_SCENARIOS];

const useStyles = makeStyles({
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
  topbarActions: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
    flexShrink: 0,
  },
  accordionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  sectionCount: {
    color: tokens.colorNeutralForeground3,
  },
  scenarioBtn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1px',
    paddingTop: tokens.spacingVerticalXS,
    paddingBottom: tokens.spacingVerticalXS,
    paddingLeft: tokens.spacingHorizontalL,
    paddingRight: tokens.spacingHorizontalS,
    border: 'none',
    borderRadius: tokens.borderRadiusSmall,
    backgroundColor: 'transparent',
    cursor: 'pointer',
    textAlign: 'left' as const,
    width: '100%',
    ':hover': {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
    ':active': {
      backgroundColor: tokens.colorBrandBackground2,
    },
  },
  scenarioLabel: {
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    color: tokens.colorNeutralForeground1,
    lineHeight: tokens.lineHeightBase300,
  },
  scenarioDesc: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
    lineHeight: tokens.lineHeightBase200,
  },
  sectionItems: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    paddingTop: tokens.spacingVerticalXXS,
    paddingBottom: tokens.spacingVerticalS,
  },
  jsonArea: {
    paddingTop: tokens.spacingVerticalXXS,
    paddingBottom: tokens.spacingVerticalS,
  },
  jsonTextarea: {
    width: '100%',
    fontFamily: tokens.fontFamilyMonospace,
  },
  jsonActions: {
    display: 'flex',
    gap: tokens.spacingHorizontalXS,
    marginTop: tokens.spacingVerticalXS,
  },
  surfaceBody: {
    padding: tokens.spacingHorizontalL,
  },
  surfaceIdText: {
    fontFamily: tokens.fontFamilyMonospace,
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
  logSection: {
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    padding: `${tokens.spacingVerticalM} ${tokens.spacingHorizontalXL}`,
    backgroundColor: tokens.colorNeutralBackground1,
    flexShrink: 0,
  },
  logItems: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: tokens.spacingHorizontalXXS,
    marginTop: tokens.spacingVerticalXS,
  },
  logItem: {
    paddingTop: '2px',
    paddingBottom: '2px',
    paddingLeft: tokens.spacingHorizontalS,
    paddingRight: tokens.spacingHorizontalS,
    borderRadius: tokens.borderRadiusSmall,
    backgroundColor: tokens.colorNeutralBackground3,
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
});

export function Playground() {
  const classes = useStyles();
  const a2ui = useA2UI();
  const [activityLog, setActivityLog] = useState<string[]>([]);
  const [jsonInput, setJsonInput] = useState('');
  const [jsonError, setJsonError] = useState('');
  const customCounter = useRef(0);

  // Accordion open state: scenario groups default open, "custom-json" starts closed
  const [openItems, setOpenItems] = useState<string[]>(() => [...SCENARIO_GROUPS]);

  // ---- Scenario injection ----

  const injectScenario = useCallback((scenario: ScenarioDef) => {
    if (scenario.generate) {
      const msgs = scenario.generate();
      a2ui.processMessages(msgs);
      setActivityLog(prev => [...prev, scenario.label]);
      return;
    }

    const keyword = scenario.keyword!;
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
    setActivityLog(prev => [...prev, scenario.label]);
  }, [a2ui]);

  const injectAll = useCallback(() => {
    a2ui.reset();
    setActivityLog([]);
    ALL_SCENARIOS.forEach((s, i) => {
      setTimeout(() => injectScenario(s), i * 80);
    });
  }, [a2ui, injectScenario]);

  const clearAll = useCallback(() => {
    a2ui.reset();
    setActivityLog([]);
    setJsonInput('');
    setJsonError('');
    resetDemoState();
  }, [a2ui]);

  // ---- JSON editor ----

  const handleJsonRender = useCallback(() => {
    setJsonError('');
    try {
      const parsed = JSON.parse(jsonInput);
      const msgs: A2uiMsg[] = Array.isArray(parsed) ? parsed : [parsed];
      for (const m of msgs) {
        if (!m.version) throw new Error('Each message must have a "version" field');
      }
      a2ui.processMessages(msgs);
      customCounter.current++;
      setActivityLog(prev => [...prev, `Custom #${customCounter.current}`]);
    } catch (err: any) {
      setJsonError(err.message || 'Invalid JSON');
    }
  }, [jsonInput, a2ui]);

  // ---- Data ----

  const surfaceEntries = Array.from(a2ui.surfaces.entries());
  const grouped = getGroupedScenarios();

  return (
    <div className="playground-page">
      {/* ---- Top bar ---- */}
      <div className={classes.topbar}>
        <div className={classes.topbarLeft}>
          <Subtitle2>A2UI Playground</Subtitle2>
          <CounterBadge
            count={surfaceEntries.length}
            appearance="filled"
            color="brand"
            overflowCount={999}
          />
        </div>
        <div className={classes.topbarActions}>
          <Button appearance="primary" size="small" onClick={injectAll}>Load All</Button>
          <Button appearance="outline" size="small" onClick={clearAll}>Clear All</Button>
        </div>
      </div>

      {/* ---- Split pane ---- */}
      <div className="playground-split">
        {/* ---- LEFT: scenario explorer ---- */}
        <div className="playground-left">
          <div className="playground-left-scroll">
            <Accordion
              multiple
              openItems={openItems}
              onToggle={(_e, data) => setOpenItems(data.openItems as string[])}
            >
              {SCENARIO_GROUPS.map(group => {
                const scenarios = grouped.get(group) || [];
                return (
                  <AccordionItem key={group} value={group}>
                    <AccordionHeader size="small">
                      <div className={classes.accordionHeader}>
                        <Caption1 weight="semibold" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {group}
                        </Caption1>
                        <Caption1 className={classes.sectionCount}>{scenarios.length}</Caption1>
                      </div>
                    </AccordionHeader>
                    <AccordionPanel>
                      <div className={classes.sectionItems}>
                        {scenarios.map(s => (
                          <button
                            key={s.id}
                            className={classes.scenarioBtn}
                            onClick={() => injectScenario(s)}
                            title={s.description}
                          >
                            <span className={classes.scenarioLabel}>{s.label}</span>
                            <span className={classes.scenarioDesc}>{s.description}</span>
                          </button>
                        ))}
                      </div>
                    </AccordionPanel>
                  </AccordionItem>
                );
              })}

              {/* JSON editor */}
              <AccordionItem value="custom-json">
                <AccordionHeader size="small">
                  <Caption1 weight="semibold" style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Custom JSON
                  </Caption1>
                </AccordionHeader>
                <AccordionPanel>
                  <div className={classes.jsonArea}>
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
                      rows={8}
                      resize="vertical"
                      spellCheck={false}
                    />
                    {jsonError && (
                      <MessageBar intent="error" style={{ marginTop: tokens.spacingVerticalXS }}>
                        <MessageBarBody>{jsonError}</MessageBarBody>
                      </MessageBar>
                    )}
                    <div className={classes.jsonActions}>
                      <Button
                        appearance="primary"
                        size="small"
                        onClick={handleJsonRender}
                        disabled={!jsonInput.trim()}
                      >
                        Render JSON
                      </Button>
                    </div>
                  </div>
                </AccordionPanel>
              </AccordionItem>
            </Accordion>
          </div>
        </div>

        {/* ---- RIGHT: rendered output ---- */}
        <div className="playground-right">
          <div className="playground-right-scroll">
            {surfaceEntries.length === 0 ? (
              <div className={classes.emptyState}>
                <div className={classes.emptyIcon}>⬡</div>
                <Text>No surfaces yet. Click a scenario or paste JSON to get started.</Text>
              </div>
            ) : (
              <div className="playground-surfaces">
                {surfaceEntries.map(([id, surface]) => (
                  <Card key={id} appearance="outline">
                    <CardHeader
                      header={
                        <Caption1 className={classes.surfaceIdText}>{id}</Caption1>
                      }
                      description={
                        <Caption1>{id.replace(/-\d+$/, '')}</Caption1>
                      }
                    />
                    <div className={classes.surfaceBody}>
                      <div className="a2ui-component">
                        <A2UISurfaceWrapper surface={surface} />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>

          {/* Activity log */}
          {activityLog.length > 0 && (
            <div className={classes.logSection}>
              <Body1Strong style={{ textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: tokens.fontSizeBase200 }}>
                Activity Log
              </Body1Strong>
              <div className={classes.logItems}>
                {activityLog.map((s, i) => (
                  <span key={i} className={classes.logItem}>✓ {s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
