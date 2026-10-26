import { fail, ok, type Result } from '@/domain/errors';
import { EXPORT_LIMITS } from '@/domain/limits';
import { DEVICE_ASSETS, type DeviceRegistry } from '@/devices/registry';
import { SCENE_SCHEMA_VERSION, sceneSchema, type Scene } from './schema';

/**
 * Brings a stored scene document up to the current schema version. Version 1
 * is the first version, so this only rejects unknown versions for now.
 */
export function migrateScene(input: unknown): Result<unknown> {
  if (typeof input !== 'object' || input === null) {
    return fail('SCENE_VALIDATION_FAILED', 'The scene file is not a valid Frameflow scene.');
  }
  const version = (input as { schemaVersion?: unknown }).schemaVersion;
  if (version === SCENE_SCHEMA_VERSION) return ok(input);
  if (typeof version === 'number' && version > SCENE_SCHEMA_VERSION) {
    return fail(
      'SCENE_VALIDATION_FAILED',
      `This scene was made with a newer version of Frameflow (schema ${version}). Update Frameflow to open it.`,
    );
  }
  return fail('SCENE_VALIDATION_FAILED', 'The scene file has no recognised schema version.');
}

/**
 * Validates structure, then the rules the schema cannot express: unique layer
 * IDs, known device assets, transforms each asset supports, and export bounds.
 */
export function validateScene(input: unknown, registry: DeviceRegistry = DEVICE_ASSETS): Result<Scene> {
  const migrated = migrateScene(input);
  if (!migrated.ok) return migrated;

  const parsed = sceneSchema.safeParse(migrated.value);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.join('.') || 'scene';
    return fail(
      'SCENE_VALIDATION_FAILED',
      `Invalid scene at ${where}: ${issue?.message ?? 'unknown problem'}.`,
    );
  }
  const scene = parsed.data;

  const { width, height } = scene.canvas;
  if (
    width < EXPORT_LIMITS.minSide ||
    height < EXPORT_LIMITS.minSide ||
    width > EXPORT_LIMITS.maxSide ||
    height > EXPORT_LIMITS.maxSide ||
    width * height > EXPORT_LIMITS.maxPixels
  ) {
    return fail(
      'SCENE_VALIDATION_FAILED',
      `Canvas ${width}×${height} px is outside the supported range: ${EXPORT_LIMITS.minSide} to ${EXPORT_LIMITS.maxSide} px per side, at most ${EXPORT_LIMITS.maxPixels / 1_000_000} megapixels.`,
    );
  }

  const seen = new Set<string>();
  for (const layer of scene.layers) {
    if (seen.has(layer.id))
      return fail('SCENE_VALIDATION_FAILED', `Layer ID "${layer.id}" is used more than once.`);
    seen.add(layer.id);

    const asset = registry.get(layer.deviceAssetId);
    if (!asset) {
      return fail(
        'SCENE_VALIDATION_FAILED',
        `Layer "${layer.name}" uses an unknown device "${layer.deviceAssetId}".`,
      );
    }
    const { min, max } = asset.supportedTransforms.rotationDegrees;
    if (layer.transform.rotation < min || layer.transform.rotation > max) {
      return fail(
        'UNSUPPORTED_ASSET_TRANSFORM',
        `${asset.name} supports rotation between ${min}° and ${max}°; "${layer.name}" is set to ${layer.transform.rotation}°.`,
      );
    }
    if (!asset.finishes.includes(layer.finish)) {
      return fail(
        'UNSUPPORTED_ASSET_TRANSFORM',
        `${asset.name} is not available in the "${layer.finish}" finish.`,
      );
    }
  }
  return ok(scene);
}
