import { DEVICE_ASSETS } from '@/devices/registry';
import { MAX_SESSION_SCREENS } from '@/domain/limits';
import { getBackgroundPreset } from '@/scene/presets';
import type { DeviceLayer, Scene, ScreenAssignment, Transform } from '@/scene/schema';
import { applyStyle, applyTemplate, createScene } from '@/scene/templates';

/** A decoded screenshot held in memory for this session. */
export interface ScreenEntry {
  id: string;
  name: string;
  format: 'png' | 'jpeg' | 'webp';
  width: number;
  height: number;
  bytes: number;
  bitmap: ImageBitmap;
  thumbnailUrl: string;
}

export interface StudioState {
  scene: Scene;
  screens: ScreenEntry[];
  selectedLayerId: string | null;
}

export type StudioAction =
  | { type: 'screenAdded'; screen: ScreenEntry }
  | { type: 'screenRemoved'; screenId: string }
  | { type: 'templateChanged'; templateId: string }
  | { type: 'styleChanged'; styleId: string }
  | { type: 'backgroundChanged'; presetId: string }
  | { type: 'layerSelected'; layerId: string | null }
  | { type: 'transformChanged'; layerId: string; patch: Partial<Transform> }
  | { type: 'screenAssigned'; layerId: string; screenId: string | null }
  | { type: 'fitChanged'; layerId: string; fit: ScreenAssignment['fit'] }
  | { type: 'visibilityToggled'; layerId: string }
  | { type: 'lockToggled'; layerId: string }
  | { type: 'layoutReset' }
  | { type: 'canvasResized'; width: number; height: number };

const frontLayerId = (scene: Scene): string | null => scene.layers.at(-1)?.id ?? null;

export function initialStudioState(): StudioState {
  const scene = createScene({ id: 'scene-1', templateId: 'single-hero' });
  return { scene, screens: [], selectedLayerId: frontLayerId(scene) };
}

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));

function updateLayer(
  state: StudioState,
  layerId: string,
  update: (layer: DeviceLayer) => DeviceLayer,
): StudioState {
  return {
    ...state,
    scene: {
      ...state.scene,
      layers: state.scene.layers.map((layer) => (layer.id === layerId ? update(layer) : layer)),
    },
  };
}

/** Keeps quick-mode edits inside the schema's ranges and the asset's supported rotation. */
export function clampTransform(layer: DeviceLayer, patch: Partial<Transform>): Transform {
  const next = { ...layer.transform, ...patch };
  const rotation = DEVICE_ASSETS.get(layer.deviceAssetId)?.supportedTransforms.rotationDegrees ?? {
    min: 0,
    max: 0,
  };
  return {
    x: clamp(next.x, 0, 1),
    y: clamp(next.y, 0, 1),
    height: clamp(next.height, 0.2, 1.4),
    rotation: clamp(next.rotation, rotation.min, rotation.max),
  };
}

export function studioReducer(state: StudioState, action: StudioAction): StudioState {
  switch (action.type) {
    case 'screenAdded': {
      if (state.screens.length >= MAX_SESSION_SCREENS) return state;
      const screens = [...state.screens, action.screen];
      const hasEmpty = state.scene.layers.some((layer) => layer.screen.assetId === null);
      const targetId = state.selectedLayerId ?? frontLayerId(state.scene);
      // The first screenshot fills every empty device; later ones go to the selected device.
      const layers = state.scene.layers.map((layer) =>
        (hasEmpty && layer.screen.assetId === null) || (!hasEmpty && layer.id === targetId)
          ? { ...layer, screen: { ...layer.screen, assetId: action.screen.id } }
          : layer,
      );
      return { ...state, screens, scene: { ...state.scene, layers } };
    }
    case 'screenRemoved':
      return {
        ...state,
        screens: state.screens.filter((screen) => screen.id !== action.screenId),
        scene: {
          ...state.scene,
          layers: state.scene.layers.map((layer) =>
            layer.screen.assetId === action.screenId
              ? { ...layer, screen: { ...layer.screen, assetId: null } }
              : layer,
          ),
        },
      };
    case 'templateChanged': {
      if (action.templateId === state.scene.templateId) return state;
      const scene = applyTemplate(state.scene, action.templateId);
      return { ...state, scene, selectedLayerId: frontLayerId(scene) };
    }
    case 'styleChanged':
      return { ...state, scene: applyStyle(state.scene, action.styleId) };
    case 'backgroundChanged': {
      const preset = getBackgroundPreset(action.presetId);
      if (!preset) return state;
      return { ...state, scene: { ...state.scene, background: structuredClone(preset.background) } };
    }
    case 'layerSelected':
      return { ...state, selectedLayerId: action.layerId };
    case 'transformChanged':
      return updateLayer(state, action.layerId, (layer) =>
        layer.locked ? layer : { ...layer, transform: clampTransform(layer, action.patch) },
      );
    case 'screenAssigned':
      return updateLayer(state, action.layerId, (layer) => ({
        ...layer,
        screen: { ...layer.screen, assetId: action.screenId },
      }));
    case 'fitChanged':
      return updateLayer(state, action.layerId, (layer) => ({
        ...layer,
        screen: { ...layer.screen, fit: action.fit },
      }));
    case 'visibilityToggled':
      return updateLayer(state, action.layerId, (layer) => ({ ...layer, visible: !layer.visible }));
    case 'lockToggled':
      return updateLayer(state, action.layerId, (layer) => ({ ...layer, locked: !layer.locked }));
    case 'layoutReset': {
      const reset = applyTemplate(state.scene, state.scene.templateId);
      return { ...state, scene: { ...reset, background: state.scene.background } };
    }
    case 'canvasResized':
      return {
        ...state,
        scene: {
          ...state.scene,
          canvas: { ...state.scene.canvas, width: action.width, height: action.height },
        },
      };
  }
}
