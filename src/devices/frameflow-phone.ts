import type { DeviceAsset } from './types';

const SCREEN_WIDTH = 1179;
const SCREEN_HEIGHT = 2556;
const FRAME = 24;
const BEZEL = 44;
const BORDER = FRAME + BEZEL;
const SCREEN_RADIUS = 165;

/**
 * An original phone drawn entirely by the renderer from this geometry. It is
 * modelled on current flagship proportions (19.5:9 screen, pill cutout) but is
 * not a reproduction of any manufacturer's product or artwork.
 */
export const FRAMEFLOW_PHONE: DeviceAsset = {
  id: 'frameflow-phone',
  version: '1.0.0',
  name: 'Frameflow Phone',
  category: 'phone',
  license: {
    kind: 'original',
    holder: 'Frameflow project',
    terms: 'Original vector geometry authored for Frameflow; free to use in exports.',
  },
  source: 'src/devices/frameflow-phone.ts (procedural, no bitmap artwork)',
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
    { side: 'left', y: 520, length: 100, depth: 9 },
    { side: 'left', y: 720, length: 190, depth: 9 },
    { side: 'left', y: 950, length: 190, depth: 9 },
    { side: 'right', y: 800, length: 300, depth: 9 },
  ],
  finishes: ['graphite', 'silver'],
  supportedTransforms: {
    rotationDegrees: { min: -30, max: 30 },
    perspective: false,
  },
  materialNotes:
    'Brushed metal band and gloss black bezel, shaded by the renderer for a key light from the upper left. No perspective views: the 2D renderer supports in-plane rotation only.',
};
