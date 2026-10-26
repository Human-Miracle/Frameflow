import { describe, expect, it } from 'vitest';
import { initialStudioState, studioReducer, type ScreenEntry, type StudioState } from './state';

const screen = (id: string): ScreenEntry => ({
  id,
  name: `${id}.png`,
  format: 'png',
  width: 1179,
  height: 2556,
  bytes: 1,
  bitmap: {} as ImageBitmap,
  thumbnailUrl: '',
});

const run = (state: StudioState, ...actions: Parameters<typeof studioReducer>[1][]) =>
  actions.reduce(studioReducer, state);
const screensOf = (state: StudioState) => state.scene.layers.map((l) => l.screen.assetId);

describe('studioReducer', () => {
  it('starts with a single empty device selected', () => {
    const state = initialStudioState();
    expect(state.scene.templateId).toBe('single-hero');
    expect(state.selectedLayerId).toBe('hero');
    expect(screensOf(state)).toEqual([null]);
  });

  it('fills every empty device with the first screenshot, then assigns later ones to the selected device', () => {
    let state = run(initialStudioState(), { type: 'templateChanged', templateId: 'trio-stack' });
    state = run(state, { type: 'screenAdded', screen: screen('a') });
    expect(screensOf(state)).toEqual(['a', 'a', 'a']);
    state = run(
      state,
      { type: 'layerSelected', layerId: 'left' },
      { type: 'screenAdded', screen: screen('b') },
    );
    expect(screensOf(state)).toEqual(['b', 'a', 'a']);
  });

  it('clears assignments when a screenshot is removed', () => {
    const state = run(
      initialStudioState(),
      { type: 'screenAdded', screen: screen('a') },
      { type: 'screenRemoved', screenId: 'a' },
    );
    expect(state.screens).toEqual([]);
    expect(screensOf(state)).toEqual([null]);
  });

  it('clamps rotation to the device asset’s supported range', () => {
    const state = run(initialStudioState(), {
      type: 'transformChanged',
      layerId: 'hero',
      patch: { rotation: 80, x: 2 },
    });
    expect(state.scene.layers[0]!.transform.rotation).toBe(30);
    expect(state.scene.layers[0]!.transform.x).toBe(1);
  });

  it('ignores transform edits on locked layers', () => {
    const state = run(
      initialStudioState(),
      { type: 'lockToggled', layerId: 'hero' },
      { type: 'transformChanged', layerId: 'hero', patch: { x: 0.2 } },
    );
    expect(state.scene.layers[0]!.transform.x).toBe(0.5);
  });

  it('switches style without moving devices and keeps a chosen background until the style changes', () => {
    let state = run(initialStudioState(), { type: 'transformChanged', layerId: 'hero', patch: { x: 0.4 } });
    state = run(state, { type: 'styleChanged', styleId: 'cinematic' });
    expect(state.scene.styleId).toBe('cinematic');
    expect(state.scene.layers[0]!.transform.x).toBe(0.4);
    state = run(state, { type: 'backgroundChanged', presetId: 'midnight' });
    expect(state.scene.background.presetId).toBe('midnight');
  });

  it('resets the layout to the template while keeping screens and background', () => {
    let state = run(
      initialStudioState(),
      { type: 'screenAdded', screen: screen('a') },
      { type: 'backgroundChanged', presetId: 'white' },
      { type: 'transformChanged', layerId: 'hero', patch: { x: 0.2 } },
    );
    state = run(state, { type: 'layoutReset' });
    expect(state.scene.layers[0]!.transform.x).toBe(0.5);
    expect(screensOf(state)).toEqual(['a']);
    expect(state.scene.background.presetId).toBe('white');
  });

  it('resizes the canvas without changing normalised transforms', () => {
    const state = run(initialStudioState(), { type: 'canvasResized', width: 2160, height: 2700 });
    expect(state.scene.canvas).toMatchObject({ width: 2160, height: 2700 });
    expect(state.scene.layers[0]!.transform).toEqual(initialStudioState().scene.layers[0]!.transform);
  });
});
