import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { UPLOAD_LIMITS } from '@/domain/limits';
import { decodedSizeMatches, validateUploadBytes } from './validate';

const fixture = (name: string) =>
  new Uint8Array(readFileSync(new URL(`../../tests/fixtures/${name}`, import.meta.url)));

describe('validateUploadBytes', () => {
  it.each(['light-ui.png', 'light-ui.jpg', 'dark-ui.webp'])('accepts %s', (name) => {
    const result = validateUploadBytes(fixture(name));
    expect(result.ok).toBe(true);
  });

  it('rejects empty files', () => {
    const result = validateUploadBytes(new Uint8Array());
    expect(result.ok || result.error.code).toBe('INVALID_FILE');
  });

  it('rejects files over the byte limit before parsing', () => {
    const result = validateUploadBytes(fixture('light-ui.png'), { ...UPLOAD_LIMITS, maxBytes: 1000 });
    expect(result.ok || result.error.code).toBe('FILE_TOO_LARGE');
  });

  it('rejects non-images with an actionable message', () => {
    const result = validateUploadBytes(fixture('not-an-image.png'));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_FILE');
      expect(result.error.message).toMatch(/PNG, JPEG or WebP/);
    }
  });

  it('rejects images below the minimum size', () => {
    const result = validateUploadBytes(fixture('too-small.png'));
    expect(result.ok || result.error.code).toBe('INVALID_FILE');
  });

  it('rejects oversized dimensions from the header alone (decompression bomb guard)', () => {
    const result = validateUploadBytes(fixture('light-ui.png'), { ...UPLOAD_LIMITS, maxPixels: 1_000_000 });
    expect(result.ok || result.error.code).toBe('FILE_TOO_LARGE');
  });

  it('rejects truncated images', () => {
    const result = validateUploadBytes(fixture('light-ui.png').subarray(0, 24));
    expect(result.ok || result.error.code).toBe('IMAGE_DECODE_FAILED');
  });
});

describe('decodedSizeMatches', () => {
  const png = { format: 'png', width: 100, height: 200, animated: false } as const;
  const jpeg = { ...png, format: 'jpeg' } as const;

  it('requires decoded size to equal the header size', () => {
    expect(decodedSizeMatches(png, { width: 100, height: 200 })).toBe(true);
    expect(decodedSizeMatches(png, { width: 200, height: 100 })).toBe(false);
  });

  it('allows EXIF-rotated JPEGs to swap width and height', () => {
    expect(decodedSizeMatches(jpeg, { width: 200, height: 100 })).toBe(true);
  });
});
