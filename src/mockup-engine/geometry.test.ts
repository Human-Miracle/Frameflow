import { describe, expect, it } from 'vitest';
import { FRAMEFLOW_PHONE as phone } from '@/devices/frameflow-phone';
import { DEVICE_ASSETS } from '@/devices/registry';
import type { DeviceLayer } from '@/scene/schema';
import { createScene } from '@/scene/templates';
import {
  canvasToDevice,
  deviceToCanvas,
  fitScreen,
  hitTest,
  paintOrder,
  placeDevice,
  roundedRectContains,
  screenApertureCorners,
} from './geometry';

const size = { width: 3840, height: 2160 };
const layer = (patch: Partial<DeviceLayer['transform']> = {}): DeviceLayer => ({
  ...createScene({ id: 's', templateId: 'single-hero' }).layers[0]!,
  transform: { x: 0.5, y: 0.5, height: 0.8, rotation: 0, ...patch },
});

describe('device placement', () => {
  it('converts normalised transforms to canvas pixels', () => {
    const placement = placeDevice(layer(), phone, size);
    expect(placement.center).toEqual({ x: 1920, y: 1080 });
    expect(placement.heightPx).toBeCloseTo(1728);
    expect(placement.scale).toBeCloseTo(1728 / phone.body.height);
  });

  it('places the screen aperture exactly inside the body when upright', () => {
    const [tl, tr, br, bl] = screenApertureCorners(layer(), phone, size);
    const scale = 1728 / phone.body.height;
    const left = 1920 - (phone.body.width / 2) * scale + phone.screen.x * scale;
    const top = 1080 - 864 + phone.screen.y * scale;
    expect(tl.x).toBeCloseTo(left);
    expect(tl.y).toBeCloseTo(top);
    expect(tr.x - tl.x).toBeCloseTo(phone.screen.width * scale);
    expect(bl.y - tl.y).toBeCloseTo(phone.screen.height * scale);
    expect(br).toEqual({ x: tr.x, y: bl.y });
  });

  it('rotates the aperture with the device and keeps its size', () => {
    const [tl, tr] = screenApertureCorners(layer({ rotation: 20 }), phone, size);
    const scale = 1728 / phone.body.height;
    expect(Math.hypot(tr.x - tl.x, tr.y - tl.y)).toBeCloseTo(phone.screen.width * scale);
    expect(Math.atan2(tr.y - tl.y, tr.x - tl.x)).toBeCloseTo((20 * Math.PI) / 180);
  });

  it('round-trips between device units and canvas pixels', () => {
    const placement = placeDevice(layer({ rotation: -13, x: 0.3 }), phone, size);
    const point = { x: 123, y: 456 };
    const back = canvasToDevice(deviceToCanvas(point, phone, placement), phone, placement);
    expect(back.x).toBeCloseTo(point.x);
    expect(back.y).toBeCloseTo(point.y);
  });
});

describe('fitScreen', () => {
  const aperture = { width: phone.screen.width, height: phone.screen.height };

  it('maps a native-size screenshot 1:1 with no crop', () => {
    const fit = fitScreen({ width: 1179, height: 2556 }, aperture, 'cover', 'top');
    expect(fit.source).toEqual({ x: 0, y: 0, width: 1179, height: 2556 });
    expect(fit.dest).toEqual({ x: 0, y: 0, width: 1179, height: 2556 });
    expect(fit.cropFraction).toBeCloseTo(0);
  });

  it('scales a smaller screenshot of the same shape without cropping', () => {
    const fit = fitScreen({ width: 393, height: 852 }, aperture, 'cover', 'top');
    expect(fit.cropFraction).toBeCloseTo(0, 2);
  });

  it('cover crops a 16:9 screenshot from the bottom when anchored to the top, never stretching it', () => {
    const fit = fitScreen({ width: 1080, height: 1920 }, aperture, 'cover', 'top');
    expect(fit.source.y).toBe(0);
    expect(fit.source.width / fit.source.height).toBeCloseTo(aperture.width / aperture.height);
    expect(fit.cropFraction).toBeGreaterThan(0.1);
  });

  it('contain shows the whole screenshot and preserves its aspect ratio', () => {
    const fit = fitScreen({ width: 1080, height: 1920 }, aperture, 'contain', 'center');
    expect(fit.source).toEqual({ x: 0, y: 0, width: 1080, height: 1920 });
    expect(fit.dest.width / fit.dest.height).toBeCloseTo(1080 / 1920);
    expect(fit.dest.y).toBeCloseTo((aperture.height - fit.dest.height) / 2);
    expect(fit.cropFraction).toBe(0);
  });
});

describe('layer order and hit testing', () => {
  const scene = createScene({ id: 's', templateId: 'trio-stack' });

  it('paints visible layers bottom first and skips hidden ones', () => {
    expect(paintOrder(scene).map((l) => l.id)).toEqual(['left', 'right', 'center']);
    const hidden = {
      ...scene,
      layers: scene.layers.map((l) => (l.id === 'right' ? { ...l, visible: false } : l)),
    };
    expect(paintOrder(hidden).map((l) => l.id)).toEqual(['left', 'center']);
  });

  it('selects the top-most device where devices overlap', () => {
    expect(hitTest(scene, DEVICE_ASSETS, size, { x: 1920, y: 1080 })).toBe('center');
    // Overlap between the left and front phones resolves to the front phone.
    expect(hitTest(scene, DEVICE_ASSETS, size, { x: 1920 - 380, y: 1100 })).toBe('center');
    // Far left belongs only to the left phone.
    expect(hitTest(scene, DEVICE_ASSETS, size, { x: 0.355 * 3840 - 300, y: 1150 })).toBe('left');
    expect(hitTest(scene, DEVICE_ASSETS, size, { x: 20, y: 20 })).toBeNull();
  });

  it('treats rounded corners as outside the body', () => {
    const r = phone.body;
    expect(roundedRectContains(r, { x: 2, y: 2 })).toBe(false);
    expect(roundedRectContains(r, { x: r.cornerRadius, y: 2 })).toBe(true);
  });
});
