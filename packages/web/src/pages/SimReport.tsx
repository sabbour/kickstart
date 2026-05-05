/**
 * SimReport — renders probe sim run data as an interactive chat report.
 * Access via ?report URL parameter (same pattern as ?playground).
 *
 * Data source: /sim-report-data.json written by `npm run run-sims`
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  FluentProvider, webDarkTheme,
  Badge, Caption1, Subtitle2,
  Spinner, MessageBar, MessageBarBody,
  makeStyles, tokens,
} from '@fluentui/react-components';
import {
  BotSparkle24Regular,
  ArrowRight24Regular, Wrench24Regular,
  Warning24Regular,
} from '@fluentui/react-icons';
import { A2uiSurface } from '../vendor/a2ui/react';
import type { ReactComponentImplementation } from '../vendor/a2ui/react/adapter';
import { MessageProcessor } from '../vendor/a2ui/web_core/index';
import { buildReportCatalog } from '../bootstrap/buildReportCatalog';
import { KICKSTART_CATALOG_ID } from '../contexts/A2UIRegistryContext';

// ── Types (mirroring probe JSON output) ─────────────────────────────────────

interface ProbeAction {
  index: number;
  event: string;
  optionId: string | null;
  label: string;
  agentInput: string;
}

interface ProbeTurn {
  turn: number;
  userInput: string;
  agent: string;
  text: string;
  toolCalls: string[];
  a2ui: unknown[];
  actions: ProbeAction[];
}

interface SimData {
  generatedAt: string;
  sims: Array<{
    id: string;
    title: string;
    opener: string;
    duration_ms: number;
    error?: string;
    turns: ProbeTurn[];
  }>;
}

// ── Styles ───────────────────────────────────────────────────────────────────

const useStyles = makeStyles({
  root: {
    display: 'flex',
    height: '100vh',
    background: tokens.colorNeutralBackground3,
    fontFamily: tokens.fontFamilyBase,
  },
  sidebar: {
    width: '220px',
    flexShrink: 0,
    background: tokens.colorNeutralBackground1,
    borderRight: `1px solid ${tokens.colorNeutralStroke2}`,
    display: 'flex',
    flexDirection: 'column',
    padding: '16px 0',
    overflowY: 'auto',
  },
  sidebarTitle: {
    padding: '0 16px 12px',
    color: tokens.colorNeutralForeground3,
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
  },
  simTab: {
    display: 'flex',
    flexDirection: 'column',
    padding: '10px 16px',
    cursor: 'pointer',
    borderLeft: '3px solid transparent',
    transition: 'background 0.1s',
    '&:hover': { background: tokens.colorNeutralBackground1Hover },
  },
  simTabActive: {
    background: tokens.colorNeutralBackground2,
    borderLeftColor: tokens.colorBrandForeground1,
  },
  simTabId: {
    fontSize: '12px',
    fontWeight: '600',
    color: tokens.colorNeutralForeground1,
    fontFamily: tokens.fontFamilyMonospace,
  },
  simTabTitle: {
    fontSize: '11px',
    color: tokens.colorNeutralForeground3,
    marginTop: '2px',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  simHeader: {
    padding: '16px 24px',
    background: tokens.colorNeutralBackground1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
  },
  simOpener: {
    color: tokens.colorNeutralForeground3,
    fontStyle: 'italic',
    fontSize: '13px',
    marginTop: '4px',
  },
  simMeta: {
    color: tokens.colorNeutralForeground4,
    fontSize: '11px',
    marginTop: '4px',
  },
  chat: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  // ── Messages ──
  messageRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  messageUser: { alignSelf: 'flex-end', alignItems: 'flex-end', maxWidth: '70%' },
  messageAgent: { alignSelf: 'flex-start', alignItems: 'flex-start', maxWidth: '80%' },
  agentLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '11px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '4px',
    paddingLeft: '4px',
  },
  bubbleUser: {
    background: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: '12px 12px 4px 12px',
    padding: '10px 14px',
    fontSize: '14px',
    color: tokens.colorNeutralForeground1,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  bubbleAgent: {
    background: tokens.colorNeutralBackground2,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '4px 12px 12px 12px',
    padding: '12px 16px',
    fontSize: '14px',
    color: tokens.colorNeutralForeground1,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    minWidth: '280px',
  },
  turnNum: {
    fontSize: '10px',
    color: tokens.colorNeutralForeground4,
    marginBottom: '2px',
  },
  // ── Tool calls ──
  toolRow: {
    alignSelf: 'center',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
    padding: '6px 10px',
    background: tokens.colorNeutralBackground1,
    border: `1px solid ${tokens.colorNeutralStroke2}`,
    borderRadius: '8px',
    cursor: 'pointer',
    maxWidth: '80%',
  },
  toolChip: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: '11px',
    background: tokens.colorNeutralBackground3,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: '10px',
    padding: '2px 8px',
    color: tokens.colorBrandForeground2,
  },
  // ── Handoff banner ──
  handoffBanner: {
    alignSelf: 'center',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 16px',
    border: `1px dashed ${tokens.colorNeutralStroke1}`,
    borderRadius: '8px',
    fontSize: '12px',
    color: tokens.colorNeutralForeground3,
  },
  // ── D1 warning ──
  d1Warning: {
    background: tokens.colorStatusDangerBackground1,
    border: `1px solid ${tokens.colorStatusDangerBorder1}`,
    borderRadius: '6px',
    padding: '6px 10px',
    fontSize: '12px',
    color: tokens.colorStatusDangerForeground1,
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  // ── Actions ──
  actionsRow: {
    marginTop: '10px',
    paddingTop: '8px',
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    alignItems: 'center',
  },
  actionChip: {
    fontFamily: tokens.fontFamilyMonospace,
    fontSize: '11px',
    background: tokens.colorNeutralBackground3,
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: '10px',
    padding: '2px 8px',
    color: tokens.colorPaletteLavenderForeground2,
  },
  agentText: {
    marginBottom: '6px',
    color: tokens.colorNeutralForeground1,
  },
});

// ── SSR-safe A2UI surface renderer ───────────────────────────────────────────
// Uses useMemo (runs synchronously during render) instead of useEffect so it
// works with renderToString/renderToStaticMarkup in addition to the browser.

function SimReportSurface({ components, surfaceId }: {
  components: Record<string, unknown>[];
  surfaceId: string;
}) {
  const catalog = useMemo(buildReportCatalog, []);
  const processor = useMemo(
    () => new MessageProcessor<ReactComponentImplementation>([catalog], () => undefined),
    [catalog],
  );
  // useMemo is synchronous — runs during render in both browser and SSR contexts.
  useMemo(() => {
    processor.processMessages([
      { version: 'v0.9', createSurface: { surfaceId, catalogId: KICKSTART_CATALOG_ID } },
      { version: 'v0.9', updateComponents: { surfaceId, components } },
    ] as Parameters<typeof processor.processMessages>[0]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processor, surfaceId, JSON.stringify(components)]);

  const surface = processor.model.getSurface(surfaceId);
  if (!surface) return null;
  return <A2uiSurface surface={surface} />;
}



const AGENT_META: Record<string, { color: string; label: string }> = {
  'core.triage':   { color: '#f59e0b', label: 'Triage' },
  'aks.architect': { color: '#10b981', label: 'Architect' },
  'aks.reviewer':  { color: '#3b82f6', label: 'Reviewer' },
  'aks.codesmith': { color: '#8b5cf6', label: 'Codesmith' },
};

function agentColor(agent: string) {
  return AGENT_META[agent]?.color ?? '#6b7280';
}

// ── Surface state tracker ─────────────────────────────────────────────────────

function extractComponents(a2uiMessages: unknown[]): Record<string, unknown>[] | null {
  // Find the last updateComponents targeting shared:triage-main (or any surface)
  let last: Record<string, unknown>[] | null = null;
  for (const msg of (a2uiMessages as Record<string, unknown>[])) {
    if (msg.updateComponents) {
      const uc = msg.updateComponents as { components: Record<string, unknown>[] };
      last = uc.components;
    }
  }
  return last;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ToolCallsRow({ tools, turnNum }: { tools: string[]; turnNum: number }) {
  const styles = useStyles();
  const [expanded, setExpanded] = useState(false);

  if (tools.length === 0) return null;
  return (
    <div style={{ alignSelf: 'center', maxWidth: '80%' }}>
      <div
        className={styles.toolRow}
        onClick={() => setExpanded(e => !e)}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && setExpanded(v => !v)}
      >
        <Wrench24Regular style={{ fontSize: '14px', color: '#64748b', flexShrink: 0 }} />
        <Caption1 style={{ color: '#64748b', flexShrink: 0 }}>
          {tools.length} tool{tools.length > 1 ? 's' : ''} called
        </Caption1>
        {expanded && tools.map(t => (
          <span key={t} className={styles.toolChip}>{t}</span>
        ))}
      </div>
    </div>
  );
}

function HandoffBanner({ from, to }: { from: string; to: string }) {
  const styles = useStyles();
  return (
    <div className={styles.handoffBanner}>
      <ArrowRight24Regular style={{ fontSize: '14px', color: agentColor(to) }} />
      <span>Handed off to <strong style={{ color: agentColor(to) }}>{to}</strong></span>
    </div>
  );
}

function TurnView({ turn, prevAgent, simId }: {
  turn: ProbeTurn;
  prevAgent: string | null;
  simId: string;
}) {
  const styles = useStyles();
  const color = agentColor(turn.agent);
  const components = extractComponents(turn.a2ui);
  const hasD1 = turn.text.includes('Container Apps');
  const surfaceId = `report-${simId}-turn-${turn.turn}`;

  return (
    <>
      {/* Handoff banner */}
      {prevAgent && prevAgent !== turn.agent && (
        <HandoffBanner from={prevAgent} to={turn.agent} />
      )}

      {/* User bubble */}
      <div className={`${styles.messageRow} ${styles.messageUser}`}>
        <Caption1 className={styles.turnNum}>Turn {turn.turn}</Caption1>
        <div className={styles.bubbleUser}>{turn.userInput}</div>
      </div>

      {/* Tool calls */}
      <ToolCallsRow tools={turn.toolCalls} turnNum={turn.turn} />

      {/* Agent bubble */}
      <div className={`${styles.messageRow} ${styles.messageAgent}`}>
        <div className={styles.agentLabel} style={{ color }}>
          <BotSparkle24Regular style={{ fontSize: '14px' }} />
          {turn.agent}
        </div>
        <div className={styles.bubbleAgent} style={{ borderLeftColor: color, borderLeftWidth: '3px' }}>
          {hasD1 && (
            <div className={styles.d1Warning}>
              <Warning24Regular style={{ fontSize: '14px' }} />
              D1 violation — Container Apps mentioned
            </div>
          )}
          {turn.text && <div className={styles.agentText}>{turn.text}</div>}

          {/* A2UI Surface — SSR-safe via useMemo-based processor */}
          {components && components.length > 0 && (
            <SimReportSurface components={components} surfaceId={surfaceId} />
          )}

          {/* Available actions */}
          {turn.actions.length > 0 && (
            <div className={styles.actionsRow}>
              <Caption1 style={{ color: '#64748b' }}>Actions:</Caption1>
              {turn.actions.map(a => (
                <span key={a.index} className={styles.actionChip}>
                  {a.event}{a.optionId ? `:${a.optionId}` : ''}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Main report component ────────────────────────────────────────────────────

export function SimReport({ initialData }: { initialData?: SimData } = {}) {
  const styles = useStyles();
  const [data, setData] = useState<SimData | null>(initialData ?? null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);

  useEffect(() => {
    if (initialData) return; // data already provided (SSR / test)
    fetch('/sim-report-data.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status} — run "npm run run-sims" first`);
        return r.json() as Promise<SimData>;
      })
      .then(setData)
      .catch(e => setLoadError(String(e.message ?? e)));
  }, []);

  if (loadError) return (
    <FluentProvider theme={webDarkTheme} style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <MessageBar intent="error">
        <MessageBarBody>
          {loadError}
        </MessageBarBody>
      </MessageBar>
    </FluentProvider>
  );

  if (!data) return (
    <FluentProvider theme={webDarkTheme} style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Spinner label="Loading sim report…" />
    </FluentProvider>
  );

  const sim = data.sims[selectedIdx];

  return (
    <FluentProvider theme={webDarkTheme} style={{ height: '100vh' }}>
      <div className={styles.root}>
        {/* Sidebar */}
        <nav className={styles.sidebar}>
          <div className={styles.sidebarTitle}>Sim Runs</div>
          {data.sims.map((s, i) => {
            const finalAgent = s.turns.at(-1)?.agent ?? '?';
            const routed = finalAgent !== 'core.triage';
            return (
              <div
                key={s.id}
                className={`${styles.simTab} ${i === selectedIdx ? styles.simTabActive : ''}`}
                onClick={() => setSelectedIdx(i)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setSelectedIdx(i)}
              >
                <span className={styles.simTabId}>{s.id}</span>
                <span className={styles.simTabTitle}>{s.title}</span>
                <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                  <Badge size="small" color={routed ? 'success' : 'warning'} appearance="tint">
                    {routed ? finalAgent : 'stuck'}
                  </Badge>
                  {s.turns.some(t => t.text.includes('Container Apps')) && (
                    <Badge size="small" color="danger" appearance="tint">D1</Badge>
                  )}
                </div>
              </div>
            );
          })}
          <div style={{ marginTop: 'auto', padding: '12px 16px', borderTop: `1px solid ${tokens.colorNeutralStroke2}` }}>
            <Caption1 style={{ color: tokens.colorNeutralForeground4 }}>
              {data.generatedAt}
            </Caption1>
          </div>
        </nav>

        {/* Main */}
        <div className={styles.main}>
          <div className={styles.simHeader}>
            <Subtitle2>{sim.id} — {sim.title}</Subtitle2>
            <div className={styles.simOpener}>"{sim.opener}"</div>
            <div className={styles.simMeta}>
              {sim.turns.length} turns · {(sim.duration_ms / 1000).toFixed(1)}s
              {sim.error && <span style={{ color: tokens.colorStatusDangerForeground1 }}> · probe error</span>}
            </div>
          </div>

          <div className={styles.chat}>
            {sim.turns.map((turn, i) => (
              <TurnView
                key={turn.turn}
                turn={turn}
                prevAgent={i > 0 ? sim.turns[i - 1]!.agent : null}
                simId={sim.id}
              />
            ))}
          </div>
        </div>
      </div>
    </FluentProvider>
  );
}
