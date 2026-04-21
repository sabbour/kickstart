/**
 * Bridge that translates `@openai/agents` SDK tracing events into
 * OpenTelemetry spans.
 *
 * ## Why this exists
 *
 * The `@openai/agents` JavaScript SDK has its own tracing system (separate
 * from OpenTelemetry). By default, its `BatchTraceProcessor` exports spans
 * to OpenAI's traces dashboard via `OpenAITracingExporter`. We don't use
 * that dashboard, and more importantly those spans never reach Azure
 * Application Insights.
 *
 * Meanwhile, the Azure Monitor OpenTelemetry distro (`useAzureMonitor()`,
 * wired in `packages/web/api/src/lib/appinsights.ts`) captures outbound
 * HTTP dependencies automatically — but it has no insight into agent-level
 * semantics: which agent is running, which tool was invoked with what
 * input, which LLM generation used which model, token usage, handoffs, or
 * guardrail outcomes. A single user turn shows up as N flat dependency
 * rows with no parent/child hierarchy.
 *
 * This processor closes that gap: it implements the SDK's
 * `TracingProcessor` interface, and for every agent Trace/Span it opens a
 * mirror OpenTelemetry `Span` using `@opentelemetry/api`. Those OTel spans
 * flow through the OTel SDK already bootstrapped in the API layer and land
 * in Application Insights as `requests`/`dependencies` with full parent/
 * child nesting. Outbound HTTP dependencies captured by the undici OTel
 * instrumentation become children of the corresponding `generation` span,
 * giving us rich traces: workflow → agent → generation (with model, token
 * usage) → outbound HTTPS dependency to *.openai.azure.com with status.
 *
 * ## Design choices
 *
 * - **No AsyncLocalStorage reliance.** The SDK fires span lifecycle
 *   callbacks from its own async contexts; we cannot assume the OTel
 *   current context matches. We maintain our own id → OTel span map and
 *   attach parent OTel spans explicitly via `trace.setSpan`.
 * - **Safe when OTel is not configured.** `@opentelemetry/api` returns a
 *   no-op tracer if no TracerProvider is registered. This processor then
 *   creates no-op spans — no runtime cost, no errors.
 * - **No PII leakage by default.** We do NOT write raw tool inputs/
 *   outputs or raw generation input/output arrays onto span attributes.
 *   Only structural + non-sensitive fields are set (model name, token
 *   counts, tool names, agent names, guardrail outcomes). This matches
 *   the MS Learn guidance to keep `enable_content_recording` OFF in
 *   production. Callers who want richer payloads can set
 *   `KICKSTART_OTEL_RECORD_CONTENT=true` to opt in.
 */

import {
  trace as otelTraceApi,
  context as otelContextApi,
  SpanKind,
  SpanStatusCode,
  type Span as OtelSpan,
  type Tracer,
} from '@opentelemetry/api';
import type { TracingProcessor } from '@openai/agents';
import type { Trace, Span, SpanData } from '@openai/agents';
import { sanitizeText } from './redact.js';

const TRACER_NAME = '@openai/agents';

function contentRecordingEnabled(): boolean {
  return process.env.KICKSTART_OTEL_RECORD_CONTENT === 'true';
}

function deriveOtelSpanName(data: SpanData): string {
  switch (data.type) {
    case 'agent':
      return `agent.${data.name}`;
    case 'function':
      return `tool.${data.name}`;
    case 'generation':
      return data.model ? `generation.${data.model}` : 'generation';
    case 'response':
      return 'response';
    case 'handoff':
      return `handoff.${data.from_agent ?? '?'}→${data.to_agent ?? '?'}`;
    case 'guardrail':
      return `guardrail.${data.name}`;
    case 'custom':
      return `custom.${data.name}`;
    case 'mcp_tools':
      return `mcp.list_tools${data.server ? `.${data.server}` : ''}`;
    case 'transcription':
      return 'transcription';
    case 'speech':
      return 'speech';
    case 'speech_group':
      return 'speech_group';
    default: {
      const type = (data as { type?: string }).type ?? 'span';
      return `openai.agents.${type}`;
    }
  }
}

function applySpanAttributes(otelSpan: OtelSpan, sdkSpan: Span<SpanData>): void {
  const data = sdkSpan.spanData;
  otelSpan.setAttribute('openai.agents.span_id', sdkSpan.spanId);
  otelSpan.setAttribute('openai.agents.trace_id', sdkSpan.traceId);
  otelSpan.setAttribute('openai.agents.span_type', data.type);

  const recordContent = contentRecordingEnabled();

  switch (data.type) {
    case 'agent':
      otelSpan.setAttribute('openai.agents.agent_name', data.name);
      if (data.tools?.length) {
        otelSpan.setAttribute('openai.agents.tools', data.tools.join(','));
      }
      if (data.handoffs?.length) {
        otelSpan.setAttribute('openai.agents.handoffs', data.handoffs.join(','));
      }
      if (data.output_type) {
        otelSpan.setAttribute('openai.agents.output_type', data.output_type);
      }
      break;
    case 'function':
      otelSpan.setAttribute('openai.agents.tool_name', data.name);
      if (recordContent) {
        // Even in opt-in mode, run tool I/O through the shared redaction
        // rules — tool args/results can carry Bearer tokens, api-keys,
        // connection strings, etc. Sanitize BEFORE the length clamp so a
        // redacted marker always lands inside the 8 KB window.
        if (typeof data.input === 'string') {
          otelSpan.setAttribute(
            'openai.agents.tool_input',
            sanitizeText(data.input).slice(0, 8192),
          );
        }
        if (typeof data.output === 'string') {
          otelSpan.setAttribute(
            'openai.agents.tool_output',
            sanitizeText(data.output).slice(0, 8192),
          );
        }
      }
      break;
    case 'generation':
      // GenAI semantic conventions (stable subset).
      otelSpan.setAttribute('gen_ai.system', 'openai');
      otelSpan.setAttribute('gen_ai.operation.name', 'chat');
      if (data.model) {
        otelSpan.setAttribute('gen_ai.request.model', data.model);
      }
      if (data.usage?.input_tokens !== undefined) {
        otelSpan.setAttribute('gen_ai.usage.input_tokens', data.usage.input_tokens);
      }
      if (data.usage?.output_tokens !== undefined) {
        otelSpan.setAttribute('gen_ai.usage.output_tokens', data.usage.output_tokens);
      }
      break;
    case 'response':
      if (data.response_id) {
        otelSpan.setAttribute('openai.agents.response_id', data.response_id);
      }
      break;
    case 'handoff':
      if (data.from_agent) otelSpan.setAttribute('openai.agents.from_agent', data.from_agent);
      if (data.to_agent) otelSpan.setAttribute('openai.agents.to_agent', data.to_agent);
      break;
    case 'guardrail':
      otelSpan.setAttribute('openai.agents.guardrail_name', data.name);
      otelSpan.setAttribute('openai.agents.guardrail_triggered', data.triggered);
      break;
    case 'mcp_tools':
      if (data.server) otelSpan.setAttribute('openai.agents.mcp_server', data.server);
      if (data.result?.length) {
        otelSpan.setAttribute('openai.agents.mcp_tool_count', data.result.length);
      }
      break;
    default:
      break;
  }

  if (sdkSpan.error) {
    // Error messages from tools / the SDK can echo user input or upstream
    // HTTP payloads. Redact before emitting to Application Insights.
    const safeMsg = sanitizeText(sdkSpan.error.message);
    otelSpan.setStatus({ code: SpanStatusCode.ERROR, message: safeMsg });
    otelSpan.recordException({ name: 'AgentSpanError', message: safeMsg });
  }
}

interface OtelRef {
  span: OtelSpan;
  kind: 'trace' | 'span';
}

/**
 * TracingProcessor that mirrors `@openai/agents` tracing events into
 * OpenTelemetry spans for export via the Azure Monitor OTel distro.
 */
export class OtelBridgeTraceProcessor implements TracingProcessor {
  private readonly injectedTracer?: Tracer;
  private readonly byTraceId = new Map<string, OtelRef>();
  private readonly bySpanId = new Map<string, OtelRef>();

  constructor(tracer?: Tracer) {
    this.injectedTracer = tracer;
  }

  /**
   * Lazy tracer lookup. `@opentelemetry/api.trace.getTracer()` returns a
   * `ProxyTracer` that forwards to the currently-registered global
   * TracerProvider on every call — re-resolving here is free and is the
   * documented mechanism for surviving provider re-registration.
   *
   * Caching the tracer at construction time (the old behavior) silently
   * broke if `useAzureMonitor()` ran after the Runner constructed this
   * processor — the cached Tracer retained a handle to the torn-down
   * provider and subsequent spans went nowhere. See issue #1030 / Nibbler B3.
   */
  private get tracer(): Tracer {
    return this.injectedTracer ?? otelTraceApi.getTracer(TRACER_NAME);
  }

  async onTraceStart(trace: Trace): Promise<void> {
    const name = trace.name || 'openai.agents.workflow';
    const otelSpan = this.tracer.startSpan(name, {
      kind: SpanKind.INTERNAL,
      attributes: {
        'openai.agents.trace_id': trace.traceId,
        'openai.agents.workflow_name': trace.name,
      },
    });
    this.byTraceId.set(trace.traceId, { span: otelSpan, kind: 'trace' });
  }

  async onTraceEnd(trace: Trace): Promise<void> {
    const ref = this.byTraceId.get(trace.traceId);
    if (!ref) return;
    ref.span.end();
    this.byTraceId.delete(trace.traceId);
  }

  async onSpanStart(span: Span<SpanData>): Promise<void> {
    const parentRef = span.parentId
      ? this.bySpanId.get(span.parentId)
      : this.byTraceId.get(span.traceId);

    const name = deriveOtelSpanName(span.spanData);
    const parentCtx = parentRef
      ? otelTraceApi.setSpan(otelContextApi.active(), parentRef.span)
      : otelContextApi.active();

    const otelSpan = this.tracer.startSpan(
      name,
      { kind: SpanKind.INTERNAL },
      parentCtx,
    );
    this.bySpanId.set(span.spanId, { span: otelSpan, kind: 'span' });
  }

  async onSpanEnd(span: Span<SpanData>): Promise<void> {
    const ref = this.bySpanId.get(span.spanId);
    if (!ref) return;
    applySpanAttributes(ref.span, span);
    ref.span.end();
    this.bySpanId.delete(span.spanId);
  }

  async shutdown(_timeout?: number): Promise<void> {
    for (const ref of this.bySpanId.values()) ref.span.end();
    for (const ref of this.byTraceId.values()) ref.span.end();
    this.bySpanId.clear();
    this.byTraceId.clear();
  }

  async forceFlush(): Promise<void> {
    // OTel flush is owned by the global TracerProvider (e.g. Azure Monitor
    // distro's BatchSpanProcessor). This bridge holds no buffered state of
    // its own — each SDK span lifecycle event is translated synchronously
    // into an OTel span lifecycle event, so there is nothing to flush here.
  }
}
