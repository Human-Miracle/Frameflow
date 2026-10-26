import type { ErrorCode } from '@/domain/errors';

export type Severity = 'debug' | 'info' | 'warn' | 'error';

export interface LogEvent {
  operation: string;
  outcome: 'started' | 'succeeded' | 'failed';
  correlationId: string;
  durationMs?: number;
  errorCode?: ErrorCode;
  /** Safe, non-content attributes only: never image bytes, file contents or tokens. */
  attributes?: Record<string, string | number | boolean>;
}

export interface LogRecord extends LogEvent {
  timestamp: string;
  severity: Severity;
  environment: string;
}

type Sink = (record: LogRecord) => void;

const consoleSink: Sink = (record) => {
  const line = JSON.stringify(record);
  if (record.severity === 'error') console.error(line);
  else if (record.severity === 'warn') console.warn(line);
  else console.info(line);
};

let sink: Sink = consoleSink;

/** Replace the sink (used by tests); returns a function restoring the previous one. */
export function setLogSink(next: Sink): () => void {
  const previous = sink;
  sink = next;
  return () => {
    sink = previous;
  };
}

export function log(severity: Severity, event: LogEvent): void {
  sink({
    timestamp: new Date().toISOString(),
    severity,
    environment: process.env.NODE_ENV ?? 'development',
    ...event,
  });
}

export function newCorrelationId(): string {
  return globalThis.crypto.randomUUID();
}

/**
 * Times an async operation and logs start, success or categorised failure
 * under one correlation ID.
 */
export async function traced<T>(
  operation: string,
  attributes: LogEvent['attributes'],
  run: (correlationId: string) => Promise<T>,
  errorCodeOf: (error: unknown) => ErrorCode = () => 'INTERNAL_ERROR',
): Promise<T> {
  const correlationId = newCorrelationId();
  const start = performance.now();
  log('info', { operation, outcome: 'started', correlationId, attributes });
  try {
    const value = await run(correlationId);
    log('info', {
      operation,
      outcome: 'succeeded',
      correlationId,
      durationMs: Math.round(performance.now() - start),
      attributes,
    });
    return value;
  } catch (error) {
    log('error', {
      operation,
      outcome: 'failed',
      correlationId,
      durationMs: Math.round(performance.now() - start),
      errorCode: errorCodeOf(error),
      attributes,
    });
    throw error;
  }
}
