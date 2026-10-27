import { describe, expect, it } from 'vitest';
import { createScene } from '@/scene/templates';
import { applyHomography } from './homography';
import { placement } from './library';
import type { LibraryAsset } from './library-schema';

const meta = { deviceBounds: { x: 100, y: 200, width: 400, height: 1000 } } as LibraryAsset;

describe('library placement', () => {
  const layer = createScene({ id: 's', templateId: 'single-hero' }).layers[0]!;

  it('centres the device bounds on the layer position and scales them to the layer height', () => {
    const m = placement(layer, meta, { width: 1920, height: 1080 });
    const centre = applyHomography(m, { x: 300, y: 700 });
    expect(centre.x).toBeCloseTo(0.5 * 1920);
    expect(centre.y).toBeCloseTo(0.5 * 1080);
    const top = applyHomography(m, { x: 300, y: 200 });
    const bottom = applyHomography(m, { x: 300, y: 1200 });
    expect(bottom.y - top.y).toBeCloseTo(layer.transform.height * 1080);
  });

  it('applies the layer rotation clockwise about the device centre', () => {
    const rotated = { ...layer, transform: { ...layer.transform, rotation: 90 } };
    const m = placement(rotated, meta, { width: 1000, height: 1000 });
    const top = applyHomography(m, { x: 300, y: 200 });
    // The device top swings to the right of centre when rotated 90 degrees clockwise.
    expect(top.x).toBeGreaterThan(500);
    expect(top.y).toBeCloseTo(500);
  });
});
