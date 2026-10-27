/**
 * A device asset's geometry is expressed in device units: one unit equals one
 * native screen pixel, so a screenshot at the screen's native resolution maps
 * 1:1 into the aperture. All positions are relative to the body's top-left.
 */
export interface RoundedRect {
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius: number;
}

export interface Cutout {
  kind: 'pill';
  /** Relative to the screen aperture's top-left. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SideButton {
  side: 'left' | 'right';
  /** Distance from the body's top edge to the button's top. */
  y: number;
  length: number;
  /** How far the button protrudes beyond the body edge. */
  depth: number;
}

export type DeviceFinish = 'graphite' | 'silver';

/**
 * Physical detail used by the pre-rendered asset pipeline. Not used by the 2D
 * renderer. Lengths are device units unless noted.
 */
export interface HardwareDetails {
  thickness: number;
  /** Width of the rounded transition between the flat side band and the faces. */
  edgeRadius: number;
  /** Plastic antenna breaks in the metal band. `offset` is from the top (sides) or left (top/bottom). */
  antennaLines: readonly { edge: 'left' | 'right' | 'top' | 'bottom'; offset: number; width: number }[];
  /** Charging port centred on the bottom edge; `height` runs through the device's thickness. */
  bottomPort: { width: number; height: number };
  /** A row of holes on each side of the port. */
  speakerHoles: { diameter: number; spacing: number; count: number; gapFromPort: number };
  /** Front camera lens seen through the first cutout, at its right end. */
  frontLens: { diameter: number };
}

export interface DeviceAsset {
  id: string;
  version: string;
  name: string;
  category: 'phone' | 'tablet' | 'laptop' | 'desktop';
  license: {
    kind: 'original' | 'licensed';
    holder: string;
    terms: string;
  };
  source: string;
  body: RoundedRect;
  /** Width of the metal band between the body edge and the black bezel. */
  frameWidth: number;
  screen: RoundedRect & { nativeWidth: number; nativeHeight: number };
  /** Corner smoothing used for body, bezel and screen paths (0 = circular). */
  cornerSmoothing: number;
  cutouts: readonly Cutout[];
  buttons: readonly SideButton[];
  finishes: readonly DeviceFinish[];
  supportedTransforms: {
    rotationDegrees: { min: number; max: number };
    perspective: false;
  };
  materialNotes: string;
  hardware?: HardwareDetails;
}
