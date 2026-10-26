import { z } from 'zod';
import { FrameflowError, fail, ok, type Result } from '@/domain/errors';
import type { Scene } from '@/scene/schema';
import { validateScene } from '@/scene/validate';
import type { SavedSceneSummary, SavedScreenMeta, SceneToSave } from './types';

/**
 * Stored record format. Versioned separately from the scene schema so storage
 * layout can change without touching scene documents.
 */
export const RECORD_FORMAT_VERSION = 1;

const screenMetaSchema = z.object({
  id: z.string().min(1).max(128),
  name: z.string().min(1).max(120),
  format: z.enum(['png', 'jpeg', 'webp']),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  bytes: z.number().int().positive(),
});

const recordSchema = z.object({
  formatVersion: z.literal(RECORD_FORMAT_VERSION),
  id: z.string().min(1).max(64),
  savedAt: z.string().datetime(),
  scene: z.unknown(),
  screens: z.array(screenMetaSchema).max(64),
  thumbnail: z.instanceof(Blob).nullable().optional(),
});

export interface SceneRecord {
  formatVersion: typeof RECORD_FORMAT_VERSION;
  id: string;
  savedAt: string;
  scene: Scene;
  screens: SavedScreenMeta[];
  thumbnail?: Blob | null;
}

export function buildRecord(input: SceneToSave, savedAt: Date): Result<SceneRecord> {
  const valid = validateScene(input.scene);
  if (!valid.ok) return valid;
  const known = new Set(input.screens.map((screen) => screen.meta.id));
  const unknown = valid.value.layers.find(
    (layer) => layer.screen.assetId && !known.has(layer.screen.assetId),
  );
  if (unknown) {
    return fail(
      'SCENE_VALIDATION_FAILED',
      `"${unknown.name}" uses a screenshot that is not part of this scene.`,
    );
  }
  return ok({
    formatVersion: RECORD_FORMAT_VERSION,
    id: valid.value.id,
    savedAt: savedAt.toISOString(),
    scene: valid.value,
    screens: input.screens.map((screen) => screen.meta),
    thumbnail: input.thumbnail,
  });
}

/** Validates a record read back from storage. Storage is treated as untrusted input. */
export function parseRecord(raw: unknown): Result<SceneRecord> {
  const parsed = recordSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(
      'STORAGE_FAILURE',
      'This saved scene is damaged or was saved by an unsupported version of Frameflow.',
    );
  }
  const scene = validateScene(parsed.data.scene);
  if (!scene.ok) return scene;
  if (scene.value.id !== parsed.data.id) {
    return fail('STORAGE_FAILURE', 'This saved scene is damaged: its identifiers do not match.');
  }
  return ok({ ...parsed.data, scene: scene.value });
}

export function summarise(record: SceneRecord): SavedSceneSummary {
  return {
    id: record.id,
    name: record.scene.name,
    savedAt: record.savedAt,
    templateId: record.scene.templateId,
    styleId: record.scene.styleId,
    screenCount: record.screens.length,
    thumbnail: record.thumbnail ?? null,
  };
}

/** Screen IDs still referenced by any record; everything else can be deleted. */
export function referencedScreenIds(records: Iterable<unknown>): Set<string> {
  const ids = new Set<string>();
  for (const record of records) {
    const screens = (record as { screens?: unknown } | null)?.screens;
    if (!Array.isArray(screens)) continue;
    for (const screen of screens) {
      const id = (screen as { id?: unknown } | null)?.id;
      if (typeof id === 'string') ids.add(id);
    }
  }
  return ids;
}

export function storageError(cause: unknown): FrameflowError {
  if (cause instanceof FrameflowError) return cause;
  const name = cause instanceof DOMException ? cause.name : '';
  if (name === 'QuotaExceededError') {
    return new FrameflowError(
      'STORAGE_FAILURE',
      'Browser storage is full. Delete saved scenes you no longer need, then save again.',
      { cause },
    );
  }
  return new FrameflowError('STORAGE_FAILURE', 'Saving or loading failed in this browser. Try again.', {
    cause,
  });
}
