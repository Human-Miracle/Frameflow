import { afterEach, describe, expect, it } from 'vitest';
import { FrameflowError } from '@/domain/errors';
import { setLogSink, traced, type LogRecord } from './logger';

let restore = () => {};
afterEach(() => restore());

describe('traced', () => {
  it('logs start and success under one correlation ID with a duration', async () => {
    const records: LogRecord[] = [];
    restore = setLogSink((r) => records.push(r));
    await expect(traced('op', { width: 10 }, async () => 'done')).resolves.toBe('done');
    expect(records.map((r) => r.outcome)).toEqual(['started', 'succeeded']);
    expect(records[0]!.correlationId).toBe(records[1]!.correlationId);
    expect(records[1]!.durationMs).toBeGreaterThanOrEqual(0);
    expect(records[1]).toMatchObject({ operation: 'op', severity: 'info', attributes: { width: 10 } });
  });

  it('logs failures with a categorised error code and rethrows', async () => {
    const records: LogRecord[] = [];
    restore = setLogSink((r) => records.push(r));
    const error = new FrameflowError('RENDER_TIMEOUT', 'slow');
    await expect(
      traced(
        'op',
        {},
        async () => {
          throw error;
        },
        (e) => (e as FrameflowError).code,
      ),
    ).rejects.toBe(error);
    expect(records[1]).toMatchObject({ outcome: 'failed', severity: 'error', errorCode: 'RENDER_TIMEOUT' });
  });
});
