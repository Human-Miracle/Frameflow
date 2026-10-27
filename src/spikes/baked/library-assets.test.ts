import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FRAMEFLOW_PHONE_V2 } from '@/devices/frameflow-phone-v2';
import { readImageHeader } from '@/upload/image-header';
import views from '../../../asset-pipeline/frameflow-phone-v2/views.json';
import { libraryAssetSchema, passedAllGates } from './library-schema';

/**
 * Checks the committed Frameflow Phone v2 angle library against the asset
 * quality gate. Pixel-level checks (homography error, mask vs geometry,
 * framing) ran at render time and are recorded in asset.json; these tests
 * make sure the committed files are the ones that passed.
 */
const root = new URL('../../../public/lab-assets/frameflow-phone-v2/', import.meta.url);
const ids = existsSync(root)
  ? readdirSync(root).filter((name) => statSync(new URL(name, root)).isDirectory())
  : [];
const MIN_LONGEST = 3000;
/** Tallest device in any template, at 4K: views must not need upscaling there. */
const LARGEST_DEVICE_AT_4K = 0.84 * 2160;

function polygonArea(points: [number, number][]): number {
  return (
    points.reduce((sum, [x, y], i) => {
      const [nx, ny] = points[(i + 1) % points.length]!;
      return sum + x * ny - nx * y;
    }, 0) / 2
  );
}

describe('asset library: frameflow-phone-v2', () => {
  it('contains exactly the views listed in views.json', () => {
    expect([...ids].sort()).toEqual(views.map((v) => v.id).sort());
  });

  describe.each(ids)('%s', (id) => {
    const dir = new URL(`${id}/`, root);
    const meta = libraryAssetSchema.parse(JSON.parse(readFileSync(new URL('asset.json', dir), 'utf8')));

    it('passed every quality gate at render time', () => {
      expect(passedAllGates(meta)).toBe(true);
      expect(meta.gates.homography).toMatchObject({ passed: true });
      expect(meta.gates.mask).toMatchObject({ passed: true });
      expect(meta.gates.framing).toMatchObject({ passed: true, deviceInsideUnfeatheredArea: true });
      expect(meta.gates.matte).toMatchObject({ passed: true });
    });

    it('was rendered for this device version and view definition', () => {
      expect(meta.deviceAssetId).toBe(FRAMEFLOW_PHONE_V2.id);
      expect(meta.deviceAssetVersion).toBe(FRAMEFLOW_PHONE_V2.version);
      const definition = views.find((v) => v.id === id)!;
      expect(meta.view).toMatchObject(definition);
    });

    it('has the recorded files, dimensions and sizes', () => {
      const beauty = new Uint8Array(readFileSync(new URL(meta.image.beauty, dir)));
      const mask = new Uint8Array(readFileSync(new URL(meta.image.mask, dir)));
      const matte = new Uint8Array(readFileSync(new URL(meta.image.matte, dir)));
      expect(readImageHeader(matte)).toMatchObject({
        format: 'png',
        width: meta.image.width,
        height: meta.image.height,
      });
      expect(matte.length).toBe(meta.image.matteBytes);
      expect(readImageHeader(beauty)).toMatchObject({
        format: 'webp',
        width: meta.image.width,
        height: meta.image.height,
      });
      expect(readImageHeader(mask)).toMatchObject({
        format: 'png',
        width: meta.image.width,
        height: meta.image.height,
      });
      expect(beauty.length).toBe(meta.image.beautyBytes);
      expect(mask.length).toBe(meta.image.maskBytes);
      expect(Math.max(meta.image.width, meta.image.height)).toBeGreaterThanOrEqual(MIN_LONGEST);
    });

    it('has a valid, clockwise, convex screen quad inside the image', () => {
      const c = meta.screenCorners;
      for (const [x, y] of c) {
        expect(x).toBeGreaterThan(0);
        expect(y).toBeGreaterThan(0);
        expect(x).toBeLessThan(meta.image.width);
        expect(y).toBeLessThan(meta.image.height);
      }
      // y points down, so clockwise on screen has positive signed area.
      expect(polygonArea(c)).toBeGreaterThan(0);
      for (let i = 0; i < 4; i += 1) {
        const [ax, ay] = c[i]!;
        const [bx, by] = c[(i + 1) % 4]!;
        const [cx, cy] = c[(i + 2) % 4]!;
        expect((bx - ax) * (cy - by) - (by - ay) * (cx - bx)).toBeGreaterThan(0);
      }
    });

    it('keeps the device inside the frame and large enough for 4K exports without upscaling', () => {
      const b = meta.deviceBounds;
      expect(b.x).toBeGreaterThan(0);
      expect(b.y).toBeGreaterThan(0);
      expect(b.x + b.width).toBeLessThan(meta.image.width);
      expect(b.y + b.height).toBeLessThan(meta.image.height);
      expect(b.height).toBeGreaterThanOrEqual(LARGEST_DEVICE_AT_4K);
    });

    it('is original work with recorded provenance', () => {
      expect(meta.license.kind).toBe('original');
      expect(meta.provenance.thirdPartyAssets).toEqual([]);
    });
  });
});
