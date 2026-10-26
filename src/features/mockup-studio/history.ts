import type { Scene } from '@/scene/schema';
import { studioReducer, type ScreenEntry, type StudioAction, type StudioState } from './state';

/**
 * Undo and redo for scene edits. History stores scene snapshots only:
 * selection is not an edit, and uploaded screenshots stay available after an
 * undo (an undo may unassign a screenshot but never deletes it).
 */
export const HISTORY_LIMIT = 100;

export interface EditorState {
  studio: StudioState;
  past: Scene[];
  future: Scene[];
  /** Consecutive edits with the same key (one slider drag) form one undo step. */
  coalesceKey: string | null;
}

export type EditorAction =
  | StudioAction
  | { type: 'undo' }
  | { type: 'redo' }
  /** Ends the current coalesced gesture, e.g. when a slider is released. */
  | { type: 'checkpoint' }
  | { type: 'documentLoaded'; scene: Scene; screens: ScreenEntry[] }
  /** Gives the document a new identity (Save as copy) without losing undo history. */
  | { type: 'sceneIdentityChanged'; id: string; name: string };

/** Actions that do not change the scene, so never create an undo step. */
const NOT_EDITS = new Set<EditorAction['type']>(['layerSelected', 'screenRemoved']);

export function initialEditorState(studio: StudioState): EditorState {
  return { studio, past: [], future: [], coalesceKey: null };
}

function coalesceKeyOf(action: StudioAction): string | null {
  if (action.type === 'transformChanged')
    return `transform:${action.layerId}:${Object.keys(action.patch).sort().join(',')}`;
  if (action.type === 'sceneRenamed') return 'rename';
  return null;
}

/** Clears assignments to screenshots that were removed after the snapshot was taken. */
function withAvailableScreens(scene: Scene, screens: readonly ScreenEntry[]): Scene {
  const ids = new Set(screens.map((screen) => screen.id));
  if (scene.layers.every((layer) => !layer.screen.assetId || ids.has(layer.screen.assetId))) return scene;
  return {
    ...scene,
    layers: scene.layers.map((layer) =>
      layer.screen.assetId && !ids.has(layer.screen.assetId)
        ? { ...layer, screen: { ...layer.screen, assetId: null } }
        : layer,
    ),
  };
}

function restore(studio: StudioState, scene: Scene): StudioState {
  const next = withAvailableScreens(scene, studio.screens);
  const selected = next.layers.some((layer) => layer.id === studio.selectedLayerId)
    ? studio.selectedLayerId
    : (next.layers.at(-1)?.id ?? null);
  return { ...studio, scene: next, selectedLayerId: selected };
}

const sameScene = (a: Scene, b: Scene) => a === b || JSON.stringify(a) === JSON.stringify(b);

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'undo': {
      const previous = state.past.at(-1);
      if (!previous) return state;
      return {
        studio: restore(state.studio, previous),
        past: state.past.slice(0, -1),
        future: [state.studio.scene, ...state.future],
        coalesceKey: null,
      };
    }
    case 'redo': {
      const next = state.future[0];
      if (!next) return state;
      return {
        studio: restore(state.studio, next),
        past: [...state.past, state.studio.scene],
        future: state.future.slice(1),
        coalesceKey: null,
      };
    }
    case 'checkpoint':
      return state.coalesceKey === null ? state : { ...state, coalesceKey: null };
    case 'documentLoaded':
      return initialEditorState({
        scene: action.scene,
        screens: action.screens,
        selectedLayerId: action.scene.layers.at(-1)?.id ?? null,
      });
    case 'sceneIdentityChanged': {
      const rekey = (scene: Scene): Scene => ({ ...scene, id: action.id });
      return {
        ...state,
        studio: { ...state.studio, scene: { ...rekey(state.studio.scene), name: action.name } },
        past: state.past.map(rekey),
        future: state.future.map(rekey),
      };
    }
    default: {
      const studio = studioReducer(state.studio, action);
      if (studio === state.studio) return state;
      if (NOT_EDITS.has(action.type) || sameScene(studio.scene, state.studio.scene)) {
        return { ...state, studio };
      }
      const key = coalesceKeyOf(action);
      if (key !== null && key === state.coalesceKey) {
        // Same gesture: replace the present without adding an undo step.
        return { ...state, studio, future: [] };
      }
      return {
        studio,
        past: [...state.past, state.studio.scene].slice(-HISTORY_LIMIT),
        future: [],
        coalesceKey: key,
      };
    }
  }
}

export const canUndo = (state: EditorState) => state.past.length > 0;
export const canRedo = (state: EditorState) => state.future.length > 0;
