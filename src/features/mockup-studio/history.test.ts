import { describe, expect, it } from 'vitest';
import {
  HISTORY_LIMIT,
  canRedo,
  canUndo,
  editorReducer,
  initialEditorState,
  type EditorAction,
  type EditorState,
} from './history';
import { initialStudioState, type ScreenEntry } from './state';

const screen = (id: string): ScreenEntry => ({
  id,
  name: `${id}.png`,
  format: 'png',
  width: 1179,
  height: 2556,
  bytes: 1,
  bitmap: {} as ImageBitmap,
  blob: new Blob(),
  thumbnailUrl: '',
});

const start = () => initialEditorState(initialStudioState());
const run = (state: EditorState, ...actions: EditorAction[]) => actions.reduce(editorReducer, state);
const x = (state: EditorState) => state.studio.scene.layers[0]!.transform.x;

describe('editor history', () => {
  it('undoes and redoes scene edits', () => {
    let state = run(start(), { type: 'styleChanged', styleId: 'cinematic' });
    expect(state.studio.scene.styleId).toBe('cinematic');
    state = run(state, { type: 'undo' });
    expect(state.studio.scene.styleId).toBe('minimal');
    expect(canRedo(state)).toBe(true);
    state = run(state, { type: 'redo' });
    expect(state.studio.scene.styleId).toBe('cinematic');
    expect(canRedo(state)).toBe(false);
  });

  it('does nothing when there is nothing to undo or redo', () => {
    const state = start();
    expect(run(state, { type: 'undo' })).toBe(state);
    expect(run(state, { type: 'redo' })).toBe(state);
    expect(canUndo(state)).toBe(false);
  });

  it('a new edit after undo discards the redo branch', () => {
    const state = run(
      start(),
      { type: 'styleChanged', styleId: 'cinematic' },
      { type: 'undo' },
      { type: 'backgroundChanged', presetId: 'white' },
    );
    expect(canRedo(state)).toBe(false);
  });

  it('merges one slider drag into a single undo step and splits at a checkpoint', () => {
    let state = run(
      start(),
      { type: 'transformChanged', layerId: 'hero', patch: { x: 0.45 } },
      { type: 'transformChanged', layerId: 'hero', patch: { x: 0.4 } },
      { type: 'transformChanged', layerId: 'hero', patch: { x: 0.35 } },
      { type: 'checkpoint' },
      { type: 'transformChanged', layerId: 'hero', patch: { x: 0.3 } },
    );
    expect(state.past).toHaveLength(2);
    state = run(state, { type: 'undo' });
    expect(x(state)).toBe(0.35);
    state = run(state, { type: 'undo' });
    expect(x(state)).toBe(0.5);
  });

  it('does not record selection changes or no-op edits', () => {
    const state = run(
      start(),
      { type: 'layerSelected', layerId: null },
      { type: 'styleChanged', styleId: 'minimal' },
      { type: 'layerMoved', layerId: 'hero', to: 'front' },
    );
    expect(state.past).toHaveLength(0);
  });

  it('undoes layer reordering', () => {
    let state = run(start(), { type: 'templateChanged', templateId: 'trio-stack' });
    state = run(state, { type: 'layerMoved', layerId: 'center', to: 'back' });
    expect(state.studio.scene.layers.map((l) => l.id)).toEqual(['center', 'left', 'right']);
    state = run(state, { type: 'undo' });
    expect(state.studio.scene.layers.map((l) => l.id)).toEqual(['left', 'right', 'center']);
  });

  it('undo never points a device at a screenshot that was removed', () => {
    let state = run(
      start(),
      { type: 'screenAdded', screen: screen('a') },
      { type: 'styleChanged', styleId: 'cinematic' },
      { type: 'screenRemoved', screenId: 'a' },
      { type: 'undo' },
    );
    expect(state.studio.scene.styleId).toBe('minimal');
    expect(state.studio.scene.layers[0]!.screen.assetId).toBeNull();
    state = run(state, { type: 'redo' });
    expect(state.studio.scene.layers[0]!.screen.assetId).toBeNull();
  });

  it('keeps the selection valid after undoing a template change', () => {
    let state = run(
      start(),
      { type: 'templateChanged', templateId: 'trio-stack' },
      { type: 'layerSelected', layerId: 'left' },
    );
    state = run(state, { type: 'undo' });
    expect(state.studio.selectedLayerId).toBe('hero');
  });

  it('caps history length', () => {
    let state = start();
    for (let i = 0; i < HISTORY_LIMIT + 20; i += 1) {
      state = run(state, { type: 'backgroundChanged', presetId: i % 2 ? 'white' : 'midnight' });
    }
    expect(state.past).toHaveLength(HISTORY_LIMIT);
  });

  it('opening a document replaces the scene and clears history', () => {
    const other = initialStudioState('other').scene;
    const state = run(
      start(),
      { type: 'styleChanged', styleId: 'cinematic' },
      { type: 'documentLoaded', scene: other, screens: [] },
    );
    expect(state.studio.scene.id).toBe('other');
    expect(canUndo(state)).toBe(false);
  });

  it('save as copy renames and re-identifies without losing undo', () => {
    let state = run(start(), { type: 'styleChanged', styleId: 'cinematic' });
    state = run(state, { type: 'sceneIdentityChanged', id: 'copy-id', name: 'Copy' });
    expect(state.studio.scene).toMatchObject({ id: 'copy-id', name: 'Copy' });
    state = run(state, { type: 'undo' });
    expect(state.studio.scene.id).toBe('copy-id');
    expect(state.studio.scene.styleId).toBe('minimal');
  });
});
