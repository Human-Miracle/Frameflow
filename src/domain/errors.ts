/**
 * Stable error codes from the Testing & Observability Blueprint, section 6.
 * Codes are for logs and tests; `message` is the human guidance shown in the UI.
 */
export const ERROR_CODES = [
  'INVALID_FILE',
  'FILE_TOO_LARGE',
  'IMAGE_DECODE_FAILED',
  'UNSUPPORTED_ASSET_TRANSFORM',
  'SCENE_VALIDATION_FAILED',
  'RENDER_TIMEOUT',
  'RENDER_OUT_OF_MEMORY',
  'PROTOTYPE_UNSUPPORTED',
  'CAPTURE_PERMISSION_DENIED',
  'CAPTURE_TIMEOUT',
  'VIDEO_ENCODING_FAILED',
  'OUTPUT_VALIDATION_FAILED',
  'STORAGE_FAILURE',
  'INTERNAL_ERROR',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export class FrameflowError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'FrameflowError';
    this.code = code;
  }
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: FrameflowError };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = <T>(code: ErrorCode, message: string): Result<T> => ({
  ok: false,
  error: new FrameflowError(code, message),
});

export function toFrameflowError(error: unknown): FrameflowError {
  if (error instanceof FrameflowError) return error;
  return new FrameflowError('INTERNAL_ERROR', 'Something went wrong. Try again, and reload if it persists.', {
    cause: error,
  });
}
