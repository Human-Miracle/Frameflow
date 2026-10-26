import type { DeviceAsset } from '@/devices/types';
import { fitScreen } from '@/mockup-engine/geometry';
import { smoothRoundedRect } from '@/mockup-engine/paths';
import type { ScreenImage } from '@/mockup-engine/render';
import type { ScreenAssignment } from '@/scene/schema';

/**
 * Pre-composites the screen at the aperture's native resolution using the 2D
 * renderer's fit rules, corner path and cutout geometry, so both paths crop,
 * mask and cut out identically. Pixels outside the rounded aperture are
 * transparent; the 3D mesh is a plain rectangle that relies on this mask.
 */
export function composeScreen(
  asset: DeviceAsset,
  assignment: ScreenAssignment,
  image: ScreenImage | undefined,
  options: { clipToAperture?: boolean } = {},
): OffscreenCanvas {
  const { nativeWidth, nativeHeight } = asset.screen;
  const scale = nativeWidth / asset.screen.width;
  const canvas = new OffscreenCanvas(nativeWidth, nativeHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  ctx.scale(scale, scale);

  // Pre-rendered views supply their own antialiased mask, so they take the full rectangle.
  if (options.clipToAperture ?? true) {
    ctx.beginPath();
    smoothRoundedRect(ctx, { ...asset.screen, x: 0, y: 0 }, asset.cornerSmoothing);
    ctx.clip();
  }
  ctx.fillStyle = image ? '#000000' : '#141518';
  ctx.fillRect(0, 0, asset.screen.width, asset.screen.height);
  if (image) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const fit = fitScreen(image, asset.screen, assignment.fit, assignment.anchor);
    ctx.drawImage(
      image.source,
      fit.source.x,
      fit.source.y,
      fit.source.width,
      fit.source.height,
      fit.dest.x,
      fit.dest.y,
      fit.dest.width,
      fit.dest.height,
    );
  }
  ctx.fillStyle = '#000000';
  for (const cutout of asset.cutouts) {
    ctx.beginPath();
    smoothRoundedRect(ctx, { ...cutout, cornerRadius: cutout.height / 2 }, 0);
    ctx.fill();
    // Front camera lens seen through the cutout: a dark lens with a faint blue coating glint.
    const r = cutout.height * 0.24;
    const cx = cutout.x + cutout.width - cutout.height / 2;
    const cy = cutout.y + cutout.height / 2;
    const lens = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
    lens.addColorStop(0, '#2a3550');
    lens.addColorStop(0.5, '#0d1120');
    lens.addColorStop(1, '#050608');
    ctx.fillStyle = lens;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000000';
  }
  return canvas;
}
