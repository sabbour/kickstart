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
| **Live terminal** | Streaming turn-by-turn output with spinner while waiting for agent response |
| **Milestone tracker** | Real-time `✓ / ✗` table showing which milestones were hit and when |
| **HTML reports** | Per-persona conversation replays with milestone annotations, saved to `reports/` |
| **NOT MET table** | Diagnostic table shown for any milestone not reached, including last captured logs |

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

### Streaming protocol

Each line written by `probe.ts` is a JSON record with a `type` field:

| Type | Description |
|---|---|
| `turn` | Full turn record: `{ turn, agent, text, tools, a2ui, elapsed_ms }` |
| `chunk` | Streaming text delta from the model |
| `tool` | Tool call record: `{ name, args }` |
| `log` | Internal runner log line (captured for diagnostics) |

### Silent turn detection and recovery

If the agent returns an empty response (no text, no tool calls), persona-sim treats it as a **silent turn**. It automatically sends a nudge message ("Please continue") on the first silent turn. If two consecutive silent turns occur, persona-sim bails out of that run and marks all remaining milestones as NOT MET.

### Session poisoning protection

Each probe.ts child process has a 180-second hard timeout. If the runner hangs or a tool call never returns, the process is killed and the run is marked as timed out. This prevents a single stuck session from blocking the entire harness.

---

## Debugging NOT MET milestones

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
| `HARNESS_*` | As needed | Any env vars required by probe.ts / runner |

The probe subprocess inherits all environment variables from the parent process.
