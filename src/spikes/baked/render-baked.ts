import { z } from 'zod';
import { DEVICE_ASSETS } from '@/devices/registry';
import { paintOrder, type Size } from '@/mockup-engine/geometry';
import { paintBackground, type ScreenLookup } from '@/mockup-engine/render';
import type { Scene } from '@/scene/schema';
import { composeScreen } from '../device-3d/screen-texture';
import { buildPyramid, compositeScreen, type BakedView, type RgbaImage } from './composite';

const point = z.tuple([z.number(), z.number()]);
const assetSchema = z.object({
  formatVersion: z.literal(1),
  deviceAssetId: z.string(),
  view: z.object({ id: z.string(), style: z.enum(['minimal', 'cinematic']) }).passthrough(),
  image: z.object({
    width: z.number().int(),
    height: z.number().int(),
    beauty: z.string(),
    mask: z.string(),
  }),
  screenCorners: z.tuple([point, point, point, point]),
  deviceBounds: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }),
  verification: z.object({ passed: z.boolean(), p999ErrorScreenPx: z.number() }),
  license: z.object({ kind: z.string(), terms: z.string() }),
});

export type BakedAssetMeta = z.infer<typeof assetSchema>;
export interface LoadedBakedView extends BakedView {
  meta: BakedAssetMeta;
}

async function pixels(url: string): Promise<RgbaImage> {
  const bitmap = await createImageBitmap(await (await fetch(url)).blob(), {
    colorSpaceConversion: 'none',
    premultiplyAlpha: 'none',
  });
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return {
    width: canvas.width,
    height: canvas.height,
    data: ctx.getImageData(0, 0, canvas.width, canvas.height).data,
  };
}

/**
 * Loads a pre-rendered view and refuses it unless its screen mapping was
 * verified at render time; an unverified view could misplace the screenshot.
 */
export async function loadBakedView(base: string): Promise<LoadedBakedView> {
  const meta = assetSchema.parse(await (await fetch(`${base}/asset.json`)).json());
  if (!meta.verification.passed) throw new Error(`View ${meta.view.id} failed screen-mapping verification`);
  const [beauty, maskImage] = await Promise.all([
    pixels(`${base}/${meta.image.beauty}`),
    pixels(`${base}/${meta.image.mask}`),
  ]);
  if (beauty.width !== meta.image.width || maskImage.width !== meta.image.width)
    throw new Error('Asset image sizes do not match');
  const mask = new Uint8ClampedArray(maskImage.width * maskImage.height);
  for (let i = 0; i < mask.length; i += 1) mask[i] = maskImage.data[i * 4]!;
  const [a, b, c, d] = meta.screenCorners.map(([x, y]) => ({ x, y }));
  return { meta, beauty, mask, corners: [a!, b!, c!, d!] };
}

/**
 * Renders a one-device scene with a pre-rendered view: background from the 2D
 * renderer, device and shadow from the baked beauty pass, screenshot warped
 * in by the verified homography.
 */
export function renderSceneBaked(
  scene: Scene,
  size: Size,
  screens: ScreenLookup,
  view: LoadedBakedView,
  glare = 0,
): OffscreenCanvas {
  const layers = paintOrder(scene);
  if (layers.length !== 1) throw new Error('Pre-rendered views support one device in this spike');
  const layer = layers[0]!;
  const asset = DEVICE_ASSETS.get(layer.deviceAssetId);
  if (!asset || asset.id !== view.meta.deviceAssetId)
    throw new Error('The pre-rendered view is for a different device');

  const image = layer.screen.assetId ? screens(layer.screen.assetId) : undefined;
  const screenCanvas = composeScreen(asset, layer.screen, image, { clipToAperture: false });
  const screenCtx = screenCanvas.getContext('2d')!;
  const screenPixels: RgbaImage = {
    width: screenCanvas.width,
    height: screenCanvas.height,
    data: screenCtx.getImageData(0, 0, screenCanvas.width, screenCanvas.height).data,
  };
  const composited = compositeScreen(view, buildPyramid(screenPixels), glare);
  const device = new OffscreenCanvas(composited.width, composited.height);
  device
    .getContext('2d')!
    .putImageData(new ImageData(composited.data, composited.width, composited.height), 0, 0);

  const output = new OffscreenCanvas(size.width, size.height);
  const ctx = output.getContext('2d')!;
  paintBackground(ctx, scene.background, size);
  const bounds = view.meta.deviceBounds;
  const scale = (layer.transform.height * size.height) / bounds.height;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    device,
    layer.transform.x * size.width - (bounds.x + bounds.width / 2) * scale,
    layer.transform.y * size.height - (bounds.y + bounds.height / 2) * scale,
    device.width * scale,
    device.height * scale,
  );
  return output;
}
