import { describe, expect, it } from 'vitest';
import { STYLE_PRESETS } from './presets';
import type { Scene } from './schema';
import { TEMPLATES, applyStyle, applyTemplate, createScene } from './templates';
import { migrateScene, validateScene } from './validate';

const base = (): Scene => createScene({ id: 's', templateId: 'trio-stack', screenAssetIds: ['a', 'b', 'c'] });

function expectCode(input: unknown, code: string) {
  const result = validateScene(input);
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.error.code).toBe(code);
}

describe('scene schema', () => {
  it.each(TEMPLATES.flatMap((t) => STYLE_PRESETS.map((s) => [t.id, s.id] as const)))(
    'template %s with style %s produces a valid scene',
    (templateId, styleId) => {
      const scene = createScene({ id: 'x', templateId, styleId });
      expect(validateScene(scene)).toEqual({ ok: true, value: scene });
    },
  );

  it('survives a JSON round trip unchanged (scene data is the source of truth)', () => {
    const scene = base();
    const result = validateScene(JSON.parse(JSON.stringify(scene)));
    expect(result.ok && result.value).toEqual(scene);
  });

  it('rejects malformed colours with the field path', () => {
    const scene = base();
    const result = validateScene({
      ...scene,
      lighting: { ...scene.lighting, shadow: { ...scene.lighting.shadow, color: 'red' } },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('lighting.shadow.color');
  });

  it('rejects rotation outside the device asset’s supported range', () => {
    const scene = base();
    const layers = scene.layers.map((l, i) =>
      i === 0 ? { ...l, transform: { ...l.transform, rotation: 45 } } : l,
    );
    expectCode({ ...scene, layers }, 'UNSUPPORTED_ASSET_TRANSFORM');
  });

  it('rejects duplicate layer IDs', () => {
    const scene = base();
    const layers = scene.layers.map((l) => ({ ...l, id: 'same' }));
    expectCode({ ...scene, layers }, 'SCENE_VALIDATION_FAILED');
  });

  it('rejects unknown device assets', () => {
    const scene = base();
    const layers = scene.layers.map((l) => ({ ...l, deviceAssetId: 'nope' }));
    expectCode({ ...scene, layers }, 'SCENE_VALIDATION_FAILED');
  });

  it('rejects canvases beyond export limits', () => {
    expectCode(
      { ...base(), canvas: { width: 10_000, height: 10_000, colorSpace: 'srgb' } },
      'SCENE_VALIDATION_FAILED',
    );
    expectCode(
      { ...base(), canvas: { width: 100, height: 100, colorSpace: 'srgb' } },
      'SCENE_VALIDATION_FAILED',
    );
  });

  it('rejects scenes from a newer schema version with a clear message', () => {
    const result = migrateScene({ ...base(), schemaVersion: 2 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toMatch(/newer version/);
    expect(migrateScene('nope').ok).toBe(false);
  });
});

describe('templates and styles', () => {
  it('minimal and cinematic differ in background, lighting and finish', () => {
    const minimal = createScene({ id: 'm', templateId: 'single-hero', styleId: 'minimal' });
    const cinematic = applyStyle(minimal, 'cinematic');
    expect(cinematic.background).not.toEqual(minimal.background);
    expect(cinematic.lighting).not.toEqual(minimal.lighting);
    expect(cinematic.layers[0]?.finish).toBe('graphite');
    expect(cinematic.layers[0]?.transform).toEqual(minimal.layers[0]?.transform);
  });

  it('the cinematic stack has three overlapping devices, front device last', () => {
    const scene = base();
    expect(scene.layers.map((l) => l.id)).toEqual(['left', 'right', 'center']);
    const front = scene.layers[2]!.transform;
    expect(front.height).toBeGreaterThan(scene.layers[0]!.transform.height);
  });

  it('switching templates keeps the front screen on the front device', () => {
    const single = applyTemplate(base(), 'single-hero');
    expect(single.layers.map((l) => l.screen.assetId)).toEqual(['c']);
    const back = applyTemplate(single, 'trio-stack');
    expect(back.layers.map((l) => l.screen.assetId)).toEqual(['c', 'c', 'c']);
    expect(back.styleId).toBe(single.styleId);
  });
});
