import type { DeviceAsset, RoundedRect } from '@/devices/types';
import type { DeviceRegistry } from '@/devices/registry';
import type { DeviceLayer, Scene, ScreenAssignment } from '@/scene/schema';

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Where a device sits on a canvas of a given pixel size. */
export interface DevicePlacement {
  /** Body centre in canvas pixels. */
  center: Point;
  /** Canvas pixels per device unit. */
  scale: number;
  /** Clockwise rotation in radians. */
  rotation: number;
  /** Body height in canvas pixels; shadow sizes are relative to this. */
  heightPx: number;
}

export function placeDevice(layer: DeviceLayer, asset: DeviceAsset, size: Size): DevicePlacement {
  const heightPx = layer.transform.height * size.height;
  return {
    center: { x: layer.transform.x * size.width, y: layer.transform.y * size.height },
    scale: heightPx / asset.body.height,
    rotation: (layer.transform.rotation * Math.PI) / 180,
    heightPx,
  };
}

/** Converts a point in device units (relative to the body's top-left) to canvas pixels. */
export function deviceToCanvas(point: Point, asset: DeviceAsset, placement: DevicePlacement): Point {
  const lx = (point.x - asset.body.width / 2) * placement.scale;
  const ly = (point.y - asset.body.height / 2) * placement.scale;
  const cos = Math.cos(placement.rotation);
  const sin = Math.sin(placement.rotation);
  return { x: placement.center.x + lx * cos - ly * sin, y: placement.center.y + lx * sin + ly * cos };
}

/** Inverse of deviceToCanvas. */
export function canvasToDevice(point: Point, asset: DeviceAsset, placement: DevicePlacement): Point {
  const dx = point.x - placement.center.x;
  const dy = point.y - placement.center.y;
  const cos = Math.cos(-placement.rotation);
  const sin = Math.sin(-placement.rotation);
  return {
    x: (dx * cos - dy * sin) / placement.scale + asset.body.width / 2,
    y: (dx * sin + dy * cos) / placement.scale + asset.body.height / 2,
  };
}

/** The screen aperture's corners in canvas pixels: top-left, top-right, bottom-right, bottom-left. */
export function screenApertureCorners(
  layer: DeviceLayer,
  asset: DeviceAsset,
  size: Size,
): [Point, Point, Point, Point] {
  const placement = placeDevice(layer, asset, size);
  const { x, y, width, height } = asset.screen;
  return [
    deviceToCanvas({ x, y }, asset, placement),
    deviceToCanvas({ x: x + width, y }, asset, placement),
    deviceToCanvas({ x: x + width, y: y + height }, asset, placement),
    deviceToCanvas({ x, y: y + height }, asset, placement),
  ];
}

export interface ScreenFit {
  /** Region of the source image that is drawn, in source pixels. */
  source: Rect;
  /** Where it lands, relative to the aperture's top-left, in device units. */
  dest: Rect;
  /** Share of the source image's area that is cropped away (0 for contain). */
  cropFraction: number;
}

/**
 * Maps a screenshot into an aperture without distortion. `cover` fills the
 * aperture and crops the overflow; `contain` shows the whole image with bars.
 * The aspect ratio of the source is always preserved.
 */
export function fitScreen(
  source: Size,
  aperture: Size,
  fit: ScreenAssignment['fit'],
  anchor: ScreenAssignment['anchor'],
): ScreenFit {
  if (fit === 'cover') {
    const scale = Math.max(aperture.width / source.width, aperture.height / source.height);
    const width = aperture.width / scale;
    const height = aperture.height / scale;
    const x = (source.width - width) / 2;
    const y = anchor === 'top' ? 0 : (source.height - height) / 2;
    return {
      source: { x, y, width, height },
      dest: { x: 0, y: 0, width: aperture.width, height: aperture.height },
      cropFraction: 1 - (width * height) / (source.width * source.height),
    };
  }
  const scale = Math.min(aperture.width / source.width, aperture.height / source.height);
  const width = source.width * scale;
  const height = source.height * scale;
  return {
    source: { x: 0, y: 0, width: source.width, height: source.height },
    dest: {
      x: (aperture.width - width) / 2,
      y: anchor === 'top' ? 0 : (aperture.height - height) / 2,
      width,
      height,
    },
    cropFraction: 0,
  };
}

/** Point-in-rounded-rect test using circular corners; adequate for selection. */
export function roundedRectContains(rect: RoundedRect, point: Point): boolean {
  const { x, y, width, height } = rect;
  if (point.x < x || point.y < y || point.x > x + width || point.y > y + height) return false;
  const r = Math.min(rect.cornerRadius, width / 2, height / 2);
  const cx = Math.min(Math.max(point.x, x + r), x + width - r);
  const cy = Math.min(Math.max(point.y, y + r), y + height - r);
  return (point.x - cx) ** 2 + (point.y - cy) ** 2 <= r * r;
}

/** Visible layers in paint order, bottom first. */
export function paintOrder(scene: Scene): DeviceLayer[] {
  return scene.layers.filter((layer) => layer.visible);
}

/** The top-most visible device under a canvas point, or null. */
export function hitTest(scene: Scene, registry: DeviceRegistry, size: Size, point: Point): string | null {
  const layers = paintOrder(scene);
  for (let index = layers.length - 1; index >= 0; index -= 1) {
    const layer = layers[index];
    if (!layer) continue;
    const asset = registry.get(layer.deviceAssetId);
    if (!asset) continue;
    const local = canvasToDevice(point, asset, placeDevice(layer, asset, size));
    if (roundedRectContains(asset.body, local)) return layer.id;
  }
  return null;
}
