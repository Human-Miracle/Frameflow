import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createScene } from '@/scene/templates';
import { EXPORT_SIZES, exportReadiness, exportSizeIsSupported, previewSize, verifyPngOutput } from './output';

const png = new Uint8Array(readFileSync(new URL('../../tests/fixtures/quadrants.png', import.meta.url)));

describe('export output', () => {
  it('accepts a PNG with exactly the requested size', () => {
    expect(verifyPngOutput(png, { width: 1179, height: 2556 }).ok).toBe(true);
  });

  it('rejects wrong dimensions or a non-PNG file', () => {
    const wrongSize = verifyPngOutput(png, { width: 1920, height: 1080 });
    expect(wrongSize.ok || wrongSize.error.code).toBe('OUTPUT_VALIDATION_FAILED');
    const notPng = verifyPngOutput(new TextEncoder().encode('nope nope nope'), { width: 1, height: 1 });
    expect(notPng.ok || notPng.error.code).toBe('OUTPUT_VALIDATION_FAILED');
  });

  it('only offers export sizes within limits', () => {
    for (const size of EXPORT_SIZES) expect(exportSizeIsSupported(size.width, size.height)).toBe(true);
    expect(exportSizeIsSupported(9000, 1000)).toBe(false);
    expect(exportSizeIsSupported(1920.5, 1080)).toBe(false);
  });

  it('blocks export until every visible device has a screenshot', () => {
    const empty = createScene({ id: 's', templateId: 'trio-stack' });
    const result = exportReadiness(empty);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/Left phone, Right phone, Front phone/);
    const hidden = { ...empty, layers: empty.layers.map((l) => ({ ...l, visible: false })) };
    expect(exportReadiness(hidden).ok).toBe(true);
    expect(
      exportReadiness(createScene({ id: 's', templateId: 'trio-stack', screenAssetIds: ['a'] })).ok,
    ).toBe(true);
  });

  it('sizes the preview to the scene aspect ratio and caps its pixel count', () => {
    const size = previewSize({ width: 3840, height: 2160 }, { width: 1000, height: 1000 }, 2);
    expect(size.cssWidth).toBe(1000);
    expect(size.cssHeight).toBe(562);
    expect(size.width).toBe(2000);
    const capped = previewSize({ width: 3840, height: 2160 }, { width: 3000, height: 3000 }, 3, 4_000_000);
    expect(capped.width * capped.height).toBeLessThanOrEqual(4_000_000 * 1.01);
    expect(capped.width / capped.height).toBeCloseTo(3840 / 2160, 2);
  });
});
