import { describe, expect, it } from 'vitest';
import { buildPyramid, compositeScreen, scaleShadow, type BakedView, type RgbaImage } from './composite';
import { applyHomography, invertMat3, solveHomography } from './homography';

function image(
  width: number,
  height: number,
  fill: (x: number, y: number) => [number, number, number],
): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1)
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = fill(x, y);
      data.set([r, g, b, 255], (y * width + x) * 4);
    }
  return { width, height, data };
}

const pixel = (img: RgbaImage, x: number, y: number) =>
  Array.from(img.data.slice((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));

const quadrants = (w: number, h: number) =>
  image(w, h, (x, y) =>
    y < h / 2 ? (x < w / 2 ? [255, 0, 0] : [0, 255, 0]) : x < w / 2 ? [0, 0, 255] : [255, 255, 0],
  );

function view(
  size: number,
  corners: BakedView['corners'],
  beautyColour: [number, number, number] = [10, 10, 10],
): BakedView {
  const beauty = image(size, size, () => beautyColour);
  const mask = new Uint8ClampedArray(size * size);
  // Full coverage inside the corners' bounding box (tests use axis-aligned or near-axis quads).
  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);
  for (let y = Math.ceil(Math.min(...ys)); y < Math.floor(Math.max(...ys)); y += 1)
    for (let x = Math.ceil(Math.min(...xs)); x < Math.floor(Math.max(...xs)); x += 1)
      mask[y * size + x] = 255;
  return { beauty, mask, corners };
}

describe('homography', () => {
  it('maps the four corners exactly and inverts', () => {
    const src = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 200 },
      { x: 0, y: 200 },
    ];
    const dst = [
      { x: 10, y: 20 },
      { x: 90, y: 30 },
      { x: 80, y: 190 },
      { x: 15, y: 170 },
    ];
    const h = solveHomography(src, dst);
    dst.forEach((d, i) => {
      const p = applyHomography(h, src[i]!);
      expect(p.x).toBeCloseTo(d.x, 9);
      expect(p.y).toBeCloseTo(d.y, 9);
    });
    const back = applyHomography(invertMat3(h), applyHomography(h, { x: 37, y: 121 }));
    expect(back.x).toBeCloseTo(37, 9);
    expect(back.y).toBeCloseTo(121, 9);
  });

  it('rejects degenerate corners', () => {
    const line = [0, 1, 2, 3].map((i) => ({ x: i, y: i }));
    expect(() => solveHomography(line, line)).toThrow(/collinear/);
  });
});

describe('compositeScreen', () => {
  it('reproduces screenshot pixels exactly at 1:1 with no glare', () => {
    const screen = image(40, 80, (x, y) => [x * 6, y * 3, (x + y) % 256]);
    const result = compositeScreen(
      view(100, [
        { x: 10, y: 10 },
        { x: 50, y: 10 },
        { x: 50, y: 90 },
        { x: 10, y: 90 },
      ]),
      buildPyramid(screen),
    );
    for (const [x, y] of [
      [0, 0],
      [17, 33],
      [39, 79],
    ] as const) {
      expect(pixel(result, 10 + x, 10 + y).slice(0, 3)).toEqual(pixel(screen, x, y).slice(0, 3));
    }
  });

  it('keeps orientation through a perspective warp', () => {
    const result = compositeScreen(
      view(200, [
        { x: 40, y: 20 },
        { x: 150, y: 35 },
        { x: 140, y: 180 },
        { x: 50, y: 170 },
      ]),
      buildPyramid(quadrants(100, 200)),
    );
    expect(pixel(result, 70, 60).slice(0, 3)).toEqual([255, 0, 0]);
    expect(pixel(result, 120, 60).slice(0, 3)).toEqual([0, 255, 0]);
    expect(pixel(result, 75, 150).slice(0, 3)).toEqual([0, 0, 255]);
    expect(pixel(result, 120, 150).slice(0, 3)).toEqual([255, 255, 0]);
  });

  it('leaves every pixel outside the screen mask untouched', () => {
    const v = view(
      60,
      [
        { x: 10, y: 10 },
        { x: 30, y: 10 },
        { x: 30, y: 50 },
        { x: 10, y: 50 },
      ],
      [33, 66, 99],
    );
    const result = compositeScreen(v, buildPyramid(quadrants(20, 40)));
    for (let i = 0; i < 60 * 60; i += 1)
      if (v.mask[i] === 0) expect(Array.from(result.data.slice(i * 4, i * 4 + 4))).toEqual([33, 66, 99, 255]);
  });

  it('averages detail when minifying instead of aliasing', () => {
    // One-pixel stripes squeezed 8x must come out grey, not as random black or white.
    const stripes = image(256, 256, (x) => (x % 2 ? [255, 255, 255] : [0, 0, 0]));
    const result = compositeScreen(
      view(64, [
        { x: 0, y: 0 },
        { x: 32, y: 0 },
        { x: 32, y: 32 },
        { x: 0, y: 32 },
      ]),
      buildPyramid(stripes),
    );
    const value = pixel(result, 16, 16)[0]!;
    expect(value).toBeGreaterThan(110);
    expect(value).toBeLessThan(145);
  });

  it('adds cover-glass reflections only when glare is requested', () => {
    const corners = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ] as const;
    const screen = buildPyramid(image(10, 10, () => [100, 100, 100]));
    const reflective = view(10, corners, [40, 40, 40]);
    expect(pixel(compositeScreen(reflective, screen, 0), 5, 5)[0]).toBe(100);
    expect(pixel(compositeScreen(reflective, screen, 0.5), 5, 5)[0]).toBe(120);
  });

  it('is deterministic', () => {
    const v = view(80, [
      { x: 10, y: 5 },
      { x: 70, y: 12 },
      { x: 66, y: 75 },
      { x: 14, y: 70 },
    ]);
    const pyramid = buildPyramid(quadrants(50, 100));
    expect(compositeScreen(v, pyramid).data).toEqual(compositeScreen(v, pyramid).data);
  });
});

describe('compositeScreen sampling', () => {
  // A non-power-of-two (about 3.3x), slightly rotated minification: the case plain trilinear
  // handles worst. (At exact powers of two trilinear is already a perfect box filter.)
  const corners = [
    { x: 1.5, y: 0.5 },
    { x: 39.8, y: 2.1 },
    { x: 38.2, y: 39.9 },
    { x: 0.4, y: 38.6 },
  ] as const;
  // A fine checkerboard and a sharp edge.
  const detail = image(128, 128, (x, y) =>
    x < 64 ? ((x + y) % 2 ? [255, 255, 255] : [0, 0, 0]) : [200, 30, 30],
  );

  it('measures both sampling methods against an 8x8 reference on worst-case detail', () => {
    const pyramid = buildPyramid(detail);
    const reference = compositeScreen(view(41, corners), pyramid, 0, { samples: 8, fixedLevel: 0 });
    const error = (samples: number) => {
      const result = compositeScreen(view(41, corners), pyramid, 0, { samples });
      let total = 0;
      for (let i = 0; i < result.data.length; i += 4)
        for (let c = 0; c < 3; c += 1) total += Math.abs(result.data[i + c]! - reference.data[i + c]!);
      return total / (41 * 41 * 3);
    };
    // A one-pixel checkerboard is the aliasing worst case: plain trilinear wins here because
    // 2x2 subsamples read finer mip levels. Real UI is measured in the browser gate.
    expect(error(1)).toBeLessThan(1);
    expect(error(1)).toBeLessThan(error(2));
  });
});

describe('scaleShadow', () => {
  // Four pixels: device (opaque, matte 255), device edge (alpha 200, matte 180), shadow (alpha 120), empty.
  const beauty: RgbaImage = {
    width: 4,
    height: 1,
    data: new Uint8ClampedArray([200, 200, 200, 255, 90, 90, 90, 200, 0, 0, 0, 120, 0, 0, 0, 0]),
  };
  const matte = new Uint8ClampedArray([255, 180, 0, 0]);

  it('leaves the render unchanged at strength 1', () => {
    expect(scaleShadow(beauty, matte, 1).data).toEqual(beauty.data);
  });

  it('scales only the alpha above the device matte', () => {
    const half = scaleShadow(beauty, matte, 0.5).data;
    expect(half[3]).toBe(255);
    expect(half[7]).toBe(190);
    expect(half[11]).toBe(60);
    expect(Array.from(half.slice(0, 3))).toEqual([200, 200, 200]);
  });

  it('removes the shadow entirely at strength 0 while keeping the device', () => {
    const none = scaleShadow(beauty, matte, 0).data;
    expect([none[3], none[7], none[11], none[15]]).toEqual([255, 180, 0, 0]);
  });
});
