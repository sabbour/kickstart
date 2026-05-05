#!/usr/bin/env node
/**
 * scripts/run-sims.ts
 * Goal: Deploy to AKS Automatic in < 5 minutes
 * Milestones: triage_routed -> context_loaded -> solution_shaped
 *             -> artifacts_generated -> repo_connected -> pr_created
 */
import * as fs   from 'node:fs';
import * as path from 'node:path';
import * as cp   from 'node:child_process';
import { parseArgs } from 'node:util';

const { values: args } = parseArgs({ options: { sims: { type: 'string' } }, strict: false });

const SIMS_DIR       = path.join(process.cwd(), 'sims');
const REPORTS_DIR    = path.join(process.cwd(), 'reports');
const PROBE_CMD      = 'npx tsx --tsconfig tsconfig.scripts.json scripts/probe.ts';
const GOAL_BUDGET_MS = 5 * 60 * 1000;

const DEFAULT_FOLLOW_UPS = [
  'Use AKS Automatic defaults, East US region, generate everything I need',
  'No compliance constraints. Please proceed.',
  'Yes, generate the manifests and Dockerfile',
  'Go ahead and create the deployment YAML',
  'Yes, provide the kubectl commands to deploy',
  'Please connect to my GitHub repo and open a pull request',
  'Yes, create the PR',
  'Confirm', 'Yes', 'OK',
];

// Types
type MilestoneId = 'triage_routed'|'context_loaded'|'solution_shaped'|'artifacts_generated'|'repo_connected'|'pr_created';
interface Milestone { id: MilestoneId; label: string; elapsed_ms: number; turn: number; evidence: string; }
interface TurnRecord { turn: number; elapsed_ms: number; userInput: string; agent: string; text: string; toolCalls: string[]; a2ui: unknown[]; actions: {index:number;event:string;optionId:string|null;label:string;agentInput:string}[]; milestones: Milestone[]; }
interface SimFixture { id: string; title: string; agent: string; opener: string; followUps: string[]; file: string; }
interface SimResult { fixture: SimFixture; turns: TurnRecord[]; milestones: Milestone[]; error?: string; duration_ms: number; goalMet: boolean; }

const MILESTONE_DEFS: {id: MilestoneId; label: string}[] = [
  {id:'triage_routed',       label:'Triage routed'},
  {id:'context_loaded',      label:'Context loaded'},
  {id:'solution_shaped',     label:'Solution shaped'},
  {id:'artifacts_generated', label:'Artifacts generated'},
  {id:'repo_connected',      label:'Repo connected'},
  {id:'pr_created',          label:'PR created'},
];

function detectMilestones(turn: number, elapsed_ms: number, agent: string, text: string, toolCalls: string[], a2ui: unknown[], prevAgent: string, achieved: Set<MilestoneId>): Milestone[] {
  const hit: Milestone[] = [];
  const tools = toolCalls.map(t => t.toLowerCase());
  const hasA2UI = (type: string) => JSON.stringify(a2ui).toLowerCase().includes(`"component":"${type.toLowerCase()}"`);
  const maybe = (id: MilestoneId, evidence: string) => {
    if (achieved.has(id)) return;
    achieved.add(id);
    hit.push({id, label: MILESTONE_DEFS.find(m=>m.id===id)!.label, elapsed_ms, turn, evidence});
  };

  // M1
  if (!achieved.has('triage_routed')) {
    const tf = tools.find(t => t.startsWith('transfer_to_') || t.includes('transfer'));
    if (tf) maybe('triage_routed', `tool: ${tf}`);
    else if (prevAgent==='core.triage' && agent!=='core.triage' && agent!=='?') maybe('triage_routed', `agent -> ${agent}`);
  }
  // M2
  if (!achieved.has('context_loaded')) {
    const rt = tools.find(t => t.includes('inspect_repo') || t.includes('inspect_repository'));
    if (rt) maybe('context_loaded', `tool: ${rt}`);
    else if (hasA2UI('SummaryCard') || hasA2UI('InspectCard')) maybe('context_loaded', 'a2ui: SummaryCard');
  }
  // M3
  if (!achieved.has('solution_shaped') && achieved.has('triage_routed')) {
    if (agent!=='core.triage' && (hasA2UI('PlanCard')||hasA2UI('SummaryCard')) && tools.some(t=>t.includes('show_card')||t.includes('emit_ui')))
      maybe('solution_shaped', `agent:${agent} + plan card`);
    else if (/\b(architecture|plan|solution|approach|here.{0,20}manifest|will deploy)\b/i.test(text))
      maybe('solution_shaped', 'text: plan signal');
  }
  // M4
  if (!achieved.has('artifacts_generated')) {
    if (/^apiVersion:\s/im.test(text) || /^kind:\s+(Deployment|Service|Ingress|StatefulSet)/im.test(text))
      maybe('artifacts_generated', 'code: Kubernetes manifest');
    else if (/```[^\n]*\n[\s\S]*?apiVersion:/i.test(text)) maybe('artifacts_generated', 'code block: K8s manifest');
    else if (/resource\s+\w+\s+'[^']+'/.test(text) || /\.bicep/i.test(text)) maybe('artifacts_generated', 'code: Bicep');
    else if (/^FROM\s+\S+/im.test(text) && /^(RUN|CMD|ENTRYPOINT|EXPOSE)\s/im.test(text)) maybe('artifacts_generated', 'code: Dockerfile');
  }
  // M5
  if (!achieved.has('repo_connected')) {
    const ct = tools.find(t => t.includes('github_connect')||t.includes('connect_repo')||t.includes('azure_github')||t.includes('git_push')||t.includes('push_branch'));
    if (ct) maybe('repo_connected', `tool: ${ct}`);
    else if (/github app (installed|connected|authorized)/i.test(text)) maybe('repo_connected', 'text: GitHub App');
    else if (/kubectl\s+(apply|create|rollout)\b/i.test(text)) maybe('repo_connected', 'cmd: kubectl apply');
    else if (/helm\s+(install|upgrade)\b/i.test(text)) maybe('repo_connected', 'cmd: helm install');
    else if (/az\s+deployment\s+(group|sub)\s+create\b/i.test(text)) maybe('repo_connected', 'cmd: az deployment');
    else if (/azd\s+up\b/i.test(text)) maybe('repo_connected', 'cmd: azd up');
  }
  // M6
  if (!achieved.has('pr_created')) {
    const pt = tools.find(t => t.includes('create_pr')||t.includes('create_pull')||t.includes('open_pr')||t.includes('github_pr'));
    if (pt) maybe('pr_created', `tool: ${pt}`);
    else if (/pull request.{0,60}(opened|created|raised|submitted)/i.test(text)) maybe('pr_created', 'text: PR opened');
    else if (/github\.com\/[^\s]+\/pull\/\d+/i.test(text)) maybe('pr_created', 'text: PR URL');
    else if (/\bPR #\d+\b/i.test(text)) maybe('pr_created', 'text: PR number');
    else if (/gh pr create\b/i.test(text)) maybe('pr_created', 'cmd: gh pr create');
  }
  return hit;
}

function parseFixture(filePath: string): SimFixture {
  const content = fs.readFileSync(filePath, 'utf8');
  const openerMatch = content.match(/## User Opener\s*\n+>\s*"([\s\S]+?)"/m);
  const opener = openerMatch ? openerMatch[1].replace(/\s*\n>\s*/g, ' ').trim() : '';
  const followSection = content.match(/## Follow-ups?\s*\n([\s\S]+?)(?=\n##|$)/);
  const followUps: string[] = followSection
    ? followSection[1].split('\n').map((l:string) => l.replace(/^\s*[-*]\s*/,'').replace(/^"(.*)"$/,'$1').trim()).filter(Boolean)
    : [...DEFAULT_FOLLOW_UPS];
  return {
    id:        content.match(/^sim:\s*(.+)$/m)?.[1]?.trim()    ?? path.basename(filePath, '.md'),
    title:     content.match(/^title:\s*"?(.+?)"?\s*$/m)?.[1]?.trim() ?? path.basename(filePath, '.md'),
    agent:     content.match(/^agent:\s*(.+)$/m)?.[1]?.trim()  ?? 'core.triage',
    opener, followUps, file: filePath,
  };
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms/1000).toFixed(1)}s`;
  return `${Math.floor(ms/60000)}m ${Math.round((ms%60000)/1000)}s`;
}
function esc(s: string): string {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
const AGENT_COLORS: Record<string,string> = {'core.triage':'#58a6ff','aks.architect':'#3fb950','aks.reviewer':'#d29922','azure.architect':'#a371f7','azure.reviewer':'#f78166'};
const agentColor = (a: string) => AGENT_COLORS[a] ?? '#8b949e';

async function runSim(fixture: SimFixture): Promise<SimResult> {
  const start = Date.now();
  const achieved = new Set<MilestoneId>();
  const allMilestones: Milestone[] = [];
  const turns: TurnRecord[] = [];
  let prevAgent = fixture.agent;
  let error: string|undefined;

  const inputs = [fixture.opener, ...Array.from({length:30},(_,i)=>fixture.followUps[i%fixture.followUps.length])];
  const [cmd,...cmdArgs] = PROBE_CMD.split(' ');
  const child = cp.spawn(cmd, cmdArgs, {env:{...process.env}, stdio:['pipe','pipe','pipe']});

  child.stderr.on('data', (chunk: Buffer) => process.stderr.write(chunk));
  child.on('error', (err: Error) => { error = err.message; });

  let inputIndex = 0;
  child.stdin.write(inputs[inputIndex++] + '\n');
  let stdoutBuf = '';

  await new Promise<void>((resolve) => {
    child.stdout.on('data', (chunk: Buffer) => {
      stdoutBuf += chunk.toString('utf8');
      const lines = stdoutBuf.split('\n');
      stdoutBuf = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        const elapsed_ms = Date.now() - start;
        let parsed: Record<string,unknown>;
        try { parsed = JSON.parse(line); } catch { parsed = {}; }
        const agent     = (parsed.agent     as string)               ?? '?';
        const text      = (parsed.text      as string)               ?? line;
        const toolCalls = ((parsed.toolCalls as string[]) ?? []).filter(Boolean);
        const a2ui      = (parsed.a2ui      as unknown[])            ?? [];
        const actions   = (parsed.actions   as TurnRecord['actions']) ?? [];
        const turnNum   = turns.length + 1;
        const newMS = detectMilestones(turnNum, elapsed_ms, agent, text, toolCalls, a2ui, prevAgent, achieved);
        allMilestones.push(...newMS);
        prevAgent = agent;
        turns.push({turn:turnNum, elapsed_ms, userInput:inputs[turnNum-1]??'', agent, text, toolCalls, a2ui, actions, milestones:newMS});

        const tools   = toolCalls.length ? ` [${toolCalls.join(', ')}]` : '';
        const preview = text.replace(/\n/g,' ').slice(0,80);
        process.stderr.write(`    T${String(turnNum).padEnd(2)} ${fmtMs(elapsed_ms).padStart(6)} | ${agent.padEnd(18)}|${tools}\n`);
        process.stderr.write(`           | "${preview}${text.length>80?'...':''}"\n`);
        newMS.forEach(m => process.stderr.write(`           | [M] ${m.label} [${m.evidence}]\n`));

        if (inputIndex < inputs.length && child.stdin.writable) child.stdin.write(inputs[inputIndex++]+'\n');
        else child.stdin.end();
      }
    });
    child.on('close', () => resolve());
  });

  if (child.exitCode !== 0 && !error) error = `probe exited ${child.exitCode}`;
  const goalMet = achieved.size >= 6 && (allMilestones.at(-1)?.elapsed_ms ?? Infinity) <= GOAL_BUDGET_MS;
  return {fixture, turns, milestones:allMilestones, error, duration_ms:Date.now()-start, goalMet};
}

const CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;background:#0d1117;color:#e6edf3;line-height:1.6}
a{color:#58a6ff;text-decoration:none}a:hover{text-decoration:underline}
code{font-family:'SF Mono',Consolas,monospace;font-size:12px;background:#161b22;border:1px solid #30363d;border-radius:4px;padding:1px 5px}
pre{background:#161b22;border:1px solid #30363d;border-radius:6px;padding:12px 16px;overflow-x:auto;font-size:12px;margin:8px 0;white-space:pre-wrap;word-break:break-all}
.ph{background:#161b22;border-bottom:1px solid #21262d;padding:16px 32px;display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.ph h1{font-size:18px;font-weight:600}.back{font-size:13px;color:#8b949e;display:block;margin-bottom:4px}
.gb{margin-left:auto;padding:4px 14px;border-radius:12px;font-size:13px;font-weight:600}
.gm{background:#1a3a2a;color:#3fb950;border:1px solid #2ea043}.gnm{background:#3a1a1a;color:#f85149;border:1px solid #da3633}
.mb{display:flex;flex-wrap:wrap;gap:16px;align-items:flex-start;padding:20px 32px;border-bottom:1px solid #21262d}
.mst{display:flex;flex-direction:column;align-items:center;gap:3px;min-width:110px;text-align:center}
.md{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:700}
.msd .md{background:#1a3a2a;color:#3fb950;border:2px solid #2ea043}.msp .md{background:#161b22;color:#6e7681;border:2px solid #30363d}
.ml{font-size:11px;font-weight:600}.mt{font-size:10px;color:#3fb950;font-family:monospace}.mev{font-size:9px;color:#6e7681;font-family:monospace;max-width:110px;word-break:break-all}
.bw{flex:1;min-width:200px;padding:0 8px;display:flex;flex-direction:column;gap:6px;justify-content:center}
.bl{font-size:11px;color:#8b949e;font-weight:600;text-transform:uppercase;letter-spacing:.05em}
.bt{height:8px;background:#21262d;border-radius:4px;position:relative;overflow:hidden}
.bf{height:100%;border-radius:4px}.bti{position:absolute;top:-2px;height:12px;width:2px;background:#6e7681;right:0}
.be{font-size:13px;font-weight:700;font-family:monospace}
.sm{padding:14px 32px;background:#161b22;border-bottom:1px solid #21262d}
.so{font-style:italic;color:#8b949e;font-size:14px;margin-top:4px}.ss{font-size:12px;color:#6e7681;margin-top:6px}
.eb{margin:16px 32px;padding:12px 16px;background:#3a1a1a;border:1px solid #da3633;border-radius:6px;color:#f85149;font-size:13px}
.turns{padding:24px 32px;display:flex;flex-direction:column;gap:20px;max-width:900px}
.turn{display:flex;flex-direction:column;gap:8px}
.tu{display:flex;flex-direction:column;align-items:flex-end;gap:2px}
.bu{background:#1c2128;border:1px solid #30363d;border-radius:12px 12px 4px 12px;padding:10px 14px;max-width:70%;font-size:14px;white-space:pre-wrap;word-break:break-word}
.tm{font-size:10px;color:#6e7681}
.ta{display:flex;flex-direction:column;gap:4px}
.al{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px}
.tr{font-size:12px;color:#8b949e;display:flex;flex-wrap:wrap;gap:4px}
.ba{background:#161b22;border:1px solid #21262d;border-left-width:3px;border-radius:4px 12px 12px 12px;padding:12px 16px;font-size:14px;white-space:pre-wrap;word-break:break-word;max-width:85%}
.ar{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
.ac{font-family:monospace;font-size:11px;background:#1a1a2e;border:1px solid #30363d;border-radius:10px;padding:2px 8px;color:#c084fc}
.msb{align-self:flex-start;background:#1a3a2a;border:1px solid #2ea043;border-radius:6px;padding:3px 10px;font-size:12px;color:#3fb950}
.msbe{color:#6e7681;font-family:monospace;font-size:10px;margin-left:6px}
.ig{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;padding:24px 32px}
.sc{background:#161b22;border:1px solid #21262d;border-radius:8px;padding:16px;display:flex;flex-direction:column;gap:10px}
.sc:hover{border-color:#58a6ff}.sct{font-size:15px;font-weight:600}.sci{font-size:11px;color:#6e7681;font-family:monospace}
.scm{display:flex;gap:4px;flex-wrap:wrap}.scm span{font-size:10px;padding:1px 6px;border-radius:8px}
.mh{background:#1a3a2a;color:#3fb950;border:1px solid #2ea043}.mm{background:#21262d;color:#6e7681;border:1px solid #30363d}
.sct2{font-size:12px;color:#8b949e}.ii{padding:16px 32px;color:#8b949e;font-size:14px;border-bottom:1px solid #21262d}
`;

function bar(milestones: Milestone[], totalMs: number): string {
  const ach = new Set(milestones.map(m=>m.id));
  const pct = Math.min(100,(totalMs/GOAL_BUDGET_MS)*100);
  const col = totalMs<=GOAL_BUDGET_MS?'#3fb950':'#f85149';
  const steps = MILESTONE_DEFS.map(def => {
    const hit = milestones.find(m=>m.id===def.id);
    const done = ach.has(def.id);
    return `<div class="mst ${done?'msd':'msp'}"><div class="md">${done?'&#10003;':''}</div><div class="ml">${esc(def.label)}</div>${hit?`<div class="mt">${fmtMs(hit.elapsed_ms)}</div><div class="mev">${esc(hit.evidence)}</div>`:''}</div>`;
  }).join('');
  return `<div class="mb">${steps}<div class="bw"><div class="bl">Time vs 5-min goal</div><div class="bt"><div class="bf" style="width:${pct.toFixed(1)}%;background:${col}"></div><div class="bti"></div></div><div class="be" style="color:${col}">${fmtMs(totalMs)} / 5:00</div></div></div>`;
}

function renderTurn(t: TurnRecord): string {
  const col = agentColor(t.agent);
  const msb = t.milestones.map(m=>`<div class="msb">&#127937; ${esc(m.label)}<span class="msbe">${esc(m.evidence)}</span></div>`).join('');
  const th  = t.toolCalls.length ? `<div class="tr">&#128295; ${t.toolCalls.map(tc=>`<code>${esc(tc)}</code>`).join(' ')}</div>` : '';
  const ah  = t.actions.length ? `<div class="ar">${t.actions.map(a=>`<span class="ac">${esc(a.event)}${a.optionId?':'+esc(a.optionId):''}</span>`).join('')}</div>` : '';
  const txh = t.text.includes('\n') ? `<pre>${esc(t.text)}</pre>` : esc(t.text);
  return `<div class="turn"><div class="tu"><div class="bu">${esc(t.userInput)}</div><div class="tm">T${t.turn} &mdash; ${fmtMs(t.elapsed_ms)}</div></div>${msb}<div class="ta"><div class="al" style="color:${col}">&#9679; ${esc(t.agent)}</div>${th}<div class="ba" style="border-left-color:${col}">${txh}</div>${ah}</div></div>`;
}

function simPage(r: SimResult): string {
  const ach = new Set(r.milestones.map(m=>m.id));
  const ts  = new Date().toISOString().replace('T',' ').slice(0,19)+' UTC';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(r.fixture.id)}: ${esc(r.fixture.title)}</title><style>${CSS}</style></head><body>
<div class="ph"><div><a class="back" href="index.html">&larr; All sims</a><h1>${esc(r.fixture.id)}: ${esc(r.fixture.title)}</h1></div><span style="color:#6e7681;font-size:12px">${ts}</span><div class="gb ${r.goalMet?'gm':'gnm'}">${r.goalMet?'&#9989; Goal met':'&#10060; Not met'}</div></div>
${bar(r.milestones, r.duration_ms)}
<div class="sm"><div class="so">&ldquo;${esc(r.fixture.opener)}&rdquo;</div><div class="ss">${r.turns.length} turns &middot; ${fmtMs(r.duration_ms)} &middot; ${ach.size}/6 milestones</div></div>
${r.error?`<div class="eb">&#9888; ${esc(r.error)}</div>`:''}
<div class="turns">${r.turns.map(renderTurn).join('\n')}</div></body></html>`;
}

function indexPage(results: SimResult[]): string {
  const ts = new Date().toISOString().replace('T',' ').slice(0,19)+' UTC';
  const cards = results.map(r => {
    const ach = new Set(r.milestones.map(m=>m.id));
    const badges = MILESTONE_DEFS.map(d=>`<span class="${ach.has(d.id)?'mh':'mm'}">${d.label}</span>`).join('');
    return `<a class="sc" href="${esc(r.fixture.id)}.html"><div class="sci">${esc(r.fixture.id)}</div><div class="sct">${esc(r.fixture.title)}</div><div class="scm">${badges}</div><div class="sct2">${ach.size}/6 &middot; ${fmtMs(r.duration_ms)} &middot; <strong style="color:${r.goalMet?'#3fb950':'#f85149'}">${r.goalMet?'&#9989; Met':'&#10060; Not met'}</strong></div></a>`;
  }).join('');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><title>Sim Report</title><style>${CSS}</style></head><body><div class="ph"><h1>&#127919; Deploy to AKS Automatic &mdash; Sim Report</h1><span style="color:#8b949e;font-size:13px">${ts} &middot; goal: 5 min</span></div><div class="ii">Each card links to the full conversation. Goal = all 6 milestones in &lt; 5 min.</div><div class="ig">${cards}</div></body></html>`;
}

async function main(): Promise<void> {
  const filterIds = args.sims?.split(',').map((s:string)=>s.trim()) ?? [];
  const fixtures = fs.readdirSync(SIMS_DIR).filter((f:string)=>f.endsWith('.md')).sort()
    .map((f:string)=>path.join(SIMS_DIR,f)).map(parseFixture)
    .filter((f:SimFixture)=>filterIds.length===0||filterIds.includes(f.id));

  if (!fixtures.length) { process.stderr.write('No fixtures found\n'); process.exit(1); }
  fs.mkdirSync(REPORTS_DIR, {recursive:true});

  process.stderr.write(`\n[Goal] Deploy to AKS Automatic in < 5 minutes\nRunning ${fixtures.length} sim(s)...\n\n`);
  const results: SimResult[] = [];

  for (const fixture of fixtures) {
    process.stderr.write(`  ${fixture.id}: ${fixture.title}\n  ${'─'.repeat(60)}\n`);
    const result = await runSim(fixture);
    results.push(result);
    process.stderr.write(`\n  ${result.goalMet?'[GOAL MET]':'[NOT MET]'} ${result.milestones.length}/6 milestones in ${fmtMs(result.duration_ms)}\n`);
    fs.writeFileSync(path.join(REPORTS_DIR, `${fixture.id}.html`), simPage(result), 'utf8');
    process.stderr.write(`  -> reports/${fixture.id}.html\n\n`);
    fs.writeFileSync(path.join(REPORTS_DIR,'index.html'), indexPage(results), 'utf8');
  }

  const idx = path.join(REPORTS_DIR,'index.html');
  process.stderr.write(`All done -> ${idx}\n`);
  console.log(idx);
}

main().catch((e:unknown)=>{process.stderr.write(`Fatal: ${e}\n`);process.exit(1);});
