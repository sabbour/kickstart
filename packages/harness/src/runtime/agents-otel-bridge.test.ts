import { describe, it, expect, beforeEach, vi } from 'vitest';
import { trace, SpanKind } from '@opentelemetry/api';
import { OtelBridgeTraceProcessor } from './agents-otel-bridge.js';

// Minimal fakes matching the shapes the bridge reads. The SDK types are
// structural enough that plain objects with the documented fields work.
type FakeTrace = { traceId: string; name: string; metadata?: Record<string, unknown> };
type FakeSpan = {
  traceId: string;
  spanId: string;
  parentId: string | null;
  spanData: { type: string } & Record<string, unknown>;
  error: { message: string } | null;
};

function makeSpan(partial: Partial<FakeSpan> & Pick<FakeSpan, 'spanId' | 'traceId' | 'spanData'>): FakeSpan {
  return { parentId: null, error: null, ...partial };
}

function makeTracerSpy() {
  const spans: Array<{
    name: string;
    attributes: Record<string, unknown>;
    parent: unknown;
    ended: boolean;
    setAttribute: (k: string, v: unknown) => void;
    setStatus: (s: { code: number; message?: string }) => void;
    recordException: (e: unknown) => void;
    end: () => void;
  }> = [];

  const startSpan = vi.fn((name: string, options: { attributes?: Record<string, unknown> } = {}, parentCtx?: unknown) => {
    const attributes: Record<string, unknown> = { ...(options.attributes ?? {}) };
    const s = {
      name,
      attributes,
      parent: parentCtx,
      ended: false,
      setAttribute(k: string, v: unknown) { attributes[k] = v; },
      setStatus: vi.fn(),
      recordException: vi.fn(),
      end() { this.ended = true; },
    };
    spans.push(s);
    return s as unknown as ReturnType<ReturnType<typeof trace.getTracer>['startSpan']>;
  });

  const tracer = { startSpan } as unknown as ReturnType<typeof trace.getTracer>;
  return { tracer, spans, startSpan };
}

describe('OtelBridgeTraceProcessor', () => {
  beforeEach(() => {
    delete process.env.KICKSTART_OTEL_RECORD_CONTENT;
  });

  it('mirrors trace + nested spans into OpenTelemetry spans with parent chain preserved', async () => {
    const { tracer, spans } = makeTracerSpy();
    const bridge = new OtelBridgeTraceProcessor(tracer);

    const sdkTrace: FakeTrace = { traceId: 'trace_abc', name: 'Agent workflow' };
    await bridge.onTraceStart(sdkTrace as unknown as Parameters<typeof bridge.onTraceStart>[0]);

    const agentSpan = makeSpan({
      traceId: 'trace_abc',
      spanId: 'span_agent',
      spanData: { type: 'agent', name: 'discover', tools: ['azure.list_resource_groups'], handoffs: ['assess'] },
    });
    const genSpan = makeSpan({
      traceId: 'trace_abc',
      spanId: 'span_gen',
      parentId: 'span_agent',
      spanData: { type: 'generation', model: 'gpt-4o-mini', usage: { input_tokens: 42, output_tokens: 17 } },
    });
    const funcSpan = makeSpan({
      traceId: 'trace_abc',
      spanId: 'span_func',
      parentId: 'span_agent',
      spanData: { type: 'function', name: 'azure.list_resource_groups', input: '{"loc":"eastus"}', output: '[]' },
    });

    await bridge.onSpanStart(agentSpan as unknown as Parameters<typeof bridge.onSpanStart>[0]);
    await bridge.onSpanStart(genSpan as unknown as Parameters<typeof bridge.onSpanStart>[0]);
    await bridge.onSpanStart(funcSpan as unknown as Parameters<typeof bridge.onSpanStart>[0]);

    await bridge.onSpanEnd(genSpan as unknown as Parameters<typeof bridge.onSpanEnd>[0]);
    await bridge.onSpanEnd(funcSpan as unknown as Parameters<typeof bridge.onSpanEnd>[0]);
    await bridge.onSpanEnd(agentSpan as unknown as Parameters<typeof bridge.onSpanEnd>[0]);
    await bridge.onTraceEnd(sdkTrace as unknown as Parameters<typeof bridge.onTraceEnd>[0]);

    // 1 trace + 3 spans = 4 OTel spans
    expect(spans).toHaveLength(4);
    expect(spans[0].name).toBe('Agent workflow');
    expect(spans[1].name).toBe('agent.discover');
    expect(spans[2].name).toBe('generation.gpt-4o-mini');
    expect(spans[3].name).toBe('tool.azure.list_resource_groups');

    // Generation span gets GenAI semantic-convention attributes.
    expect(spans[2].attributes['gen_ai.system']).toBe('openai');
    expect(spans[2].attributes['gen_ai.request.model']).toBe('gpt-4o-mini');
    expect(spans[2].attributes['gen_ai.usage.input_tokens']).toBe(42);
    expect(spans[2].attributes['gen_ai.usage.output_tokens']).toBe(17);

    // Function span does NOT leak tool input/output by default (content recording off).
    expect(spans[3].attributes['openai.agents.tool_input']).toBeUndefined();
    expect(spans[3].attributes['openai.agents.tool_output']).toBeUndefined();

    // All spans were ended.
    for (const s of spans) expect(s.ended).toBe(true);
  });

  it('records tool input/output only when KICKSTART_OTEL_RECORD_CONTENT=true, and sanitizes first', async () => {
    process.env.KICKSTART_OTEL_RECORD_CONTENT = 'true';
    const { tracer, spans } = makeTracerSpy();
    const bridge = new OtelBridgeTraceProcessor(tracer);

    await bridge.onTraceStart({ traceId: 't1', name: 'wf' } as unknown as Parameters<typeof bridge.onTraceStart>[0]);
    const funcSpan = makeSpan({
      traceId: 't1',
      spanId: 's1',
      spanData: {
        type: 'function',
        name: 'core.emit_ui',
        input: 'Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig plus api_key=sk-abcd1234',
        output: 'AccountKey=REDACTME+ABC==',
      },
    });
    await bridge.onSpanStart(funcSpan as unknown as Parameters<typeof bridge.onSpanStart>[0]);
    await bridge.onSpanEnd(funcSpan as unknown as Parameters<typeof bridge.onSpanEnd>[0]);

    const s = spans.find((sp) => sp.name === 'tool.core.emit_ui');
    const inp = String(s?.attributes['openai.agents.tool_input']);
    const out = String(s?.attributes['openai.agents.tool_output']);
    expect(inp).toContain('[REDACTED]');
    expect(inp).not.toContain('sk-abcd1234');
    expect(inp).not.toMatch(/eyJhbGciOiJIUzI1NiJ9\.payload\.sig/);
    expect(out).toContain('[REDACTED]');
    expect(out).not.toContain('REDACTME+ABC==');
  });

  it('sanitizes SDK span error messages before emitting them on the OTel span', async () => {
    const { tracer, spans } = makeTracerSpy();
    const bridge = new OtelBridgeTraceProcessor(tracer);

    await bridge.onTraceStart({ traceId: 't1', name: 'wf' } as unknown as Parameters<typeof bridge.onTraceStart>[0]);
    const badSpan = makeSpan({
      traceId: 't1',
      spanId: 's1',
      spanData: { type: 'generation', model: 'gpt-4o' },
      error: {
        message: 'upstream 404 from https://x.openai.azure.com/path?api-key=sk-leak1234',
      },
    });
    await bridge.onSpanStart(badSpan as unknown as Parameters<typeof bridge.onSpanStart>[0]);
    await bridge.onSpanEnd(badSpan as unknown as Parameters<typeof bridge.onSpanEnd>[0]);

    const gen = spans.find((s) => s.name === 'generation.gpt-4o');
    expect(gen).toBeDefined();
    // @ts-expect-error — test spy accessor
    const statusCall = gen.setStatus.mock.calls[0][0];
    expect(statusCall.code).toBe(2);
    expect(statusCall.message).toContain('[REDACTED]');
    expect(statusCall.message).not.toContain('sk-leak1234');
    // @ts-expect-error — test spy accessor
    const excCall = gen.recordException.mock.calls[0][0];
    expect(excCall.message).toContain('[REDACTED]');
    expect(excCall.message).not.toContain('sk-leak1234');
  });

  it('shutdown force-ends any remaining open spans without throwing', async () => {
    const { tracer, spans } = makeTracerSpy();
    const bridge = new OtelBridgeTraceProcessor(tracer);

    await bridge.onTraceStart({ traceId: 't1', name: 'wf' } as unknown as Parameters<typeof bridge.onTraceStart>[0]);
    await bridge.onSpanStart(
      makeSpan({ traceId: 't1', spanId: 's1', spanData: { type: 'agent', name: 'a' } }) as unknown as Parameters<typeof bridge.onSpanStart>[0],
    );
    await bridge.shutdown();

    for (const s of spans) expect(s.ended).toBe(true);
  });
});
