import { FrameflowError } from '@/domain/errors';
import { DEVICE_ASSETS, type DeviceRegistry } from '@/devices/registry';
import type { DeviceAsset, DeviceFinish } from '@/devices/types';
import type { Background, DeviceLayer, Lighting, Scene } from '@/scene/schema';
import { fitScreen, paintOrder, placeDevice, type Size } from './geometry';
import { smoothRoundedRect } from './paths';

export type Canvas2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export interface ScreenImage {
  source: CanvasImageSource;
  width: number;
  height: number;
}

export type ScreenLookup = (assetId: string) => ScreenImage | undefined;

const EMPTY_SCREEN = '#141518';
const BEZEL = '#040405';

const FINISHES: Record<DeviceFinish, { stops: readonly [number, string][]; button: string; edge: string }> = {
  graphite: {
    stops: [
      [0, '#5E6065'],
      [0.18, '#2C2D31'],
      [0.5, '#1E1F22'],
      [0.82, '#2A2B2F'],
      [1, '#141517'],
    ],
    button: '#2A2B2F',
    edge: '#0A0A0B',
  },
  silver: {
    stops: [
      [0, '#F4F5F6'],
      [0.2, '#CDD0D4'],
      [0.5, '#B7BABF'],
      [0.8, '#C9CCD0'],
      [1, '#9DA0A5'],
    ],
    button: '#BFC2C6',
    edge: '#8B8E93',
  },
};

export function rgba(hex: string, alpha: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `rgba(${(value >> 16) & 255}, ${(value >> 8) & 255}, ${value & 255}, ${alpha})`;
}

function paintBackground(ctx: Canvas2D, background: Background, size: Size): void {
  const { fill } = background;
  const { width, height } = size;
  if (fill.kind === 'solid') {
    ctx.fillStyle = fill.color;
    ctx.fillRect(0, 0, width, height);
  } else if (fill.kind === 'linear') {
    const angle = (fill.angle * Math.PI) / 180;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const half = (Math.abs(width * dx) + Math.abs(height * dy)) / 2;
    const gradient = ctx.createLinearGradient(
      width / 2 - dx * half,
      height / 2 - dy * half,
      width / 2 + dx * half,
      height / 2 + dy * half,
    );
    for (const stop of fill.stops) gradient.addColorStop(stop.offset, stop.color);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  } else if (fill.kind === 'radial') {
    const cx = fill.cx * width;
    const cy = fill.cy * height;
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, fill.radius * Math.hypot(width, height));
    for (const stop of fill.stops) gradient.addColorStop(stop.offset, stop.color);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }

  for (const glow of background.glows) {
    const cx = glow.cx * width;
    const cy = glow.cy * height;
    const radius = glow.radius * Math.hypot(width, height);
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, rgba(glow.color, glow.opacity));
    gradient.addColorStop(0.55, rgba(glow.color, glow.opacity * 0.35));
    gradient.addColorStop(1, rgba(glow.color, 0));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
}

function bodyPath(ctx: Canvas2D, asset: DeviceAsset, inset = 0): void {
  ctx.beginPath();
  smoothRoundedRect(ctx, asset.body, asset.cornerSmoothing, inset);
}

function paintShadows(
  ctx: Canvas2D,
  asset: DeviceAsset,
  lighting: Lighting,
  heightPx: number,
  finish: DeviceFinish,
): void {
  // Shadow offsets and blur are applied in canvas space, unaffected by the
  // device's rotation, so every device shares one light direction.
  const { shadow, contactShadow } = lighting;
  ctx.fillStyle = FINISHES[finish].edge;
  if (shadow.opacity > 0) {
    ctx.shadowColor = rgba(shadow.color, shadow.opacity);
    ctx.shadowBlur = shadow.blur * heightPx;
    ctx.shadowOffsetX = shadow.offsetX * heightPx;
    ctx.shadowOffsetY = shadow.offsetY * heightPx;
    bodyPath(ctx, asset);
    ctx.fill();
  }
  if (contactShadow.opacity > 0) {
    ctx.shadowColor = rgba('#000000', contactShadow.opacity);
    ctx.shadowBlur = contactShadow.blur * heightPx;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = contactShadow.offsetY * heightPx;
    bodyPath(ctx, asset);
    ctx.fill();
  }
  ctx.shadowColor = 'rgba(0, 0, 0, 0)';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
}

function paintButtons(ctx: Canvas2D, asset: DeviceAsset, finish: DeviceFinish): void {
  ctx.fillStyle = FINISHES[finish].button;
  for (const button of asset.buttons) {
    const x = button.side === 'left' ? asset.body.x - button.depth : asset.body.x + asset.body.width - 12;
    ctx.beginPath();
    smoothRoundedRect(
      ctx,
      { x, y: button.y, width: button.depth + 12, height: button.length, cornerRadius: button.depth },
      0,
    );
    ctx.fill();
  }
}

function paintFrame(ctx: Canvas2D, asset: DeviceAsset, finish: DeviceFinish, highlight: number): void {
  const { body, frameWidth } = asset;
  const metal = ctx.createLinearGradient(body.x, body.y, body.x + body.width, body.y + body.height);
  for (const [offset, color] of FINISHES[finish].stops) metal.addColorStop(offset, color);
  bodyPath(ctx, asset);
  ctx.fillStyle = metal;
  ctx.fill();

  // Polished chamfer catching the key light from the upper left.
  if (highlight > 0) {
    const sheen = ctx.createLinearGradient(
      body.x,
      body.y,
      body.x + body.width * 0.9,
      body.y + body.height * 0.6,
    );
    sheen.addColorStop(0, `rgba(255, 255, 255, ${0.85 * highlight})`);
    sheen.addColorStop(0.35, `rgba(255, 255, 255, ${0.18 * highlight})`);
    sheen.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.strokeStyle = sheen;
    ctx.lineWidth = frameWidth * 0.22;
    bodyPath(ctx, asset, frameWidth * 0.3);
    ctx.stroke();

    const rim = ctx.createLinearGradient(body.x + body.width, body.y + body.height, body.x, body.y);
    rim.addColorStop(0, `rgba(255, 255, 255, ${0.35 * highlight})`);
    rim.addColorStop(0.3, 'rgba(255, 255, 255, 0)');
    ctx.strokeStyle = rim;
    ctx.lineWidth = frameWidth * 0.12;
    bodyPath(ctx, asset, frameWidth * 0.06);
    ctx.stroke();
  }

  ctx.strokeStyle = FINISHES[finish].edge;
  ctx.lineWidth = 2;
  bodyPath(ctx, asset, 1);
  ctx.stroke();

  bodyPath(ctx, asset, frameWidth);
  ctx.fillStyle = BEZEL;
  ctx.fill();
}

function paintScreen(ctx: Canvas2D, asset: DeviceAsset, layer: DeviceLayer, screens: ScreenLookup): void {
  const { screen } = asset;
  ctx.save();
  ctx.beginPath();
  smoothRoundedRect(ctx, screen, asset.cornerSmoothing);
  ctx.clip();

  const image = layer.screen.assetId ? screens(layer.screen.assetId) : undefined;
  if (layer.screen.assetId && !image) {
    throw new FrameflowError(
      'SCENE_VALIDATION_FAILED',
      `The screenshot for "${layer.name}" is no longer available. Upload it again or choose another.`,
    );
  }
  ctx.fillStyle = image ? '#000000' : EMPTY_SCREEN;
  ctx.fillRect(screen.x, screen.y, screen.width, screen.height);
  if (image) {
    const fit = fitScreen(image, screen, layer.screen.fit, layer.screen.anchor);
    ctx.drawImage(
      image.source,
      fit.source.x,
      fit.source.y,
      fit.source.width,
      fit.source.height,
      screen.x + fit.dest.x,
      screen.y + fit.dest.y,
      fit.dest.width,
      fit.dest.height,
    );
  }

  ctx.fillStyle = '#000000';
  for (const cutout of asset.cutouts) {
    ctx.beginPath();
    smoothRoundedRect(
      ctx,
      {
        x: screen.x + cutout.x,
        y: screen.y + cutout.y,
        width: cutout.width,
        height: cutout.height,
        cornerRadius: cutout.height / 2,
      },
      0,
    );
    ctx.fill();
  }
  ctx.restore();
}

function paintDevice(
  ctx: Canvas2D,
  layer: DeviceLayer,
  asset: DeviceAsset,
  lighting: Lighting,
  size: Size,
  screens: ScreenLookup,
): void {
  const placement = placeDevice(layer, asset, size);
  ctx.save();
  ctx.translate(placement.center.x, placement.center.y);
  ctx.rotate(placement.rotation);
  ctx.scale(placement.scale, placement.scale);
  ctx.translate(-asset.body.width / 2, -asset.body.height / 2);

  paintShadows(ctx, asset, lighting, placement.heightPx, layer.finish);
  paintButtons(ctx, asset, layer.finish);
  paintFrame(ctx, asset, layer.finish, lighting.frameHighlight);
  paintScreen(ctx, asset, layer, screens);
  ctx.restore();
}

/**
 * Draws a scene at any pixel size. Preview and export both call this, so they
 * interpret scene data identically; only the output resolution differs.
 * `size` must have the scene canvas's aspect ratio.
 */
export function renderScene(
  ctx: Canvas2D,
  scene: Scene,
  size: Size,
  screens: ScreenLookup,
  registry: DeviceRegistry = DEVICE_ASSETS,
): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  paintBackground(ctx, scene.background, size);
  for (const layer of paintOrder(scene)) {
    const asset = registry.get(layer.deviceAssetId);
    if (!asset)
      throw new FrameflowError('SCENE_VALIDATION_FAILED', `Unknown device "${layer.deviceAssetId}".`);
    paintDevice(ctx, layer, asset, scene.lighting, size, screens);
  }
  ctx.restore();
}
