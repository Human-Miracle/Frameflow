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

/**
 * Warps the screen image into the baked view with the exact homography of its
 * corners, sampling a mip pyramid trilinearly, and blends it in by the
 * screen mask. Outside the mask the beauty pass is returned untouched.
 *
 * `glare` adds the cover-glass reflections rendered in the beauty pass on top
 * of the screen; 0 leaves screenshot pixels exactly as sampled.
 */
export function compositeScreen(view: BakedView, pyramid: readonly RgbaImage[], glare = 0): RgbaImage {
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
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const index = y * beauty.width + x;
      const coverage = mask[index]! / 255;
      if (coverage === 0) continue;
      const centre = applyHomography(toScreen, { x: x + 0.5, y: y + 0.5 });
      const right = applyHomography(toScreen, { x: x + 1.5, y: y + 0.5 });
      const down = applyHomography(toScreen, { x: x + 0.5, y: y + 1.5 });
      const footprint = Math.max(
        Math.hypot(right.x - centre.x, right.y - centre.y),
        Math.hypot(down.x - centre.x, down.y - centre.y),
      );
      const lod = Math.min(pyramid.length - 1, Math.max(0, Math.log2(Math.max(1, footprint))));
      const l0 = Math.floor(lod);
      const l1 = Math.min(pyramid.length - 1, l0 + 1);
      const t = lod - l0;
      const s0 = pyramid[l0]!;
      const s1 = pyramid[l1]!;
      bilinear(s0, (centre.x * s0.width) / screen.width, (centre.y * s0.height) / screen.height, low);
      bilinear(s1, (centre.x * s1.width) / screen.width, (centre.y * s1.height) / screen.height, high);
      const o = index * 4;
      for (let c = 0; c < 3; c += 1) {
        const sampled = low[c]! + (high[c]! - low[c]!) * t;
        const base = beauty.data[o + c]!;
        out[o + c] = base * (1 - coverage) + sampled * coverage + glare * coverage * base;
      }
      out[o + 3] = Math.max(beauty.data[o + 3]!, Math.round(coverage * 255));
    }
  }
  return { width: beauty.width, height: beauty.height, data: out };
}
