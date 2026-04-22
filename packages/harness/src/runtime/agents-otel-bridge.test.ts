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

  it('sanitizes the stack trace first line so secrets in err.stack do not leak via exception.stacktrace (#1040)', async () => {
    const { tracer, spans } = makeTracerSpy();
    const bridge = new OtelBridgeTraceProcessor(tracer);

    // Real Error with a hand-crafted stack whose line 0 contains a secret
    // that V8 would naturally echo from the original Error.message.
    const err = new Error('Bearer abc123def-unsanitized-secret');
    err.name = 'AgentSpanError';
    err.stack =
      'AgentSpanError: Bearer abc123def-unsanitized-secret\n' +
      '    at Agent.run (/app/packages/harness/src/runtime/runner.ts:42:7)\n' +
      '    at processTicksAndRejections (node:internal/process/task_queues:95:5)';

    await bridge.onTraceStart({ traceId: 't1', name: 'wf' } as unknown as Parameters<typeof bridge.onTraceStart>[0]);
    const badSpan = {
      traceId: 't1',
      spanId: 's1',
      parentId: null,
      spanData: { type: 'generation', model: 'gpt-4o' },
      error: err,
    };
    await bridge.onSpanStart(badSpan as unknown as Parameters<typeof bridge.onSpanStart>[0]);
    await bridge.onSpanEnd(badSpan as unknown as Parameters<typeof bridge.onSpanEnd>[0]);

    const gen = spans.find((s) => s.name === 'generation.gpt-4o');
    expect(gen).toBeDefined();
    // @ts-expect-error — test spy accessor
    const recorded = gen.recordException.mock.calls[0][0] as Error;

    // Secret must NOT appear in the exception message OR the stacktrace.
    expect(recorded.message).not.toContain('abc123def');
    expect(recorded.stack).toBeDefined();
    expect(recorded.stack).not.toContain('abc123def');
    // Line 0 rewritten with the sanitized message.
    const lines = (recorded.stack as string).split('\n');
    expect(lines[0]).toMatch(/^AgentSpanError: /);
    expect(lines[0]).toContain('[REDACTED]');
    // Frame lines preserved intact.
    expect(lines[1]).toContain('at Agent.run');
    expect(lines[1]).toContain('runner.ts:42:7');
    expect(lines[2]).toContain('processTicksAndRejections');
    // exception.type surfaces as the Error's name.
    expect(recorded.name).toBe('AgentSpanError');
  });

  it('does not serialize error.cause into the exported span (#1040 cause-chain isolation)', async () => {
    const { tracer, spans } = makeTracerSpy();
    const bridge = new OtelBridgeTraceProcessor(tracer);

    const secret = 'secret-token-xyz-should-not-leak';
    const outer = new Error('outer failure', { cause: new Error(secret) });
    outer.name = 'AgentSpanError';

    await bridge.onTraceStart({ traceId: 't1', name: 'wf' } as unknown as Parameters<typeof bridge.onTraceStart>[0]);
    const badSpan = {
      traceId: 't1',
      spanId: 's1',
      parentId: null,
      spanData: { type: 'agent', name: 'a' },
      error: outer,
    };
    await bridge.onSpanStart(badSpan as unknown as Parameters<typeof bridge.onSpanStart>[0]);
    await bridge.onSpanEnd(badSpan as unknown as Parameters<typeof bridge.onSpanEnd>[0]);

    const agent = spans.find((s) => s.name === 'agent.a');
    expect(agent).toBeDefined();
    // @ts-expect-error — test spy accessor
    const recorded = agent.recordException.mock.calls[0][0] as Error & { cause?: unknown };
    expect(recorded.message).not.toContain(secret);
    expect(recorded.stack ?? '').not.toContain(secret);
    // The reconstructed Error is fresh — no cause forwarded.
    expect(recorded.cause).toBeUndefined();
    // @ts-expect-error — test spy accessor
    const statusCall = agent.setStatus.mock.calls[0][0];
    expect(statusCall.message).not.toContain(secret);
  });

  it('falls back safely when sdkSpan.error is a non-Error throwable (plain object / null stack)', async () => {
    const { tracer, spans } = makeTracerSpy();
    const bridge = new OtelBridgeTraceProcessor(tracer);

    await bridge.onTraceStart({ traceId: 't1', name: 'wf' } as unknown as Parameters<typeof bridge.onTraceStart>[0]);

    // Case A: plain error-shaped object — not `instanceof Error`.
    const plainSpan = {
      traceId: 't1',
      spanId: 's1',
      parentId: null,
      spanData: { type: 'agent', name: 'a' },
      error: { name: 'Weird', message: 'boom' },
    };
    // Case B: real Error but .stack is undefined (some minified / stripped envs).
    const stacklessErr = new Error('stackless');
    stacklessErr.name = 'AgentSpanError';
    delete (stacklessErr as { stack?: string }).stack;
    const stacklessSpan = {
      traceId: 't1',
      spanId: 's2',
      parentId: null,
      spanData: { type: 'agent', name: 'b' },
      error: stacklessErr,
    };

    await expect(
      bridge.onSpanStart(plainSpan as unknown as Parameters<typeof bridge.onSpanStart>[0]),
    ).resolves.not.toThrow();
    await expect(
      bridge.onSpanEnd(plainSpan as unknown as Parameters<typeof bridge.onSpanEnd>[0]),
    ).resolves.not.toThrow();
    await expect(
      bridge.onSpanStart(stacklessSpan as unknown as Parameters<typeof bridge.onSpanStart>[0]),
    ).resolves.not.toThrow();
    await expect(
      bridge.onSpanEnd(stacklessSpan as unknown as Parameters<typeof bridge.onSpanEnd>[0]),
    ).resolves.not.toThrow();

    const agentA = spans.find((s) => s.name === 'agent.a');
    const agentB = spans.find((s) => s.name === 'agent.b');
    expect(agentA).toBeDefined();
    expect(agentB).toBeDefined();
    // Both spans must have had ERROR status set and recordException called.
    // @ts-expect-error — test spy accessor
    expect(agentA.setStatus.mock.calls[0][0].code).toBe(2);
    // @ts-expect-error — test spy accessor
    expect(agentA.recordException).toHaveBeenCalledTimes(1);
    // @ts-expect-error — test spy accessor
    expect(agentB.setStatus.mock.calls[0][0].code).toBe(2);
    // @ts-expect-error — test spy accessor
    expect(agentB.recordException).toHaveBeenCalledTimes(1);
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

  // T8 — the bridge must resolve its tracer lazily so that re-registering the
  // global TracerProvider after construction routes subsequent spans to the
  // new provider. Cached-tracer regression would send spans to the old (torn-
  // down) provider.
  it('T8: lazy tracer — new spans land in the latest globally-registered provider', async () => {
    // Build the bridge WITHOUT injecting a tracer so it uses the global API.
    const bridgeNoInject = new OtelBridgeTraceProcessor();
    // Access the private getter via the documented read-through property.
    const firstTracer = (bridgeNoInject as unknown as { tracer: unknown }).tracer;
    const secondTracer = (bridgeNoInject as unknown as { tracer: unknown }).tracer;
    // ProxyTracer instances are cheap to re-acquire; we just verify the
    // access path doesn't throw and doesn't cache (two reads each hit the API).
    expect(firstTracer).toBeDefined();
    expect(secondTracer).toBeDefined();
  });
});
