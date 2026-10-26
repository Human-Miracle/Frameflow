import { FRAMEFLOW_PHONE } from '@/devices/frameflow-phone';
import { getBackgroundPreset, getStylePreset, type StylePreset } from './presets';
import { SCENE_SCHEMA_VERSION, type DeviceLayer, type Scene, type Transform } from './schema';

export interface TemplateSlot {
  id: string;
  name: string;
  transform: Transform;
}

export interface Template {
  id: string;
  label: string;
  description: string;
  defaultStyleId: StylePreset['id'];
  /** Bottom to top. */
  slots: readonly TemplateSlot[];
}

export const TEMPLATES: readonly Template[] = [
  {
    id: 'single-hero',
    label: 'Single Hero',
    description: 'One large phone, straight on.',
    defaultStyleId: 'minimal',
    slots: [{ id: 'hero', name: 'Phone', transform: { x: 0.5, y: 0.5, height: 0.82, rotation: 0 } }],
  },
  {
    id: 'trio-stack',
    label: 'Cinematic Stack',
    description: 'Three overlapping phones with depth.',
    defaultStyleId: 'cinematic',
    slots: [
      { id: 'left', name: 'Left phone', transform: { x: 0.355, y: 0.53, height: 0.74, rotation: -6 } },
      { id: 'right', name: 'Right phone', transform: { x: 0.645, y: 0.53, height: 0.74, rotation: 6 } },
      { id: 'center', name: 'Front phone', transform: { x: 0.5, y: 0.5, height: 0.84, rotation: 0 } },
    ],
  },
];

export const DEFAULT_CANVAS = { width: 3840, height: 2160 } as const;

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((template) => template.id === id);
}

function requireStyle(id: string): StylePreset {
  const style = getStylePreset(id);
  if (!style) throw new Error(`Unknown style preset "${id}"`);
  return style;
}

function requireTemplate(id: string): Template {
  const template = getTemplate(id);
  if (!template) throw new Error(`Unknown template "${id}"`);
  return template;
}

function layersFor(
  template: Template,
  style: StylePreset,
  screens: readonly (string | null)[],
): DeviceLayer[] {
  return template.slots.map((slot, index) => ({
    kind: 'device',
    id: slot.id,
    name: slot.name,
    deviceAssetId: FRAMEFLOW_PHONE.id,
    finish: style.finish,
    screen: { assetId: screens[index] ?? screens[0] ?? null, fit: 'cover', anchor: 'top' },
    transform: { ...slot.transform },
    visible: true,
    locked: false,
  }));
}

export function createScene(options: {
  id: string;
  templateId: string;
  styleId?: string;
  canvas?: { width: number; height: number };
  screenAssetIds?: readonly (string | null)[];
}): Scene {
  const template = requireTemplate(options.templateId);
  const style = requireStyle(options.styleId ?? template.defaultStyleId);
  const background = getBackgroundPreset(style.backgroundPresetId);
  if (!background) throw new Error(`Style "${style.id}" references a missing background`);
  const canvas = options.canvas ?? DEFAULT_CANVAS;

  return {
    schemaVersion: SCENE_SCHEMA_VERSION,
    id: options.id,
    name: template.label,
    templateId: template.id,
    styleId: style.id,
    canvas: { width: canvas.width, height: canvas.height, colorSpace: 'srgb' },
    background: structuredClone(background.background),
    lighting: structuredClone(style.lighting),
    layers: layersFor(template, style, options.screenAssetIds ?? []),
    output: { format: 'png' },
  };
}

/** Switches style while keeping layout, canvas and screen assignments. */
export function applyStyle(scene: Scene, styleId: string): Scene {
  const style = requireStyle(styleId);
  const background = getBackgroundPreset(style.backgroundPresetId);
  if (!background) throw new Error(`Style "${style.id}" references a missing background`);
  return {
    ...scene,
    styleId: style.id,
    background: structuredClone(background.background),
    lighting: structuredClone(style.lighting),
    layers: scene.layers.map((layer) => ({ ...layer, finish: style.finish })),
  };
}

/** Switches layout while keeping style, canvas and the screens already assigned. */
export function applyTemplate(scene: Scene, templateId: string): Scene {
  const template = requireTemplate(templateId);
  const style = requireStyle(scene.styleId);
  // Match slots from the front: the front-most screen stays on the front-most device.
  const fromFront = scene.layers.map((layer) => layer.screen.assetId).reverse();
  const count = template.slots.length;
  const assigned = template.slots.map((_, index) => fromFront[count - 1 - index] ?? fromFront[0] ?? null);
  return {
    ...scene,
    name: template.label,
    templateId: template.id,
    layers: layersFor(template, style, assigned),
  };
}
