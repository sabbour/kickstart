---
sidebar_position: 4
---

# Chat CLI Reference

The **chat CLI** (`npm run chat`) drives multi-turn conversations directly against the Kickstart harness, perfect for testing, development, and non-interactive workflows.

## When to use Chat CLI vs. the Web UI

| Scenario | Tool |
|----------|------|
| Interactive exploration, see response streaming | Web UI |
| Batch testing, automated scoring, CI integration | Chat CLI |
| Single-turn evaluation of a specific prompt | Chat CLI |
| Piping responses into other tools | Chat CLI |
| Scoring against a sim fixture | Chat CLI |
| Working in a terminal without a browser | Chat CLI |

## Prerequisites

### Credentials

The chat CLI requires **either** Azure OpenAI or OpenAI credentials:

```bash
# Azure OpenAI (recommended for kickstart deployments)
export AZURE_OPENAI_ENDPOINT="https://your-resource.cognitiveservices.azure.com/"
export AZURE_OPENAI_API_KEY="your-api-key"

# OR OpenAI (fallback)
export OPENAI_API_KEY="your-api-key"
```

### Configuration

```bash
# Optional: specify which packs to load (default: all four)
export KICKSTART_PACKS="core,azure,aks,github"
```

See [Environment Variables](./environment-variables.md) for the complete reference.

## Usage Modes

### Single-turn evaluation

Send one message and exit:

```bash
npm run chat -- --message "deploy my Next.js app to AKS"
```

Output streams to stdout with formatting (tool calls, chunks, etc.). To silence output, use `-q/--quiet`:

```bash
npm run chat -- --message "deploy my app" --quiet
```

### Save output for scoring

Capture the SSE event stream as `ActualOutput` JSON:

```bash
npm run chat -- --message "deploy my app" --output results.json
```

The file `results.json` can be scored against a sim fixture (see [Integration with sim-test](#integration-with-sim-test) below).

### Interactive mode

Launch an interactive multi-turn conversation:

```bash
npm run chat -- --interactive
```

The CLI reads messages from stdin until you exit with Ctrl-D or type `exit` / `quit`. Each message runs through the agent and streams output.

**Combine with --message for initial context:**

```bash
npm run chat -- --interactive --message "I'm working on an AKS deployment"
```

The initial message runs first, then the CLI enters the interactive loop.

### Pipe mode

For non-interactive batch processing, pipe multiple messages (one per line):

```bash
echo -e "deploy my app\nuse KEDA" | npm run chat -- --interactive --output results.json --quiet
```

Each line becomes a separate turn. Output is written to `results.json` and the streams are suppressed with `-q/--quiet`.

### Auto-score against a sim fixture

Run a single-turn evaluation and immediately score against a golden fixture:

```bash
npm run chat -- --message "deploy my app" --output results.json --sim sims/sim-01-sam-nextjs.md
```

This:
1. Runs the message through the agent
2. Saves `ActualOutput` to `results.json`
3. Parses the fixture `sims/sim-01-sam-nextjs.md`
4. Scores the actual output against the fixture's criteria
5. Displays a score summary

If scoring fails (score < 100), the CLI exits with code 1.

## Flag Reference

| Flag | Short | Type | Default | Description |
|------|-------|------|---------|-------------|
| `--message` | `-m` | string | — | First message to send (optional with `--interactive`) |
| `--interactive` | `-i` | boolean | false | Enter interactive multi-turn loop (reads from stdin) |
| `--output` | `-o` | string | — | Write `ActualOutput` JSON to file |
| `--transcript` | `-t` | string | — | Write full SSE event transcript to file (detailed debugging) |
| `--sim` | `-s` | string | — | Auto-score against sim fixture after the run |
| `--agent` | `-a` | string | `core.triage` | Starting agent (e.g., `core.triage`, `core.azure`) |
| `--workspace` | `-w` | string | `process.cwd()` | Workspace root for the session (for file-aware tasks) |
| `--max-turns` | — | number | 20 | Max turns for single-message non-interactive mode |
| `--quiet` | `-q` | boolean | false | Suppress streaming output (still writes to `--output`) |
| `--help` | `-h` | boolean | false | Show help and exit |

## Integration with sim-test

The chat CLI integrates seamlessly with the sim-test scoring engine for a **record → score** workflow:

### Recording a run

```bash
npm run chat -- \
  --message "my user question" \
  --output actual.json \
  --quiet
```

The `ActualOutput` JSON contains the SSE event stream and turn metadata.

### Scoring against a fixture

Once you have `actual.json`, score it:

```bash
npm run sim-test actual.json --fixture sims/sim-01-example.md
```

Or combine in one step:

```bash
npm run chat -- --message "my question" --output actual.json --sim sims/sim-01-example.md
```

### Example workflow

```bash
# 1. Record a run
npm run chat -- --message "set up AKS with auto-scaling" \
  --output runs/run-001.json \
  --quiet

# 2. Score it (inline)
npm run sim-test runs/run-001.json --fixture sims/autoscale.md

# 3. Or score later
npm run chat -- \
  --message "set up AKS with auto-scaling" \
  --output runs/run-001.json \
  --sim sims/autoscale.md
```

For sim fixture authoring, see sim-test scoring.

## Common Patterns

### Quiet, batch evaluation

```bash
npm run chat -- --message "your prompt" --output out.json --quiet
```

Perfect for CI/CD pipelines — no terminal noise, just the JSON output.

### Switch agents mid-run

```bash
npm run chat -- --interactive --agent core.azure
```

Starts the session with the `core.azure` agent instead of the default `core.triage`.

### Test with a specific workspace

```bash
npm run chat -- \
  --message "analyze my repo" \
  --workspace /path/to/my/project
```

The session treats `/path/to/my/project` as the workspace root for file reads and context.

### Full transcript for debugging

When you need to examine every SSE event (chunk, tool calls, tool results, etc.):

```bash
npm run chat -- --message "my message" --transcript events.json --output results.json
```

Now you have:
- `events.json` — raw SSE event stream (detailed debugging)
- `results.json` — `ActualOutput` summary (for scoring)

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success (or interactive session exited gracefully) |
| 1 | Scoring failed (when `--sim` is used) |
| 2 | Could not parse sim fixture (when `--sim` is used) |

## Tips & Troubleshooting

### "Error: provide --message or --interactive"

You must provide either `--message "..."` or `--interactive`. At least one is required.

### Output already exists

The CLI will overwrite `--output` and `--transcript` files without prompting. Move or rename existing files if you want to preserve them.

### Agent not responding

If a message hangs or times out, it may exceed the `--max-turns` limit. Increase it:

```bash
npm run chat -- --message "complex task" --max-turns 50
```

### Credentials not found

Ensure your environment variables are set:

```bash
echo $AZURE_OPENAI_ENDPOINT
echo $AZURE_OPENAI_API_KEY
# or
echo $OPENAI_API_KEY
```

If missing, the CLI will error on bootstrap.

### Streaming shows tool symbols but no output

This is normal. Tool calls stream as `⚙ tool-name` (start) and `✓ tool-name` (done). Use `--quiet` if you only want the final message.
