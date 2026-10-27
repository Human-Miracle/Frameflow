import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { createScene } from '@/scene/templates';
import { applyHomography, solveHomography, type Mat3, type Point } from '@/spikes/baked/homography';
import { placement } from '@/spikes/baked/library';
import type { LibraryAsset } from '@/spikes/baked/library-schema';
import { fixture } from './helpers';

/**
 * Asset quality gate for the Frameflow Phone v2 angle library: screenshot
 * compositing must preserve pixels, follow the screen geometry, mask the
 * rounded aperture, keep edge content, and stay sharp when exported.
 * SPIKE_OUTPUT=<dir> also writes the comparison set and measurements.
 */
test.describe.configure({ mode: 'serial', timeout: 300_000 });

const OUTPUT = process.env.SPIKE_OUTPUT;
const views: { id: string }[] = JSON.parse(
  readFileSync(new URL('../../asset-pipeline/frameflow-phone-v2/views.json', import.meta.url), 'utf8'),
);
const NATIVE = { width: 1179, height: 2556 };
// Cutout and lens in native px, widened by its antialiased edge at the smallest tested scale (~3 px).
const CUTOUT = { x0: 392, x1: 788, y0: 25, y1: 152 };
const measurements: Record<string, unknown> = {};

interface Job {
  renderer: 'canvas-2d' | 'baked' | 'library';
  template?: 'single-hero' | 'trio-stack';
  style?: 'minimal' | 'cinematic';
  views?: Record<string, string>;
  baked?: string;
  screenshot: string;
  size?: '1920x1080' | '3840x2160';
  mode?: 'direct' | 'direct-trilinear' | 'two-step' | 'reference';
  shadow?: number;
}

async function render(page: Page, job: Job, name?: string): Promise<Buffer> {
  const combo = (label: string) => page.getByRole('combobox', { name: label, exact: true });
  await page.getByLabel('Screenshot').setInputFiles(fixture(job.screenshot));
  await combo('Renderer').selectOption(job.renderer);
  await combo('Layout').selectOption(job.template ?? 'single-hero');
  await combo('Style').selectOption(job.style ?? 'minimal');
  await combo('Size').selectOption(job.size ?? '1920x1080');
  if (job.baked) await page.getByLabel(/^Pre-rendered view/).selectOption(job.baked);
  for (const [slot, id] of Object.entries(job.views ?? {}))
    await combo(`Library view: ${slot}`).selectOption(id);
  if (job.renderer === 'library') {
    await combo('Screen compositing').selectOption(job.mode ?? 'direct');
    await page.getByLabel(/^Shadow strength/).fill(String(job.shadow ?? 0.7));
  }
  const meta = page.getByTestId('spike-meta');
  const before = (await meta.count()) > 0 ? await meta.textContent() : null;
  await page.getByRole('button', { name: 'Render' }).click();
  if (before === null) await expect(meta).toBeVisible({ timeout: 120_000 });
  else await expect(meta).not.toHaveText(before, { timeout: 120_000 });
  await expect(page.locator('main [role="alert"]')).toHaveCount(0);
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Download PNG' }).click(),
  ]);
  const bytes = await readFile(await download.path());
  if (name) {
    const ms = Number((await meta.textContent())?.match(/(\d+) ms/)?.[1]);
    ((measurements.renderMilliseconds ??= {}) as Record<string, number>)[name] = ms;
  }
  if (OUTPUT && name) {
    await mkdir(OUTPUT, { recursive: true });
    await writeFile(`${OUTPUT}/${name}.png`, bytes);
  }
  return bytes;
}

/** Native screenshot pixel -> output pixel, exactly as the library renderer places a single-hero view. */
function mapper(asset: LibraryAsset, size: { width: number; height: number }) {
  const layer = createScene({ id: 'q', templateId: 'single-hero' }).layers[0]!;
  const toAsset = solveHomography(
    [
      { x: 0, y: 0 },
      { x: NATIVE.width, y: 0 },
      { x: NATIVE.width, y: NATIVE.height },
      { x: 0, y: NATIVE.height },
    ],
    asset.screenCorners.map(([x, y]) => ({ x, y })),
  );
  const place: Mat3 = placement(layer, asset, size);
  return (p: Point) => applyHomography(place, applyHomography(toAsset, p));
}

interface Probe {
  source: Point;
  output: Point;
  radius: number;
}

/** Decodes both PNGs in the page and returns, per probe, the output pixel and the source min/max in its footprint. */
async function probe(page: Page, output: Buffer, source: Buffer, probes: Probe[]) {
  return page.evaluate(
    async ({ outputB64, sourceB64, probes }) => {
      const decode = async (b64: string) => {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(bitmap, 0, 0);
        return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
      };
      const out = await decode(outputB64);
      const src = await decode(sourceB64);
      return probes.map(({ source, output, radius }) => {
        const ox = Math.floor(output.x);
        const oy = Math.floor(output.y);
        const o = (oy * out.width + ox) * 4;
        const pixel = [out.data[o]!, out.data[o + 1]!, out.data[o + 2]!, out.data[o + 3]!];
        const min = [255, 255, 255];
        const max = [0, 0, 0];
        for (let y = Math.floor(source.y - radius); y <= Math.ceil(source.y + radius); y += 1)
          for (let x = Math.floor(source.x - radius); x <= Math.ceil(source.x + radius); x += 1) {
            const cx = Math.min(src.width - 1, Math.max(0, x));
            const cy = Math.min(src.height - 1, Math.max(0, y));
            const i = (cy * src.width + cx) * 4;
            for (let c = 0; c < 3; c += 1) {
              min[c] = Math.min(min[c]!, src.data[i + c]!);
              max[c] = Math.max(max[c]!, src.data[i + c]!);
            }
          }
        return { pixel, min, max };
      });
    },
    { outputB64: output.toString('base64'), sourceB64: source.toString('base64'), probes },
  );
}

async function asset(page: Page, id: string): Promise<LibraryAsset> {
  return (await page.request.get(`/lab-assets/frameflow-phone-v2/${id}/asset.json`)).json();
}

/** PSNR (dB) between two PNGs over a rectangle, on RGB. */
async function psnr(
  page: Page,
  a: Buffer,
  b: Buffer,
  rect: { x: number; y: number; width: number; height: number },
) {
  return page.evaluate(
    async ({ a64, b64, rect }) => {
      const decode = async (b64: string) => {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(bitmap, 0, 0);
        return ctx.getImageData(rect.x, rect.y, rect.width, rect.height).data;
      };
      const [da, db] = await Promise.all([decode(a64), decode(b64)]);
      let squared = 0;
      for (let i = 0; i < da.length; i += 4)
        for (let c = 0; c < 3; c += 1) squared += (da[i + c]! - db[i + c]!) ** 2;
      const mse = squared / ((da.length / 4) * 3);
      return mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse);
    },
    { a64: a.toString('base64'), b64: b.toString('base64'), rect },
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto('/lab/device-spike');
});

for (const view of views) {
  test(`view ${view.id}: preserves light, dark and edge screenshots and masks the aperture`, async ({
    page,
  }) => {
    const meta = await asset(page, view.id);
    for (const screenshot of ['light-ui.png', 'dark-ui.png', 'edge-content.png']) {
      const size =
        screenshot === 'edge-content.png' ? { width: 3840, height: 2160 } : { width: 1920, height: 1080 };
      const output = await render(page, {
        renderer: 'library',
        views: { hero: view.id },
        screenshot,
        size: `${size.width}x${size.height}` as Job['size'],
      });
      const toOutput = mapper(meta, size);
      // Output pixels per source pixel, for the sampling footprint.
      const scale =
        Math.hypot(
          toOutput({ x: NATIVE.width, y: 0 }).x - toOutput({ x: 0, y: 0 }).x,
          toOutput({ x: NATIVE.width, y: 0 }).y - toOutput({ x: 0, y: 0 }).y,
        ) / NATIVE.width;
      // Trilinear minification blends texels from the next mip level, so a sample can draw on
      // source pixels up to about 2.5 / scale away; the expected range covers that support.
      const radius = Math.max(1.5, 2.5 / scale + 1);

      // 1. Interior fidelity: every probe lies within the source range under its footprint.
      const interior: Probe[] = [];
      for (let i = 0; i < 20; i += 1)
        for (let j = 0; j < 30; j += 1) {
          const source = {
            x: (0.06 + (0.88 * i) / 19) * NATIVE.width,
            y: (0.04 + (0.92 * j) / 29) * NATIVE.height,
          };
          if (source.x > CUTOUT.x0 && source.x < CUTOUT.x1 && source.y < CUTOUT.y1 + 8) continue;
          interior.push({ source, output: toOutput(source), radius });
        }
      const samples = await probe(page, output, await readFile(fixture(screenshot)), interior);
      const failures = samples.filter(
        (s) =>
          s.pixel.slice(0, 3).some((v, c) => v < s.min[c]! - 8 || v > s.max[c]! + 8) || s.pixel[3] !== 255,
      );
      expect(
        failures.length,
        `${view.id}/${screenshot}: ${failures.length} of ${samples.length} probes outside the source range`,
      ).toBe(0);

      if (screenshot === 'edge-content.png') {
        // 2. Edge content survives: the 6 px magenta border shows mid-edge on all four sides.
        const edges = [
          { x: 3, y: NATIVE.height / 2 },
          { x: NATIVE.width - 3, y: NATIVE.height / 2 },
          { x: NATIVE.width * 0.25, y: 3 },
          { x: NATIVE.width / 2, y: NATIVE.height - 3 },
        ].map((source) => ({ source, output: toOutput(source), radius: 0 }));
        const [left, right, top, bottom] = await probe(
          page,
          output,
          await readFile(fixture(screenshot)),
          edges,
        );
        for (const [name, s] of Object.entries({ left, right, top, bottom })) {
          const [r, g, b] = s!.pixel;
          expect(
            r! > 150 && g! < 110 && b! > 150,
            `${view.id}: magenta edge border missing on the ${name} edge (${s!.pixel})`,
          ).toBe(true);
        }
        // 3. Rounded corners are masked: screenshot pixels outside the rounded aperture never show.
        const corners = [
          { x: 10, y: 10 },
          { x: NATIVE.width - 10, y: 10 },
          { x: 10, y: NATIVE.height - 10 },
          { x: NATIVE.width - 10, y: NATIVE.height - 10 },
        ].map((source) => ({ source, output: toOutput(source), radius: 0 }));
        for (const s of await probe(page, output, await readFile(fixture(screenshot)), corners)) {
          const [r, g, b] = s.pixel;
          expect(
            r! > 150 && g! < 110 && b! > 150,
            `${view.id}: screenshot visible outside the rounded corner`,
          ).toBe(false);
        }
      }
    }
  });
}

test('export scaling: screen fidelity against an 8x8 supersampled reference', async ({ page }) => {
  const results: Record<string, Record<string, number>> = {};
  for (const id of ['front', 'angle-left']) {
    const meta = await asset(page, id);
    const toOutput = mapper(meta, { width: 1920, height: 1080 });
    const a = toOutput({ x: NATIVE.width * 0.08, y: NATIVE.height * 0.1 });
    const b = toOutput({ x: NATIVE.width * 0.92, y: NATIVE.height * 0.9 });
    const rect = {
      x: Math.round(Math.min(a.x, b.x)),
      y: Math.round(Math.min(a.y, b.y)),
      width: Math.round(Math.abs(b.x - a.x)),
      height: Math.round(Math.abs(b.y - a.y)),
    };
    for (const screenshot of ['light-ui.png', 'edge-content.png']) {
      const run = (mode: Job['mode']) =>
        render(page, { renderer: 'library', views: { hero: id }, screenshot, mode });
      const reference = await run('reference');
      const scores: Record<string, number> = {};
      for (const mode of ['direct', 'direct-trilinear', 'two-step'] as const) {
        scores[mode] = Number((await psnr(page, await run(mode), reference, rect)).toFixed(2));
      }
      results[`${id}/${screenshot}`] = scores;
      // The chosen method must beat both alternatives and stay close to the reference.
      expect(scores.direct!, JSON.stringify(scores)).toBeGreaterThan(scores['two-step']!);
      expect(scores.direct!, JSON.stringify(scores)).toBeGreaterThan(scores['direct-trilinear']!);
      expect(scores.direct!, JSON.stringify(scores)).toBeGreaterThanOrEqual(35);
    }
  }
  console.log(JSON.stringify(results));
  measurements.psnrAgainstReference1080p = results;
  if (OUTPUT) {
    await mkdir(OUTPUT, { recursive: true });
    await writeFile(`${OUTPUT}/measurements.json`, JSON.stringify(measurements, null, 2));
  }
});

test('shadow strength scales only the shadow: 0 leaves pure background, the device is untouched', async ({
  page,
}) => {
  const meta = await asset(page, 'angle-left');
  const size = { width: 1920, height: 1080 };
  const layer = createScene({ id: 'q', templateId: 'single-hero' }).layers[0]!;
  const place = placement(layer, meta, size);
  const b = meta.deviceBounds;
  const job: Job = { renderer: 'library', views: { hero: 'angle-left' }, screenshot: 'light-ui.png' };
  const none = await render(page, { ...job, shadow: 0 });
  const full = await render(page, { ...job, shadow: 1 });
  // The Minimal background varies only from top to bottom, so x = 4 in the same row is the
  // reference background colour for any point outside the device.
  const outside = [0.15, 0.35, 0.6, 0.85, 1.0].map((t) =>
    applyHomography(place, { x: b.x + b.width + 40, y: b.y + b.height * t }),
  );
  const below = [0.2, 0.5, 0.8].map((t) =>
    applyHomography(place, { x: b.x + b.width * t, y: b.y + b.height + 30 }),
  );
  const shadowProbes = [...outside, ...below];
  const references = shadowProbes.map((p) => ({ x: 4, y: p.y }));
  const read = async (png: Buffer, points: Point[]) =>
    (
      await probe(
        page,
        png,
        await readFile(fixture('light-ui.png')),
        points.map((output) => ({ source: { x: 0, y: 0 }, output, radius: 0 })),
      )
    ).map((s) => s.pixel);
  const [noneShadow, noneRef, fullShadow] = [
    await read(none, shadowProbes),
    await read(none, references),
    await read(full, shadowProbes),
  ];
  noneShadow.forEach((pixel, i) =>
    pixel
      .slice(0, 3)
      .forEach((v, c) => expect(Math.abs(v - noneRef[i]![c]!), `probe ${i}`).toBeLessThanOrEqual(1)),
  );
  // With full strength at least one probe sits visibly in shadow.
  expect(fullShadow.some((pixel, i) => pixel[0]! < noneRef[i]![0]! - 8)).toBe(true);
  // Device pixels are identical at both strengths.
  const device = [0.3, 0.5, 0.7].map((t) =>
    applyHomography(place, { x: b.x + b.width * 0.5, y: b.y + b.height * t }),
  );
  expect(await read(none, device)).toEqual(await read(full, device));
});

test('comparison set: production, spike, improved model and a three-device composition', async ({ page }) => {
  test.skip(!OUTPUT, 'Set SPIKE_OUTPUT to write the comparison set');
  const jobs: [string, Job][] = [
    ['a-production-2d', { renderer: 'canvas-2d', screenshot: 'light-ui.png' }],
    [
      'b-spike-v1-floating-minimal',
      { renderer: 'baked', baked: 'floating-minimal', screenshot: 'light-ui.png' },
    ],
    [
      'c-v2-three-quarter-right',
      { renderer: 'library', views: { hero: 'three-quarter-right' }, screenshot: 'light-ui.png' },
    ],
    ['d-v2-front', { renderer: 'library', views: { hero: 'front' }, screenshot: 'light-ui.png' }],
    [
      'e-v2-three-device',
      {
        renderer: 'library',
        template: 'trio-stack',
        views: { left: 'angle-right', right: 'angle-left', center: 'three-quarter-right' },
        screenshot: 'light-ui.png',
      },
    ],
  ];
  for (const [name, job] of jobs) {
    await render(page, job, `${name}-1920`);
    await render(page, { ...job, size: '3840x2160' }, `${name}-3840`);
  }
  await writeFile(`${OUTPUT}/measurements.json`, JSON.stringify(measurements, null, 2));
});
