import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { readImageHeader } from './image-header';

const fixture = (name: string) =>
  new Uint8Array(readFileSync(new URL(`../../tests/fixtures/${name}`, import.meta.url)));

function riff(chunk: string, data: number[]): Uint8Array {
  const body = [...'WEBP']
    .map((c) => c.charCodeAt(0))
    .concat(
      [...chunk].map((c) => c.charCodeAt(0)),
      [0, 0, 0, 0],
      data,
    );
  return new Uint8Array([
    ...[...'RIFF'].map((c) => c.charCodeAt(0)),
    0,
    0,
    0,
    0,
    ...body,
    ...new Array(16).fill(0),
  ]);
}

describe('readImageHeader', () => {
  it('reads PNG dimensions from IHDR', () => {
    expect(readImageHeader(fixture('light-ui.png'))).toEqual({
      format: 'png',
      width: 1179,
      height: 2556,
      animated: false,
    });
  });

  it('reads JPEG dimensions from the start-of-frame segment', () => {
    expect(readImageHeader(fixture('light-ui.jpg'))).toEqual({
      format: 'jpeg',
      width: 1179,
      height: 2556,
      animated: false,
    });
  });

  it('reads lossy WebP dimensions', () => {
    expect(readImageHeader(fixture('dark-ui.webp'))).toMatchObject({
      format: 'webp',
      width: 1179,
      height: 2556,
    });
  });

  it('reads lossless (VP8L) WebP dimensions', () => {
    // 14-bit width-1 and height-1 packed little-endian after the 0x2f signature: 100 x 200.
    const bits = 99 | (199 << 14);
    const bytes = riff('VP8L', [
      0x2f,
      bits & 255,
      (bits >> 8) & 255,
      (bits >> 16) & 255,
      (bits >>> 24) & 255,
    ]);
    expect(readImageHeader(bytes)).toEqual({ format: 'webp', width: 100, height: 200, animated: false });
  });

  it('reads extended (VP8X) WebP dimensions and the animation flag', () => {
    const bytes = riff('VP8X', [0x02, 0, 0, 0, 0xff, 0x03, 0x00, 0x7f, 0x07, 0x00]);
    expect(readImageHeader(bytes)).toEqual({ format: 'webp', width: 1024, height: 1920, animated: true });
  });

  it('ignores the file name: a text file named .png is unrecognised', () => {
    expect(readImageHeader(fixture('not-an-image.png'))).toBe('unrecognised');
  });

  it('reports truncated files', () => {
    expect(readImageHeader(fixture('light-ui.png').subarray(0, 20))).toBe('truncated');
    expect(readImageHeader(new Uint8Array([0x89, 0x50]))).toBe('truncated');
  });

  it('rejects other formats such as GIF', () => {
    expect(readImageHeader(new TextEncoder().encode('GIF89a\x01\x00\x01\x00\x00\x00\x00'))).toBe(
      'unrecognised',
    );
  });
});
