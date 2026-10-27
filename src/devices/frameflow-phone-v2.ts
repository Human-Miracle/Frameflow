import type { DeviceAsset } from './types';

const SCREEN_WIDTH = 1179;
const SCREEN_HEIGHT = 2556;
// One device unit is about 0.055 mm at this screen density. Current flagships
// show roughly 2.7 mm between the display edge and the outside of the frame.
const FRAME = 20;
const BEZEL = 30;
const BORDER = FRAME + BEZEL;
const SCREEN_RADIUS = 165;

/**
 * Second revision of the original Frameflow phone, built for the pre-rendered
 * asset pipeline (ADR 0011): thinner bezel, rounded metal band, antenna lines,
 * port and speaker holes. Proportions follow current flagship phones; it does
 * not reproduce any manufacturer's design or artwork.
 *
 * Not registered with the production device registry until the asset quality
 * gate passes.
 */
export const FRAMEFLOW_PHONE_V2: DeviceAsset = {
  id: 'frameflow-phone',
  version: '2.0.0',
  name: 'Frameflow Phone',
  category: 'phone',
  license: {
    kind: 'original',
    holder: 'Frameflow project',
    terms: 'Original geometry authored for Frameflow; free to use in exports.',
  },
  source: 'src/devices/frameflow-phone-v2.ts (procedural geometry, rendered by asset-pipeline/)',
  body: {
    x: 0,
    y: 0,
    width: SCREEN_WIDTH + BORDER * 2,
    height: SCREEN_HEIGHT + BORDER * 2,
    cornerRadius: SCREEN_RADIUS + BORDER,
  },
  frameWidth: FRAME,
  screen: {
    x: BORDER,
    y: BORDER,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    cornerRadius: SCREEN_RADIUS,
    nativeWidth: SCREEN_WIDTH,
    nativeHeight: SCREEN_HEIGHT,
  },
  cornerSmoothing: 0.6,
  cutouts: [{ kind: 'pill', x: (SCREEN_WIDTH - 378) / 2, y: 33, width: 378, height: 111 }],
  buttons: [
    { side: 'left', y: 470, length: 105, depth: 7 },
    { side: 'left', y: 680, length: 180, depth: 7 },
    { side: 'left', y: 900, length: 180, depth: 7 },
    { side: 'right', y: 760, length: 290, depth: 7 },
  ],
  finishes: ['graphite', 'silver'],
  supportedTransforms: {
    rotationDegrees: { min: -30, max: 30 },
    perspective: false,
  },
  materialNotes:
    'Polished metal band with fine roughness variation, plastic antenna breaks, glossy black cover glass. Perspective views come from pre-rendered assets only.',
  hardware: {
    thickness: 150,
    // Smaller than the frame width, so the cover glass rests on the flat top face.
    edgeRadius: 18,
    antennaLines: [
      { edge: 'left', offset: 300, width: 7 },
      { edge: 'right', offset: 300, width: 7 },
      { edge: 'left', offset: SCREEN_HEIGHT + BORDER * 2 - 300, width: 7 },
      { edge: 'right', offset: SCREEN_HEIGHT + BORDER * 2 - 300, width: 7 },
      { edge: 'top', offset: 360, width: 7 },
      { edge: 'bottom', offset: SCREEN_WIDTH + BORDER * 2 - 360, width: 7 },
    ],
    bottomPort: { width: 165, height: 58 },
    speakerHoles: { diameter: 20, spacing: 34, count: 6, gapFromPort: 120 },
    frontLens: { diameter: 52 },
  },
};
