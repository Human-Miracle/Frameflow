import { describe, expect, it } from 'vitest';
import type { Scene } from '@/scene/schema';
import { createScene } from '@/scene/templates';
import { MemorySceneRepository } from './memory-repository';
import { RECORD_FORMAT_VERSION } from './record';
import type { SceneToSave } from './types';

const meta = (id: string) => ({
  id,
  name: `${id}.png`,
  format: 'png' as const,
  width: 1179,
  height: 2556,
  bytes: 3,
});
const blob = (text: string) => new Blob([text], { type: 'image/png' });

function input(id: string, screenIds: string[], patch: Partial<Scene> = {}): SceneToSave {
  const scene = {
    ...createScene({ id, templateId: 'trio-stack', styleId: 'cinematic', screenAssetIds: screenIds }),
    ...patch,
  };
  return { scene, screens: screenIds.map((s) => ({ meta: meta(s), blob: blob(s) })), thumbnail: null };
}

let clock = 0;
const repo = () => new MemorySceneRepository(() => new Date(Date.UTC(2026, 9, 26, 12, 0, clock++)));

describe('scene repository (memory implementation)', () => {
  it('reopens a saved scene with every setting and screen assignment intact', async () => {
    const r = repo();
    const original = input('s1', ['a', 'b', 'c'], { name: 'Launch hero' });
    original.scene.layers = [original.scene.layers[2]!, original.scene.layers[0]!, original.scene.layers[1]!];
    await r.save(original);
    const loaded = await r.load('s1');
    expect(loaded.scene).toEqual(original.scene);
    expect(loaded.screens.map((s) => s.meta)).toEqual(['a', 'b', 'c'].map(meta));
    expect(await loaded.screens[0]!.blob.text()).toBe('a');
    expect(loaded.missingScreenIds).toEqual([]);
  });

  it('lists scenes newest first with summaries', async () => {
    const r = repo();
    await r.save(input('old', ['a']));
    await r.save(input('new', ['b']));
    const list = await r.list();
    expect(list.map((s) => s.id)).toEqual(['new', 'old']);
    expect(list[0]).toMatchObject({ templateId: 'trio-stack', styleId: 'cinematic', screenCount: 1 });
  });

  it('overwrites a scene saved again under the same ID', async () => {
    const r = repo();
    await r.save(input('s1', ['a']));
    await r.save(input('s1', ['a'], { name: 'Renamed' }));
    expect((await r.list()).map((s) => s.name)).toEqual(['Renamed']);
  });

  it('keeps screenshots shared by another scene when one scene is deleted', async () => {
    const r = repo();
    await r.save(input('s1', ['shared', 'only1']));
    await r.save(input('s2', ['shared']));
    await r.remove('s1');
    expect(r.screenCount).toBe(1);
    expect((await r.load('s2')).missingScreenIds).toEqual([]);
  });

  it('deletes screenshots no saved scene uses', async () => {
    const r = repo();
    await r.save(input('s1', ['a', 'b']));
    await r.save(input('s1', ['a']));
    expect(r.screenCount).toBe(1);
  });

  it('reports missing screenshots instead of failing the whole scene', async () => {
    const r = repo();
    await r.save(input('s1', ['a', 'b']));
    r.dropScreen('b');
    const loaded = await r.load('s1');
    expect(loaded.missingScreenIds).toEqual(['b']);
    expect(loaded.screens).toHaveLength(1);
  });

  it('refuses to save a scene that references screenshots it does not include', async () => {
    const r = repo();
    const bad = input('s1', ['a']);
    await expect(r.save({ ...bad, screens: [] })).rejects.toMatchObject({ code: 'SCENE_VALIDATION_FAILED' });
  });

  it('refuses to save an invalid scene', async () => {
    const r = repo();
    const bad = input('s1', []);
    await expect(
      r.save({ ...bad, scene: { ...bad.scene, canvas: { width: 1, height: 1, colorSpace: 'srgb' } } }),
    ).rejects.toMatchObject({
      code: 'SCENE_VALIDATION_FAILED',
    });
  });

  it('treats stored data as untrusted: damaged records are skipped in the list and fail to open', async () => {
    const r = repo();
    await r.save(input('good', ['a']));
    r.putRaw('broken', {
      formatVersion: RECORD_FORMAT_VERSION,
      id: 'broken',
      savedAt: 'yesterday',
      scene: {},
      screens: [],
    });
    expect((await r.list()).map((s) => s.id)).toEqual(['good']);
    await expect(r.load('broken')).rejects.toMatchObject({ code: 'STORAGE_FAILURE' });
  });

  it('rejects scenes saved by a newer schema version with a clear message', async () => {
    const r = repo();
    const saved = input('future', []);
    r.putRaw('future', {
      formatVersion: RECORD_FORMAT_VERSION,
      id: 'future',
      savedAt: new Date().toISOString(),
      scene: { ...saved.scene, schemaVersion: 99 },
      screens: [],
    });
    await expect(r.load('future')).rejects.toThrow(/newer version/);
  });

  it('fails clearly when opening a scene that no longer exists', async () => {
    await expect(repo().load('nope')).rejects.toMatchObject({ code: 'STORAGE_FAILURE' });
  });
});
