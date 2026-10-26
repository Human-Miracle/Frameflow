import { FrameflowError, toFrameflowError } from '@/domain/errors';
import { DEVICE_ASSETS, type DeviceRegistry } from '@/devices/registry';
import { renderScene, type ScreenLookup } from '@/mockup-engine/render';
import { traced } from '@/observability/logger';
import type { Scene } from '@/scene/schema';
import { validateScene } from '@/scene/validate';
import { exportReadiness, verifyPngOutput } from './output';

const ENCODE_TIMEOUT_MS = 30_000;

export interface PngExport {
  blob: Blob;
  width: number;
  height: number;
  bytes: number;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () =>
        reject(new FrameflowError('RENDER_TIMEOUT', 'The export took too long. Try a smaller export size.')),
      ms,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function encode(
  width: number,
  height: number,
  draw: (ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D) => void,
): Promise<Blob> {
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d', { colorSpace: 'srgb' });
    if (!ctx)
      throw new FrameflowError(
        'RENDER_OUT_OF_MEMORY',
        'Not enough memory to render this size. Try a smaller export size.',
      );
    draw(ctx);
    return canvas.convertToBlob({ type: 'image/png' });
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { colorSpace: 'srgb' });
  if (!ctx)
    throw new FrameflowError(
      'RENDER_OUT_OF_MEMORY',
      'Not enough memory to render this size. Try a smaller export size.',
    );
  draw(ctx);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new FrameflowError('OUTPUT_VALIDATION_FAILED', 'The browser could not encode the PNG.')),
      'image/png',
    ),
  );
}

/**
 * Renders the scene at its full canvas size, encodes a PNG and verifies the
 * encoded file before returning it. Success is never reported for an
 * unverified file.
 */
export function exportScenePng(
  scene: Scene,
  screens: ScreenLookup,
  registry: DeviceRegistry = DEVICE_ASSETS,
): Promise<PngExport> {
  const { width, height } = scene.canvas;
  return traced(
    'export.png',
    { width, height, layers: scene.layers.length, template: scene.templateId, style: scene.styleId },
    async () => {
      const valid = validateScene(scene, registry);
      if (!valid.ok) throw valid.error;
      const ready = exportReadiness(scene);
      if (!ready.ok) throw ready.error;

      const blob = await withTimeout(
        encode(width, height, (ctx) => renderScene(ctx, scene, { width, height }, screens, registry)),
        ENCODE_TIMEOUT_MS,
      );
      const verified = verifyPngOutput(new Uint8Array(await blob.arrayBuffer()), { width, height });
      if (!verified.ok) throw verified.error;
      return { blob, width, height, bytes: blob.size };
    },
    (error) => toFrameflowError(error).code,
  );
}
