import type { Background, DeviceLayer, Lighting } from './schema';

export interface BackgroundPreset {
  id: string;
  label: string;
  background: Background;
}

export const BACKGROUND_PRESETS: readonly BackgroundPreset[] = [
  {
    id: 'warm-grey',
    label: 'Warm grey',
    background: {
      presetId: 'warm-grey',
      fill: {
        kind: 'linear',
        angle: 90,
        stops: [
          { offset: 0, color: '#F3F1EE' },
          { offset: 1, color: '#E4E1DC' },
        ],
      },
      glows: [],
    },
  },
  {
    id: 'cool-grey',
    label: 'Cool grey',
    background: {
      presetId: 'cool-grey',
      fill: {
        kind: 'linear',
        angle: 90,
        stops: [
          { offset: 0, color: '#EEF0F3' },
          { offset: 1, color: '#DCE0E6' },
        ],
      },
      glows: [],
    },
  },
  {
    id: 'white',
    label: 'White',
    background: { presetId: 'white', fill: { kind: 'solid', color: '#FFFFFF' }, glows: [] },
  },
  {
    id: 'dark-neutral',
    label: 'Dark neutral',
    background: {
      presetId: 'dark-neutral',
      fill: {
        kind: 'linear',
        angle: 90,
        stops: [
          { offset: 0, color: '#26272A' },
          { offset: 1, color: '#1B1C1E' },
        ],
      },
      glows: [],
    },
  },
  {
    id: 'charcoal',
    label: 'Charcoal',
    background: {
      presetId: 'charcoal',
      fill: {
        kind: 'radial',
        cx: 0.5,
        cy: 0.42,
        radius: 0.75,
        stops: [
          { offset: 0, color: '#1C1D21' },
          { offset: 1, color: '#060607' },
        ],
      },
      glows: [{ cx: 0.5, cy: 0.38, radius: 0.32, color: '#8A93B8', opacity: 0.16 }],
    },
  },
  {
    id: 'midnight',
    label: 'Midnight',
    background: {
      presetId: 'midnight',
      fill: {
        kind: 'radial',
        cx: 0.5,
        cy: 0.4,
        radius: 0.8,
        stops: [
          { offset: 0, color: '#121A2E' },
          { offset: 1, color: '#04060B' },
        ],
      },
      glows: [
        { cx: 0.3, cy: 0.25, radius: 0.35, color: '#3D5BFF', opacity: 0.22 },
        { cx: 0.78, cy: 0.8, radius: 0.3, color: '#7A3DFF', opacity: 0.12 },
      ],
    },
  },
  {
    id: 'transparent',
    label: 'Transparent',
    background: { presetId: 'transparent', fill: { kind: 'transparent' }, glows: [] },
  },
];

export interface StylePreset {
  id: 'minimal' | 'cinematic';
  label: string;
  description: string;
  backgroundPresetId: string;
  lighting: Lighting;
  finish: DeviceLayer['finish'];
}

export const STYLE_PRESETS: readonly StylePreset[] = [
  {
    id: 'minimal',
    label: 'Minimal',
    description: 'Neutral backdrop, soft shadow, low visual noise.',
    backgroundPresetId: 'warm-grey',
    finish: 'silver',
    lighting: {
      shadow: { color: '#2A2620', opacity: 0.22, blur: 0.07, offsetX: 0.01, offsetY: 0.03 },
      contactShadow: { opacity: 0.28, blur: 0.012, offsetY: 0.006 },
      frameHighlight: 0.45,
    },
  },
  {
    id: 'cinematic',
    label: 'Cinematic',
    description: 'Near-black stage, deep grounded shadows, rim-lit metal.',
    backgroundPresetId: 'charcoal',
    finish: 'graphite',
    lighting: {
      shadow: { color: '#000000', opacity: 0.7, blur: 0.09, offsetX: 0.02, offsetY: 0.045 },
      contactShadow: { opacity: 0.6, blur: 0.015, offsetY: 0.008 },
      frameHighlight: 0.9,
    },
  },
];

export function getBackgroundPreset(id: string): BackgroundPreset | undefined {
  return BACKGROUND_PRESETS.find((preset) => preset.id === id);
}

export function getStylePreset(id: string): StylePreset | undefined {
  return STYLE_PRESETS.find((preset) => preset.id === id);
}
