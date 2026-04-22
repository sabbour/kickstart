/**
 * Browser telemetry bootstrap — OpenTelemetry web SDK + Azure Monitor exporter,
 * wrapped by `BrowserRedactingSpanExporter`.
 *
 * Gated by the `web.telemetry.browser.enabled` runtime feature flag (see
 * `fetchBrowserTelemetryConfig`). When the flag is off — the default — no
 * provider is registered, no exporter is instantiated, and no network egress
 * occurs. See DP-D revision 2 (issue #1042) and Zapp's binding constraints.
 *
 * SDK choice: Option B only. `@microsoft/applicationinsights-web` is
 * DISQUALIFIED (Zapp Decision 1: dynamic-script-injection + CSP widening).
 */

import { context, trace } from "@opentelemetry/api";
import {
  WebTracerProvider,
  BatchSpanProcessor,
} from "@opentelemetry/sdk-trace-web";
import {
  TraceIdRatioBasedSampler,
  ParentBasedSampler,
} from "@opentelemetry/sdk-trace-base";
import { W3CTraceContextPropagator } from "@opentelemetry/core";
import { ZoneContextManager } from "@opentelemetry/context-zone";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { AzureMonitorTraceExporter } from "@azure/monitor-opentelemetry-exporter";
import { BrowserRedactingSpanExporter } from "./browser-redacting-span-exporter";

/** Runtime flag name — operators flip this in App Settings (kill switch). */
export const BROWSER_TELEMETRY_FLAG = "web.telemetry.browser.enabled";

/** Default sampling ratio — 10% per Zapp Decision 4. */
const DEFAULT_SAMPLING_RATIO = 0.1;

/** Browser telemetry configuration shape served by `/api/config`. */
export interface BrowserTelemetryConfig {
  /** Feature flag — if false, tracing is not initialized. */
  enabled: boolean;
  /**
   * App Insights connection string (telemetry-only credential, public by
   * design). Server may omit for environments where telemetry is off; the
   * browser falls back to `VITE_APPINSIGHTS_CONNECTION_STRING`.
   */
  connectionString?: string;
  /** Optional override for the default 10% sampler. */
  samplingRatio?: number;
}

interface WindowExt extends Window {
  __appInsightsConnectionString?: string;
  __featureFlags?: Record<string, boolean | string | number | undefined>;
}

/**
 * Resolve the App Insights connection string with documented precedence:
 *   1. `window.__appInsightsConnectionString` (runtime injection via
 *      `/api/config` or inline `<script>` block — key rotation escape hatch)
 *   2. `import.meta.env.VITE_APPINSIGHTS_CONNECTION_STRING` (build-time
 *      fallback — telemetry-only cred, public by design)
 *   3. empty string → caller should treat as disabled.
 */
export function resolveConnectionString(): string {
  const w = globalThis as unknown as WindowExt;
  const runtime = w?.__appInsightsConnectionString;
  if (typeof runtime === "string" && runtime.length > 0) return runtime;

  const fromEnv = (import.meta as unknown as { env?: Record<string, string | undefined> })
    ?.env?.VITE_APPINSIGHTS_CONNECTION_STRING;
  if (typeof fromEnv === "string" && fromEnv.length > 0) return fromEnv;

  return "";
}

/**
 * Resolve the runtime feature flag. Precedence:
 *   1. `window.__featureFlags.telemetryBrowserEnabled` (inline block served
 *      alongside the `/api/config` payload — allows <60s kill on SPA nav).
 *   2. `import.meta.env.VITE_ENABLE_BROWSER_TELEMETRY === 'true'` (secondary
 *      build-time default when `/api/config` is unreachable). Explicitly NOT
 *      the kill switch per DP §2.
 *   3. `false` (safe default).
 */
export function resolveFlagEnabled(config?: BrowserTelemetryConfig): boolean {
  if (config && typeof config.enabled === "boolean") return config.enabled;
  const w = globalThis as unknown as WindowExt;
  const runtime = w?.__featureFlags?.telemetryBrowserEnabled;
  if (typeof runtime === "boolean") return runtime;
  const fromEnv = (import.meta as unknown as { env?: Record<string, string | undefined> })
    ?.env?.VITE_ENABLE_BROWSER_TELEMETRY;
  return fromEnv === "true" || fromEnv === "1";
}

/** Fetch `/api/config` with a short timeout; returns undefined on any failure. */
export async function fetchBrowserTelemetryConfig(
  signal?: AbortSignal,
): Promise<BrowserTelemetryConfig | undefined> {
  try {
    const res = await fetch("/api/config", {
      credentials: "same-origin",
      signal,
    });
    if (!res.ok) return undefined;
    const data = (await res.json()) as {
      appInsightsConnectionString?: string;
      featureFlags?: Record<string, boolean>;
    };
    return {
      enabled: Boolean(data.featureFlags?.[BROWSER_TELEMETRY_FLAG]),
      connectionString: data.appInsightsConnectionString,
    };
  } catch {
    return undefined;
  }
}

export interface ActiveBrowserTelemetry {
  shutdown(): Promise<void>;
  forceFlush(): Promise<void>;
}

let active: ActiveBrowserTelemetry | null = null;

/**
 * Resolved once the async telemetry bootstrap has finished — regardless of
 * whether it actually initialised a provider. Tests (Playwright) and the
 * SPA-nav kill-switch poller can `await` this to avoid a race against the
 * first user-initiated fetch. Exposed on `window.__kickstartTelemetryReady`
 * for the E2E scenarios (#1042 review — Leela blocker 2).
 */
let _readyResolve: (() => void) | null = null;
const ready: Promise<void> = new Promise<void>((resolve) => {
  _readyResolve = resolve;
});

/** Mark the async bootstrap complete. Idempotent. */
export function markBrowserTelemetryReady(): void {
  if (_readyResolve) {
    const r = _readyResolve;
    _readyResolve = null;
    r();
  }
  if (typeof window !== "undefined") {
    try {
      Object.defineProperty(window, "__kickstartTelemetryReady", {
        value: ready,
        configurable: true,
        writable: true,
      });
      // Always expose a flush hook — a no-op resolving promise when init
      // did not succeed. Tests (and any production caller) can call it
      // unconditionally without having to branch on init success. The real
      // `provider.forceFlush` overwrites this from inside
      // `initBrowserTelemetry` once the provider is up.
      //
      // Why this matters (Leela round 2): previously the E2E barrier
      // AND-ed on `__kickstartTelemetryReady && __kickstartFlushTelemetry`.
      // When the Azure Monitor exporter constructor throws (silent init
      // failure on a fake connection string in CI), the ready signal
      // still fires but the flush hook is never defined — every scenario
      // timed out on the barrier. Separating the two signals keeps
      // barrier = "bootstrap attempted" and flush = "spans are flowing",
      // and guarantees the former is always available.
      const w = window as Window & { __kickstartFlushTelemetry?: () => Promise<void> };
      if (typeof w.__kickstartFlushTelemetry !== "function") {
        Object.defineProperty(window, "__kickstartFlushTelemetry", {
          value: () => Promise.resolve(),
          configurable: true,
          writable: true,
        });
      }
    } catch {
      // Ignore — harmless if window is frozen.
    }
  }
}

export function getBrowserTelemetryReady(): Promise<void> {
  return ready;
}

/**
 * Initialize the browser tracer provider + fetch instrumentation. Safe to
 * call more than once — subsequent calls are no-ops until the active handle
 * is explicitly `shutdown()`.
 */
export function initBrowserTelemetry(
  config?: BrowserTelemetryConfig,
): ActiveBrowserTelemetry | null {
  if (active) return active;
  if (!resolveFlagEnabled(config)) return null;

  const connectionString = config?.connectionString || resolveConnectionString();
  if (!connectionString) return null;

  try {
    const samplingRatio =
      typeof config?.samplingRatio === "number" ? config.samplingRatio : DEFAULT_SAMPLING_RATIO;

    const exporter = new BrowserRedactingSpanExporter(
      new AzureMonitorTraceExporter({ connectionString }),
    );

    const provider = new WebTracerProvider({
      sampler: new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(samplingRatio) }),
      spanProcessors: [new BatchSpanProcessor(exporter)],
    });

    provider.register({
      contextManager: new ZoneContextManager(),
      // Explicit W3C-only propagator — `tracestate` is not propagated
      // outbound on the browser leg (Zapp Decision 3 / DP §proposal).
      propagator: new W3CTraceContextPropagator(),
    });

    registerInstrumentations({
      instrumentations: [
        new FetchInstrumentation({
          // Scope outgoing propagation + instrumentation to /api/* only.
          // `ignoreUrls` negates anything NOT under /api/; the positive
          // allow-list on `propagateTraceHeaderCorsUrls` is defense-in-depth.
          ignoreUrls: [/^(?!.*\/api\/).*/],
          propagateTraceHeaderCorsUrls: [/\/api\//],
        }),
      ],
    });

    // Flush open spans on SPA navigation / tab hide so we don't leak them
    // across route changes. The BatchSpanProcessor otherwise buffers until
    // its timer fires, which can outlive the page.
    const flushOnHide = () => {
      void provider.forceFlush().catch(() => undefined);
    };
    if (typeof window !== "undefined") {
      window.addEventListener("pagehide", flushOnHide);
      window.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "hidden") flushOnHide();
      });
    }

    active = {
      shutdown: async () => {
        try {
          await provider.shutdown();
        } finally {
          active = null;
          trace.disable();
          context.disable();
        }
      },
      forceFlush: () => provider.forceFlush(),
    };

    // Test / kill-switch hook: exposes a forceFlush that Playwright (or the
    // SPA-nav poller) can call to drain the batch before assertions run.
    // `Object.defineProperty` is used with `configurable: true` so the
    // shutdown path below can delete it.
    if (typeof window !== "undefined") {
      try {
        Object.defineProperty(window, "__kickstartFlushTelemetry", {
          value: () => provider.forceFlush(),
          configurable: true,
          writable: true,
        });
      } catch {
        // Ignore — harmless if window is frozen.
      }
    }

    return active;
  } catch {
    // Never break app boot because telemetry failed to initialize.
    return null;
  }
}

/** Expose the active handle (mostly for tests + SPA-nav kill-switch poller). */
export function getActiveBrowserTelemetry(): ActiveBrowserTelemetry | null {
  return active;
}

/** Test-only: reset internal state. */
export function __resetBrowserTelemetryForTests(): void {
  active = null;
}
