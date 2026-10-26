import { fail, ok, type Result } from '@/domain/errors';
import { EXPORT_LIMITS } from '@/domain/limits';
import type { Scene } from '@/scene/schema';
import { readImageHeader } from '@/upload/image-header';

export interface ExportSize {
  id: string;
  label: string;
  width: number;
  height: number;
}

export const EXPORT_SIZES: readonly ExportSize[] = [
  { id: '4k', label: '4K landscape · 3840 × 2160', width: 3840, height: 2160 },
  { id: 'qhd', label: 'QHD landscape · 2560 × 1440', width: 2560, height: 1440 },
  { id: 'fhd', label: 'Full HD landscape · 1920 × 1080', width: 1920, height: 1080 },
  { id: 'square', label: 'Square · 2160 × 2160', width: 2160, height: 2160 },
  { id: 'portrait', label: 'Portrait 4:5 · 2160 × 2700', width: 2160, height: 2700 },
  { id: 'dribbble', label: 'Shot 4:3 · 3200 × 2400', width: 3200, height: 2400 },
];

export function exportSizeIsSupported(width: number, height: number): boolean {
  return (
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    width >= EXPORT_LIMITS.minSide &&
    height >= EXPORT_LIMITS.minSide &&
    width <= EXPORT_LIMITS.maxSide &&
    height <= EXPORT_LIMITS.maxSide &&
    width * height <= EXPORT_LIMITS.maxPixels
  );
}

/**
 * Preview pixel size: the largest size with the scene's aspect ratio that fits
 * the available box, scaled for the display's pixel density and capped so the
 * preview stays responsive. Export always renders at full canvas size instead.
 */
export function previewSize(
  canvas: { width: number; height: number },
  box: { width: number; height: number },
  pixelRatio: number,
  maxPixels = 4_000_000,
): { cssWidth: number; cssHeight: number; width: number; height: number } {
  const fitScale = Math.min(box.width / canvas.width, box.height / canvas.height);
  const cssWidth = Math.max(1, Math.floor(canvas.width * fitScale));
  const cssHeight = Math.max(1, Math.floor(canvas.height * fitScale));
  let ratio = Math.max(1, pixelRatio);
  if (cssWidth * cssHeight * ratio * ratio > maxPixels) ratio = Math.sqrt(maxPixels / (cssWidth * cssHeight));
  return { cssWidth, cssHeight, width: Math.round(cssWidth * ratio), height: Math.round(cssHeight * ratio) };
}

/** Every visible device needs a screenshot before export; empty screens are never exported silently. */
export function exportReadiness(scene: Scene): Result<true> {
  const empty = scene.layers.filter((layer) => layer.visible && !layer.screen.assetId);
  if (empty.length > 0) {
    return fail(
      'SCENE_VALIDATION_FAILED',
      `Assign a screenshot to ${empty.map((layer) => layer.name).join(', ')} before exporting, or hide ${empty.length === 1 ? 'that device' : 'those devices'}.`,
    );
  }
  return ok(true);
}

/** Confirms the encoded file is a PNG with exactly the requested dimensions. */
export function verifyPngOutput(
  bytes: Uint8Array,
  expected: { width: number; height: number },
): Result<true> {
  const header = readImageHeader(bytes);
  if (typeof header === 'string' || header.format !== 'png') {
    return fail(
      'OUTPUT_VALIDATION_FAILED',
      'The browser produced an invalid PNG. Nothing was downloaded; try exporting again.',
    );
  }
  if (header.width !== expected.width || header.height !== expected.height) {
    return fail(
      'OUTPUT_VALIDATION_FAILED',
      `The export came out at ${header.width}×${header.height} px instead of ${expected.width}×${expected.height} px, so it was not downloaded.`,
    );
  }
  return ok(true);
}

export function exportFileName(scene: Scene): string {
  return `frameflow-${scene.templateId}-${scene.styleId}-${scene.canvas.width}x${scene.canvas.height}.png`;
}
