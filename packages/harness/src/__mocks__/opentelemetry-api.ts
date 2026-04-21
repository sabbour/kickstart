/**
 * Minimal stub for @opentelemetry/api used in unit tests.
 *
 * The real otel library is not installed in the test environment. This stub
 * provides just enough surface area for the harness barrel and the otel bridge
 * to load and function at unit-test level without the full OpenTelemetry
 * install. Prevents "Cannot find package '@opentelemetry/api'" errors when the
 * harness barrel is imported transitively in pack-core and harness unit tests.
 */

export const SpanKind = { INTERNAL: 1, SERVER: 2, CLIENT: 3, PRODUCER: 4, CONSUMER: 5 } as const;
export const SpanStatusCode = { UNSET: 0, OK: 1, ERROR: 2 } as const;

const noopSpan = {
  setAttribute: () => noopSpan,
  setAttributes: () => noopSpan,
  setStatus: () => noopSpan,
  recordException: () => noopSpan,
  addEvent: () => noopSpan,
  updateName: () => noopSpan,
  isRecording: () => false,
  end: () => undefined,
  spanContext: () => ({ traceId: '', spanId: '', traceFlags: 0 }),
};

const noopTracer = {
  startSpan: () => noopSpan,
  startActiveSpan: (_name: string, _opts: unknown, fn?: (span: unknown) => unknown) => {
    const cb = typeof _opts === 'function' ? _opts : fn;
    return cb ? (cb as (s: typeof noopSpan) => unknown)(noopSpan) : undefined;
  },
};

export const trace = {
  getTracer: () => noopTracer,
  getActiveSpan: () => undefined,
  setSpan: (_ctx: unknown, _span: unknown) => ({}),
  getSpan: (_ctx: unknown) => undefined,
  wrapSpanContext: (ctx: unknown) => ctx,
  deleteSpan: (ctx: unknown) => ctx,
  getTracerProvider: () => ({
    getTracer: () => noopTracer,
    getDelegate: () => ({ forceFlush: async () => undefined }),
    forceFlush: async () => undefined,
  }),
  disable: () => undefined,
};

export const logs = {
  getLogger: () => ({ emit: () => undefined }),
  getLoggerProvider: () => ({
    getLogger: () => ({ emit: () => undefined }),
    forceFlush: async () => undefined,
  }),
};

export const metrics = {
  getMeter: () => ({}),
  getMeterProvider: () => ({
    getMeter: () => ({}),
    forceFlush: async () => undefined,
  }),
};

export const diag = {
  setLogger: () => undefined,
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

export const DiagLogLevel = { NONE: 0, ERROR: 30, WARN: 50, INFO: 60, DEBUG: 70, VERBOSE: 80, ALL: 9999 } as const;

export const context = {
  active: () => ({}),
  with: (_ctx: unknown, fn: () => unknown) => fn(),
  bind: (_ctx: unknown, fn: unknown) => fn,
  disable: () => undefined,
};

