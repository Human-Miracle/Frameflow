import { applyHomography, invertMat3, solveHomography, type Point } from './homography';

/** 8-bit RGBA pixels, straight alpha, rows top to bottom. */
export interface RgbaImage {
  width: number;
  height: number;
  data: Uint8ClampedArray<ArrayBuffer>;
}

/** A pre-rendered device view: beauty pass, screen coverage mask and projected screen corners. */
export interface BakedView {
  beauty: RgbaImage;
  /** Screen coverage per pixel, 0 to 255. */
  mask: Uint8ClampedArray<ArrayBuffer>;
  /** Screen corners in beauty pixels: top-left, top-right, bottom-right, bottom-left. */
  corners: readonly [Point, Point, Point, Point];
}

/** Halves an opaque image repeatedly with a 2x2 box filter, for minification without aliasing. */
export function buildPyramid(image: RgbaImage): RgbaImage[] {
  const levels = [image];
  let current = image;
  while (current.width > 1 || current.height > 1) {
    const width = Math.max(1, current.width >> 1);
    const height = Math.max(1, current.height >> 1);
    const data = new Uint8ClampedArray(width * height * 4);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const x0 = Math.min(current.width - 1, x * 2);
        const y0 = Math.min(current.height - 1, y * 2);
        const x1 = Math.min(current.width - 1, x0 + 1);
        const y1 = Math.min(current.height - 1, y0 + 1);
        for (let c = 0; c < 4; c += 1) {
          data[(y * width + x) * 4 + c] =
            (current.data[(y0 * current.width + x0) * 4 + c]! +
              current.data[(y0 * current.width + x1) * 4 + c]! +
              current.data[(y1 * current.width + x0) * 4 + c]! +
              current.data[(y1 * current.width + x1) * 4 + c]! +
              2) >>
            2;
        }
      }
    }
    current = { width, height, data };
    levels.push(current);
  }
  return levels;
}

function bilinear(level: RgbaImage, x: number, y: number, out: number[]): void {
  // x, y are in this level's pixel space; pixel centres sit at +0.5.
  const fx = Math.min(level.width - 1, Math.max(0, x - 0.5));
  const fy = Math.min(level.height - 1, Math.max(0, y - 0.5));
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(level.width - 1, x0 + 1);
  const y1 = Math.min(level.height - 1, y0 + 1);
  const tx = fx - x0;
  const ty = fy - y0;
  const d = level.data;
  const i00 = (y0 * level.width + x0) * 4;
  const i10 = (y0 * level.width + x1) * 4;
  const i01 = (y1 * level.width + x0) * 4;
  const i11 = (y1 * level.width + x1) * 4;
  for (let c = 0; c < 3; c += 1) {
    const top = d[i00 + c]! + (d[i10 + c]! - d[i00 + c]!) * tx;
    const bottom = d[i01 + c]! + (d[i11 + c]! - d[i01 + c]!) * tx;
    out[c] = top + (bottom - top) * ty;
  }
}

export interface SamplingOptions {
  /**
   * Subsamples per axis within each output pixel when minifying. 1 is plain
   * trilinear filtering. Higher values read finer mip levels per subsample,
   * which keeps more detail but can let the finest patterns alias.
   */
  samples?: number;
  /** Force a mip level (0 = full resolution) instead of choosing it per sample. Used for reference renders. */
  fixedLevel?: number;
}

/**
 * Warps the screen image into the baked view with the exact homography of its
 * corners, sampling a mip pyramid, and blends it in by the screen mask.
 * Outside the mask the beauty pass is returned untouched.
 *
 * `glare` adds the cover-glass reflections rendered in the beauty pass on top
 * of the screen; 0 leaves screenshot pixels exactly as sampled.
 */
export function compositeScreen(
  view: BakedView,
  pyramid: readonly RgbaImage[],
  glare = 0,
  options: SamplingOptions = {},
): RgbaImage {
  const n = Math.max(1, Math.round(options.samples ?? 1));
  const { beauty, mask, corners } = view;
  const screen = pyramid[0]!;
  const toBeauty = solveHomography(
    [
      { x: 0, y: 0 },
      { x: screen.width, y: 0 },
      { x: screen.width, y: screen.height },
      { x: 0, y: screen.height },
    ],
    corners,
  );
  const toScreen = invertMat3(toBeauty);
  const out = new Uint8ClampedArray(beauty.data);

  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  const minX = Math.max(0, Math.floor(Math.min(...xs)) - 1);
  const maxX = Math.min(beauty.width - 1, Math.ceil(Math.max(...xs)) + 1);
  const minY = Math.max(0, Math.floor(Math.min(...ys)) - 1);
  const maxY = Math.min(beauty.height - 1, Math.ceil(Math.max(...ys)) + 1);

  const low = [0, 0, 0];
  const high = [0, 0, 0];
  const sum = [0, 0, 0];
  const sampleAt = (px: number, py: number, step: number) => {
    const centre = applyHomography(toScreen, { x: px, y: py });
    const right = applyHomography(toScreen, { x: px + step, y: py });
    const down = applyHomography(toScreen, { x: px, y: py + step });
    const footprint = Math.max(
      Math.hypot(right.x - centre.x, right.y - centre.y),
      Math.hypot(down.x - centre.x, down.y - centre.y),
    );
    const lod =
      options.fixedLevel ?? Math.min(pyramid.length - 1, Math.max(0, Math.log2(Math.max(1, footprint))));
    const l0 = Math.floor(lod);
    const l1 = Math.min(pyramid.length - 1, l0 + 1);
    const t = lod - l0;
    const s0 = pyramid[l0]!;
    const s1 = pyramid[l1]!;
    bilinear(s0, (centre.x * s0.width) / screen.width, (centre.y * s0.height) / screen.height, low);
    bilinear(s1, (centre.x * s1.width) / screen.width, (centre.y * s1.height) / screen.height, high);
    for (let c = 0; c < 3; c += 1) sum[c]! += low[c]! + (high[c]! - low[c]!) * t;
  };
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const index = y * beauty.width + x;
      const coverage = mask[index]! / 255;
      if (coverage === 0) continue;
      sum[0] = sum[1] = sum[2] = 0;
      // Subsample only when minifying; at 1:1 or larger a single centre sample keeps pixels exact.
      const centre = applyHomography(toScreen, { x: x + 0.5, y: y + 0.5 });
      const across = applyHomography(toScreen, { x: x + 1.5, y: y + 0.5 });
      const k = Math.hypot(across.x - centre.x, across.y - centre.y) > 1.0001 ? n : 1;
      for (let sy = 0; sy < k; sy += 1)
        for (let sx = 0; sx < k; sx += 1) sampleAt(x + (sx + 0.5) / k, y + (sy + 0.5) / k, 1 / k);
      const o = index * 4;
      for (let c = 0; c < 3; c += 1) {
        const sampled = sum[c]! / (k * k);
        const base = beauty.data[o + c]!;
        out[o + c] = base * (1 - coverage) + sampled * coverage + glare * coverage * base;
      }
      out[o + 3] = Math.max(beauty.data[o + 3]!, Math.round(coverage * 255));
    }
  }
  return { width: beauty.width, height: beauty.height, data: out };
}

/**
 * Scales a pre-rendered shadow without touching the device: alpha above the
 * device matte is shadow and is multiplied by `strength`; the device's own
 * coverage is kept. 1 returns the render as lit; 0 removes the shadow.
 */
export function scaleShadow(
  beauty: RgbaImage,
  matte: Uint8ClampedArray<ArrayBuffer>,
  strength: number,
): RgbaImage {
  const data = new Uint8ClampedArray(beauty.data);
  for (let i = 0; i < matte.length; i += 1) {
    const a = data[i * 4 + 3]!;
    const m = matte[i]!;
    if (a > m) data[i * 4 + 3] = Math.round(m + (a - m) * strength);
  }
  return { width: beauty.width, height: beauty.height, data };
}
