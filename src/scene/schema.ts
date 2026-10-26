import { z } from 'zod';

/**
 * Scene document, schema version 1.
 *
 * A scene is editable source data; rendered images are derived from it.
 * Positions are normalised to the canvas (0..1), device sizes are a fraction of
 * canvas height, and shadow sizes are a fraction of each device's height, so
 * the same scene renders identically at preview and export resolution.
 *
 * Later versions extend the document (text and graphic layers, timeline
 * metadata for Motion Studio) through `migrateScene`, never by reinterpreting
 * version 1 fields.
 */
export const SCENE_SCHEMA_VERSION = 1;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Colours must be 6-digit hex values such as #1A1B1E.');

const unit = z.number().min(0).max(1);

const colorStop = z.object({ offset: unit, color: hexColor });

export const fillSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('transparent') }),
  z.object({ kind: z.literal('solid'), color: hexColor }),
  z.object({
    kind: z.literal('linear'),
    /** Degrees clockwise from "to the right"; 90 runs top to bottom. */
    angle: z.number().min(-360).max(360),
    stops: z.array(colorStop).min(2).max(8),
  }),
  z.object({
    kind: z.literal('radial'),
    cx: unit,
    cy: unit,
    /** Fraction of the canvas diagonal. */
    radius: z.number().gt(0).max(2),
    stops: z.array(colorStop).min(2).max(8),
  }),
]);

/** A soft light pool painted over the fill, behind all layers. */
export const glowSchema = z.object({
  cx: unit,
  cy: unit,
  radius: z.number().gt(0).max(2),
  color: hexColor,
  opacity: unit,
});

export const backgroundSchema = z.object({
  presetId: z.string().max(64).optional(),
  fill: fillSchema,
  glows: z.array(glowSchema).max(4),
});

export const transformSchema = z.object({
  x: z.number().min(-0.5).max(1.5),
  y: z.number().min(-0.5).max(1.5),
  /** Device body height as a fraction of canvas height. */
  height: z.number().min(0.05).max(2),
  rotation: z.number().min(-180).max(180),
});

export const screenAssignmentSchema = z.object({
  /** Stable screen asset ID; never a file path. Null leaves the screen empty. */
  assetId: z.string().min(1).max(128).nullable(),
  fit: z.enum(['cover', 'contain']),
  anchor: z.enum(['top', 'center']),
});

export const deviceLayerSchema = z.object({
  kind: z.literal('device'),
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(80),
  deviceAssetId: z.string().min(1).max(64),
  finish: z.enum(['graphite', 'silver']),
  screen: screenAssignmentSchema,
  transform: transformSchema,
  visible: z.boolean(),
  locked: z.boolean(),
});

export const layerSchema = z.discriminatedUnion('kind', [deviceLayerSchema]);

export const lightingSchema = z.object({
  /** Large soft drop shadow. Sizes are fractions of each device's height. */
  shadow: z.object({
    color: hexColor,
    opacity: unit,
    blur: z.number().min(0).max(0.5),
    offsetX: z.number().min(-0.5).max(0.5),
    offsetY: z.number().min(-0.5).max(0.5),
  }),
  /** Tight shadow that grounds the device. */
  contactShadow: z.object({
    opacity: unit,
    blur: z.number().min(0).max(0.1),
    offsetY: z.number().min(-0.1).max(0.1),
  }),
  /** Strength of the edge highlight on the device frame from the key light. */
  frameHighlight: unit,
});

export const sceneSchema = z.object({
  schemaVersion: z.literal(SCENE_SCHEMA_VERSION),
  id: z.string().min(1).max(64),
  name: z.string().min(1).max(120),
  templateId: z.string().min(1).max(64),
  styleId: z.string().min(1).max(64),
  canvas: z.object({
    width: z.number().int(),
    height: z.number().int(),
    colorSpace: z.literal('srgb'),
  }),
  background: backgroundSchema,
  lighting: lightingSchema,
  /** Paint order: index 0 is drawn first (bottom), the last layer is on top. */
  layers: z.array(layerSchema).min(1).max(16),
  output: z.object({ format: z.literal('png') }),
});

export type Fill = z.infer<typeof fillSchema>;
export type Glow = z.infer<typeof glowSchema>;
export type Background = z.infer<typeof backgroundSchema>;
export type Transform = z.infer<typeof transformSchema>;
export type ScreenAssignment = z.infer<typeof screenAssignmentSchema>;
export type DeviceLayer = z.infer<typeof deviceLayerSchema>;
export type Layer = z.infer<typeof layerSchema>;
export type Lighting = z.infer<typeof lightingSchema>;
export type Scene = z.infer<typeof sceneSchema>;
