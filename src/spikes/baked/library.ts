import { FRAMEFLOW_PHONE_V2 } from '@/devices/frameflow-phone-v2';
import { paintOrder, type Size } from '@/mockup-engine/geometry';
import { paintBackground, type ScreenLookup } from '@/mockup-engine/render';
import type { DeviceLayer, Scene } from '@/scene/schema';
import { composeScreen } from '../device-3d/screen-texture';
import { buildPyramid, compositeScreen, scaleShadow, type RgbaImage } from './composite';
import { applyHomography, type Mat3, type Point } from './homography';
import { libraryAssetSchema, passedAllGates, type LibraryAsset } from './library-schema';

export const LIBRARY_BASE = '/lab-assets/frameflow-phone-v2';

export interface LibraryView {
  meta: LibraryAsset;
  beauty: ImageBitmap;
  mask: ImageBitmap;
  matte: ImageBitmap;
}

/** Restrained default: the studio render's contact shadow at 70 %. */
export const DEFAULT_SHADOW_STRENGTH = 0.7;

/**
 * How the screenshot reaches the output.
 * direct: device and mask are scaled to their final placement first, then the
 *         screenshot is warped once at output resolution from the full-size source,
 *         with 2x2 area sampling per output pixel when minifying.
 * two-step: the screenshot is warped at asset resolution and the result rescaled
 *         (the ADR 0011 spike); kept to measure the difference.
 * direct-trilinear: direct with plain trilinear filtering (kept for measurement; blurrier).
 * reference: like direct, with 8x8 supersampling of the full-resolution source;
 *         an expensive near-ideal result used only to measure the others.
 */
export type CompositeMode = 'direct' | 'direct-trilinear' | 'two-step' | 'reference';

const SAMPLING: Record<CompositeMode, { samples: number; fixedLevel?: number }> = {
  // 2x2 area sampling measured closest to the 8x8 reference on real UI (ADR 0012).
  direct: { samples: 2 },
  'direct-trilinear': { samples: 1 },
  'two-step': { samples: 1 },
  // Ground truth for measurements: 8x8 bilinear samples from the full-resolution source. Slow.
  reference: { samples: 8, fixedLevel: 0 },
};

const cache = new Map<string, Promise<LibraryView>>();

/** Loads a view once per session and refuses any whose quality gates did not all pass. */
export function loadLibraryView(id: string, base = LIBRARY_BASE): Promise<LibraryView> {
  const key = `${base}/${id}`;
  let view = cache.get(key);
  if (!view) {
    view = (async () => {
      const meta = libraryAssetSchema.parse(await (await fetch(`${key}/asset.json`)).json());
      if (!passedAllGates(meta)) throw new Error(`View ${id} did not pass the asset quality gate`);
      if (meta.deviceAssetVersion !== FRAMEFLOW_PHONE_V2.version)
        throw new Error(`View ${id} was rendered for another device version`);
      const load = async (file: string) =>
        createImageBitmap(await (await fetch(`${key}/${file}`)).blob(), {
          colorSpaceConversion: 'none',
          premultiplyAlpha: 'none',
        });
      const [beauty, mask, matte] = await Promise.all([
        load(meta.image.beauty),
        load(meta.image.mask),
        load(meta.image.matte),
      ]);
      for (const image of [beauty, mask, matte]) {
        if (image.width !== meta.image.width || image.height !== meta.image.height) {
          throw new Error(`View ${id}: image sizes do not match asset.json`);
        }
      }
      return { meta, beauty, mask, matte };
    })();
    cache.set(key, view);
    view.catch(() => cache.delete(key));
  }
  return view;
}

/** Maps asset pixels to output pixels: device bounds centred on the layer position, scaled to its height. */
export function placement(layer: DeviceLayer, meta: LibraryAsset, size: Size): Mat3 {
  const b = meta.deviceBounds;
  const s = (layer.transform.height * size.height) / b.height;
  const r = (layer.transform.rotation * Math.PI) / 180;
  const cos = Math.cos(r) * s;
  const sin = Math.sin(r) * s;
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  const tx = layer.transform.x * size.width;
  const ty = layer.transform.y * size.height;
  return [cos, -sin, tx - cos * cx + sin * cy, sin, cos, ty - sin * cx - cos * cy, 0, 0, 1];
}

function pixels(source: CanvasImageSource, width: number, height: number): RgbaImage {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(source, 0, 0);
  return { width, height, data: ctx.getImageData(0, 0, width, height).data };
}

function screenPyramid(layer: DeviceLayer, screens: ScreenLookup): RgbaImage[] {
  const image = layer.screen.assetId ? screens(layer.screen.assetId) : undefined;
  if (layer.screen.assetId && !image) throw new Error(`Missing screenshot for ${layer.name}`);
  const canvas = composeScreen(FRAMEFLOW_PHONE_V2, layer.screen, image, { clipToAperture: false });
  return buildPyramid(pixels(canvas, canvas.width, canvas.height));
}

function drawPlaced(
  ctx: OffscreenCanvasRenderingContext2D,
  image: CanvasImageSource,
  m: Mat3,
  offset: Point = { x: 0, y: 0 },
) {
  ctx.save();
  ctx.setTransform(m[0], m[3], m[1], m[4], m[2] - offset.x, m[5] - offset.y);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, 0, 0);
  ctx.restore();
}

/**
 * Renders a scene where every visible device uses a pre-rendered library view.
 * Devices are composited in paint order, so later devices cover earlier ones,
 * screens included. With glare at 0, screenshot pixels are only resampled,
 * never relit.
 */
export function renderLibraryScene(
  scene: Scene,
  size: Size,
  screens: ScreenLookup,
  views: ReadonlyMap<string, LibraryView>,
  options: { mode?: CompositeMode; glare?: number; shadowStrength?: number } = {},
): OffscreenCanvas {
  const mode = options.mode ?? 'direct';
  const glare = options.glare ?? 0;
  const shadowStrength = options.shadowStrength ?? DEFAULT_SHADOW_STRENGTH;
  const output = new OffscreenCanvas(size.width, size.height);
  const ctx = output.getContext('2d')!;
  paintBackground(ctx, scene.background, size);

  for (const layer of paintOrder(scene)) {
    const view = views.get(layer.id);
    if (!view) throw new Error(`No library view chosen for ${layer.name}`);
    const { meta } = view;
    const m = placement(layer, meta, size);
    const pyramid = screenPyramid(layer, screens);
    const corners = meta.screenCorners.map(([x, y]) => ({ x, y }));
    const beautyPixels = scaleShadow(
      pixels(view.beauty, meta.image.width, meta.image.height),
      maskChannel(pixels(view.matte, meta.image.width, meta.image.height)),
      shadowStrength,
    );
    const beauty = new OffscreenCanvas(meta.image.width, meta.image.height);
    beauty
      .getContext('2d')!
      .putImageData(new ImageData(beautyPixels.data, beauty.width, beauty.height), 0, 0);

    if (mode === 'two-step') {
      const composited = compositeScreen(
        {
          beauty: beautyPixels,
          mask: maskChannel(pixels(view.mask, meta.image.width, meta.image.height)),
          corners: corners as [Point, Point, Point, Point],
        },
        pyramid,
        glare,
        SAMPLING['two-step'],
      );
      const device = new OffscreenCanvas(composited.width, composited.height);
      device
        .getContext('2d')!
        .putImageData(new ImageData(composited.data, composited.width, composited.height), 0, 0);
      drawPlaced(ctx, device, m);
      continue;
    }

    drawPlaced(ctx, beauty, m);
    // Work only inside the placed screen's bounding box.
    const placed = corners.map((c) => applyHomography(m, c));
    const x0 = Math.max(0, Math.floor(Math.min(...placed.map((p) => p.x))) - 2);
    const y0 = Math.max(0, Math.floor(Math.min(...placed.map((p) => p.y))) - 2);
    const x1 = Math.min(size.width, Math.ceil(Math.max(...placed.map((p) => p.x))) + 2);
    const y1 = Math.min(size.height, Math.ceil(Math.max(...placed.map((p) => p.y))) + 2);
    if (x1 <= x0 || y1 <= y0) continue;
    const region = { width: x1 - x0, height: y1 - y0 };
    const maskCanvas = new OffscreenCanvas(region.width, region.height);
    drawPlaced(maskCanvas.getContext('2d')!, view.mask, m, { x: x0, y: y0 });
    const target: RgbaImage = { ...region, data: ctx.getImageData(x0, y0, region.width, region.height).data };
    const composited = compositeScreen(
      {
        beauty: target,
        mask: maskChannel(pixels(maskCanvas, region.width, region.height)),
        corners: placed.map((p) => ({ x: p.x - x0, y: p.y - y0 })) as [Point, Point, Point, Point],
      },
      pyramid,
      glare,
      SAMPLING[mode],
    );
    ctx.putImageData(new ImageData(composited.data, region.width, region.height), x0, y0);
  }
  return output;
}

function maskChannel(image: RgbaImage): Uint8ClampedArray<ArrayBuffer> {
  const mask = new Uint8ClampedArray(image.width * image.height);
  for (let i = 0; i < mask.length; i += 1) mask[i] = image.data[i * 4]!;
  return mask;
}
