/**
 * @module @kickstart/core/telemetry
 *
 * Lightweight structured logger with in-memory ring buffer.
 * Writes to console and keeps the last 100 entries for debugging.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  kind: 'log';
  level: LogLevel;
  message: string;
  data?: unknown;
  timestamp: number;
}

export interface TrackEntry {
  kind: 'track';
  event: string;
  properties?: Record<string, unknown>;
  timestamp: number;
}

export type LogRecord = LogEntry | TrackEntry;

// ---------------------------------------------------------------------------
// Logger
// ---------------------------------------------------------------------------

const RING_BUFFER_SIZE = 100;

export class Logger {
  private readonly buffer: LogRecord[] = [];

  private push(record: LogRecord): void {
    this.buffer.push(record);
    if (this.buffer.length > RING_BUFFER_SIZE) {
      this.buffer.shift();
    }
  }

  info(message: string, data?: unknown): void {
    this.push({ kind: 'log', level: 'info', message, data, timestamp: Date.now() });
    if (data !== undefined) {
      console.info(`[Kickstart] ${message}`, data);
    } else {
      console.info(`[Kickstart] ${message}`);
    }
  }

  warn(message: string, data?: unknown): void {
    this.push({ kind: 'log', level: 'warn', message, data, timestamp: Date.now() });
    if (data !== undefined) {
      console.warn(`[Kickstart] ${message}`, data);
    } else {
      console.warn(`[Kickstart] ${message}`);
    }
  }

  error(message: string, data?: unknown): void {
    this.push({ kind: 'log', level: 'error', message, data, timestamp: Date.now() });
    if (data !== undefined) {
      console.error(`[Kickstart] ${message}`, data);
    } else {
      console.error(`[Kickstart] ${message}`);
    }
  }

  track(event: string, properties?: Record<string, unknown>): void {
    this.push({ kind: 'track', event, properties, timestamp: Date.now() });
    if (properties !== undefined) {
      console.info(`[Kickstart:track] ${event}`, properties);
    } else {
      console.info(`[Kickstart:track] ${event}`);
    }
  }

  getLogEntries(): readonly LogRecord[] {
    return this.buffer;
  }

  clearEntries(): void {
    this.buffer.length = 0;
  }
}

// ---------------------------------------------------------------------------
// Singleton + convenience export
// ---------------------------------------------------------------------------

export const logger = new Logger();

/** Returns all buffered log entries (last 100). Useful for debugging. */
export function getLogEntries(): readonly LogRecord[] {
  return logger.getLogEntries();
}
