/**
 * Resource bounds for the browser-only rendering slice. Uploads are checked
 * against these before decoding to defend against decompression bombs.
 */
export const UPLOAD_LIMITS = {
  maxBytes: 25 * 1024 * 1024,
  minSide: 64,
  maxSide: 10_000,
  maxPixels: 50_000_000,
} as const;

/**
 * Chromium refuses canvases above roughly 268M pixels and is unreliable well
 * before that on low-memory machines, so exports stay far below it.
 */
export const EXPORT_LIMITS = {
  minSide: 256,
  maxSide: 8_192,
  maxPixels: 40_000_000,
} as const;

/** Maximum number of screenshots held in memory at once in a session. */
export const MAX_SESSION_SCREENS = 12;
