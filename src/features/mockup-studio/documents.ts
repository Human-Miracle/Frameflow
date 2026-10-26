import { toFrameflowError } from '@/domain/errors';
import { renderScene, type ScreenLookup } from '@/mockup-engine/render';
import { log, newCorrelationId } from '@/observability/logger';
import type { LoadedScene, SceneToSave } from '@/persistence/types';
import type { Scene } from '@/scene/schema';
import { decodeScreenshot } from '@/upload/decode';
import type { ScreenEntry, StudioState } from './state';

const THUMBNAIL_WIDTH = 480;

/**
 * Identifies the saveable content of the workspace. Two states with the same
 * key would produce the same saved record, so a changed key means unsaved work.
 */
export function documentKey(studio: Pick<StudioState, 'scene' | 'screens'>): string {
  return JSON.stringify({ scene: studio.scene, screens: studio.screens.map((screen) => screen.id) });
}

export function toSaveInput(
  studio: Pick<StudioState, 'scene' | 'screens'>,
  thumbnail: Blob | null,
): SceneToSave {
  return {
    scene: studio.scene,
    screens: studio.screens.map((screen) => ({
      meta: {
        id: screen.id,
        name: screen.name,
        format: screen.format,
        width: screen.width,
        height: screen.height,
        bytes: screen.bytes,
      },
      blob: screen.blob,
    })),
    thumbnail,
  };
}

/** A small preview for the Open list, rendered with the same renderer as export. Best effort. */
export async function renderThumbnail(scene: Scene, screens: ScreenLookup): Promise<Blob | null> {
  try {
    const width = THUMBNAIL_WIDTH;
    const height = Math.round((THUMBNAIL_WIDTH * scene.canvas.height) / scene.canvas.width);
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    renderScene(ctx, scene, { width, height }, screens);
    return await canvas.convertToBlob({ type: 'image/png' });
  } catch (error) {
    log('warn', {
      operation: 'scene.thumbnail',
      outcome: 'failed',
      correlationId: newCorrelationId(),
      errorCode: toFrameflowError(error).code,
    });
    return null;
  }
}

export interface RestoredDocument {
  scene: Scene;
  screens: ScreenEntry[];
  /** Names of screenshots that could not be restored; their devices are left empty. */
  lost: string[];
}

/**
 * Turns a loaded record back into a working document. Stored screenshot
 * bytes are validated and decoded again, keeping their IDs so assignments
 * survive. Anything that fails is reported and unassigned, never hidden.
 */
export async function restoreDocument(loaded: LoadedScene): Promise<RestoredDocument> {
  const screens: ScreenEntry[] = [];
  const lost: string[] = [];
  for (const { meta, blob } of loaded.screens) {
    try {
      screens.push(
        await decodeScreenshot(blob, meta.name, { id: meta.id, operation: 'scene.restore-screen' }),
      );
    } catch {
      lost.push(meta.name);
    }
  }
  const storedNames = new Map(loaded.screens.map(({ meta }) => [meta.id, meta.name]));
  for (const id of loaded.missingScreenIds) lost.push(storedNames.get(id) ?? 'A screenshot');

  const available = new Set(screens.map((screen) => screen.id));
  const scene: Scene = {
    ...loaded.scene,
    layers: loaded.scene.layers.map((layer) =>
      layer.screen.assetId && !available.has(layer.screen.assetId)
        ? { ...layer, screen: { ...layer.screen, assetId: null } }
        : layer,
    ),
  };
  return { scene, screens, lost };
}

export function releaseScreens(screens: readonly ScreenEntry[]): void {
  for (const screen of screens) {
    screen.bitmap.close();
    URL.revokeObjectURL(screen.thumbnailUrl);
  }
}
