---
sidebar_position: 5
---

# AI Persona Sim Harness

The persona sim harness is an end-to-end regression testing tool that generates synthetic user personas via LLM, drives full multi-turn conversations through the Kickstart agent stack, and reports milestone progress with HTML reports.

It replaces hand-scripted sim scenarios with LLM-generated diversity — catching regressions and dead-ends before they reach real users.

---

## Why it exists

Manual sim scripts are brittle: they test known paths but miss the long-tail of how real users actually phrase things. The persona sim harness generates a fresh set of synthetic users for each run — each with a distinct background, goal, and communication style — and drives them through the full agent conversation to see whether Kickstart reaches the key milestones within the 10-minute goal.

---

## How to run

```bash
# Run 3 LLM-generated personas (default)
npm run persona-sims

# Run N generated personas
npm run persona-sims -- --count 5

# Limit turns per persona (default 20)
npm run persona-sims -- --count 3 --turns 15

# Run specific named personas (legacy)
npm run persona-sims -- --personas sam-nextjs,mike-manifests
```

Output goes to the `reports/` directory as HTML files — one per persona run plus a summary index.

---

## What it produces

| Output | Description |
|---|---|
| **Bootstrap summary** | Printed at startup: which harness (LOCAL vs hosted), LLM provider endpoint, ARM token status, and packs loaded |
| **Live terminal** | Streaming token-by-token output as the agent responds; tool calls appear inline as `⚙️ toolname…` |
| **Session correlation** | `🔗 session=<id>` printed when probe connects; repeated at end of each persona run with an Azure Monitor deep-link |
| **Milestone tracker** | Real-time `✓ / ✗` table showing which milestones were hit and when |
| **Per-turn NOT MET table** | Shown after each turn where the goal isn't yet reached — lists missing milestones |
| **HTML reports** | Per-persona conversation replays with milestone annotations and a collapsible **Server Traces** section, saved to `reports/` |
| **Log Analytics traces** | After all runs complete, traces are fetched from the `managed-kickstart-ai-ws` workspace and embedded in the HTML report |

---

## Milestones

Every persona run is evaluated against six milestones. Reaching all six within 10 minutes is the goal.

| Milestone | Meaning |
|---|---|
| `triage_routed` | Triage agent recognised the intent and routed to a specialist agent |
| `context_loaded` | The specialist agent loaded repository/context (inspect_repo called or SummaryCard emitted) |
| `solution_shaped` | A plan or recipe was presented to the user |
| `artifacts_generated` | Manifests, configs, or other deployment artifacts were produced |
| `repo_connected` | The agent connected to a GitHub repository |
| `pr_created` | A pull request was created |

Evidence for each milestone is captured (e.g., which tool call or A2UI card triggered it) and surfaced in the HTML report.

---

## Architecture

```
persona-sim.ts (parent)
   │
   ├── calls OpenAI to generate N persona definitions
   │
   └── for each persona:
        ├── spawns  probe.ts  as a child process
        │     • probe.ts boots a real harness Session + Runner
        │     • reads user messages from stdin line-by-line
        │     • writes one JSON record per turn to stdout
        │     • streams chunk / tool / log events to stdout
        │
        ├── sends persona's opener message to probe stdin
        ├── reads turn JSON, detects milestones, displays progress
        ├── drives follow-up turns via persona LLM
        └── generates HTML report on completion
```

### Bootstrap diagnostics

When `probe` or `persona-sim` starts, it prints a one-time summary line before any turns begin:

```
[harness] LOCAL  endpoint=https://my-aoai.openai.azure.com  arm_token=✓  packs=pack-core,pack-azure,pack-aks-automatic
```

This tells you at a glance which harness variant is active (LOCAL means the subprocess harness, not a hosted API), which LLM endpoint will be used, whether an ARM access token is present, and which packs are registered.

### Streaming protocol

Each line written by `probe.ts` is a JSON record with a `type` field:

| Type | Description |
|---|---|
| `session` | **First line emitted** — the runner `sessionId`, used for correlation (`{ stream: "session", id }`) |
| `turn` | Full turn record: `{ turn, agent, text, tools, a2ui, elapsed_ms }` |
| `chunk` | Streaming text delta from the model |
| `tool` | Tool call record: `{ name, args }` |
| `log` | Internal runner log line (captured for diagnostics) |

`persona-sim` reads the `session` record immediately on probe startup and prints `🔗 session=<id>` to the terminal. The same `sessionId` is used for Log Analytics queries at the end of the run.

### Silent turn detection and recovery

If the agent returns an empty response (no text, no tool calls), persona-sim treats it as a **silent turn**:

1. Prints a `🔴 SILENT TURN` diagnostic block with the server logs captured for that turn.
2. Auto-nudges: clicks the first available action button in the last A2UI card, or sends a fallback prompt if no button is available.
3. If two **consecutive** silent turns occur, persona-sim bails out of that run and marks all remaining milestones as NOT MET.

After each turn where the goal is not yet fully reached, persona-sim prints a **per-turn NOT MET table** listing which milestones are still outstanding.

### Session poisoning protection

Each probe.ts child process has a 180-second hard timeout. If the runner hangs or a tool call never returns, the process is killed and the run is marked as timed out. This prevents a single stuck session from blocking the entire harness.

---

## Session correlation and Log Analytics

### Correlation IDs

Every probe subprocess emits its runner `sessionId` as the very first line of stdout (`stream:"session"`). `persona-sim` prints this as:

```
🔗 session=3f7a1b2c-…
```

The same ID is printed again at the end of each persona run alongside an **Azure Monitor deep-link** that opens the relevant traces directly in the Azure Portal:

```
🔗 session=3f7a1b2c-…
📊 https://portal.azure.com/#blade/…?query=AppTraces%20…
```

After **all** persona runs complete, persona-sim queries the Log Analytics workspace and embeds the results in the summary HTML report.

### Log Analytics trace embedding

At end-of-run, `persona-sim` POSTs the following KQL to the ARM query endpoint using `AZURE_ACCESS_TOKEN`:

```kql
AppTraces
| where Properties.session_id == "<sessionId>"
| project TimeGenerated, SeverityLevel, Message, AgentName, ToolName
| order by TimeGenerated asc
| take 500
```

**Default workspace:**
```
/subscriptions/4498459e-01d5-4a3f-b07e-8f1f36598c16/resourceGroups/ai_kickstart-ai_4f4f6258-c704-49e2-a8b7-e69b7faed7fb_managed/providers/microsoft.operationalinsights/workspaces/managed-kickstart-ai-ws
```

Override with `LOG_ANALYTICS_WORKSPACE_RESOURCE_ID`.

### HTML report — Server Traces section

Each per-persona HTML report and the summary index gain a collapsible **Server Traces** section containing a table with these columns:

| Column | Description |
|---|---|
| Time | `TimeGenerated` from Log Analytics |
| Severity | Colour-coded: error (red), warning (yellow), info (blue) |
| Agent | `AgentName` property |
| Tool | `ToolName` property (if the trace is from a tool call) |
| Message | Full trace message |

This lets you correlate exactly which agent calls and tool invocations happened server-side for any given persona conversation, without leaving the report.

---



When a run finishes with milestones not reached, the harness prints a diagnostic table:

```
┌─────────────────────┬──────────────────────────────────────────┐
│ Milestone           │ Last captured log before bail            │
├─────────────────────┼──────────────────────────────────────────┤
│ artifacts_generated │ [runner] tool azure.quota_lookup called  │
│ repo_connected      │ (no activity after turn 14)              │
└─────────────────────┴──────────────────────────────────────────┘
```

**What to look for:**

- **Silent turns** — the agent stopped responding. Check whether a tool call returned an error, whether the system prompt is overly restrictive, or whether a required tool is missing.
- **Stuck in triage** — `triage_routed` never fires. The agent didn't recognise the user's intent. Review the triage scope section and routing rules.
- **Tool call never completes** — a log line shows the tool was called but no turn follows. Check for missing environment variables or a quota/auth error in the tool.
- **Wrong agent** — the run routed to an unexpected specialist. Check `routing.md` and the triage agent's decision logic.

The full captured log for each turn is available in the HTML report under **Turn Details**.

---

## Configuration

The persona sim requires the same environment variables as the harness itself, plus an OpenAI endpoint for persona generation:

| Variable | Required | Purpose |
|---|---|---|
| `AZURE_OPENAI_ENDPOINT` | Yes | Azure OpenAI endpoint for persona generation |
| `AZURE_OPENAI_API_KEY` | Yes (or `AZURE_OPENAI_AD_TOKEN`) | API key for persona generation |
| `AZURE_OPENAI_DEPLOYMENT` | No | Model deployment name (default: `gpt-4o`) |
| `AZURE_ACCESS_TOKEN` | No | ARM bearer token — required for Log Analytics trace queries and the Azure Monitor deep-link |
| `LOG_ANALYTICS_WORKSPACE_RESOURCE_ID` | No | Override the default Log Analytics workspace resource ID for trace embedding |
| `HARNESS_*` | As needed | Any env vars required by probe.ts / runner |

The probe subprocess inherits all environment variables from the parent process.

> **ARM token tip:** Run `az account get-access-token --resource https://management.azure.com --query accessToken -o tsv` and export the result as `AZURE_ACCESS_TOKEN` before running the sim. Without it, Log Analytics queries are skipped and the deep-link is omitted from reports.
