import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { readImageHeader } from '@/upload/image-header';
import { fixture, near, samplePng, type Rgba } from './helpers';

/**
 * Device-rendering spike checks. Every rendering path must keep the
 * screenshot's colours and orientation exact, whatever the device angle.
 * Set SPIKE_OUTPUT=<dir> to also save comparison renders and timings.
 */
test.describe.configure({ mode: 'serial', timeout: 180_000 });

const OUTPUT = process.env.SPIKE_OUTPUT;
const timings: Record<string, number> = {};

interface Job {
  name: string;
  renderer: 'canvas-2d' | 'webgl-3d' | 'baked';
  template?: 'single-hero' | 'trio-stack';
  style?: 'minimal' | 'cinematic';
  preset?: 'straight' | 'hero' | 'floating' | 'isometric';
  baked?: string;
  screenshot?: string;
}

async function render(page: Page, job: Job): Promise<Buffer> {
  await page.getByLabel('Screenshot').setInputFiles(fixture(job.screenshot ?? 'light-ui.png'));
  await page.getByRole('combobox', { name: 'Renderer', exact: true }).selectOption(job.renderer);
  await page
    .getByRole('combobox', { name: 'Layout', exact: true })
    .selectOption(job.template ?? 'single-hero');
  await page.getByRole('combobox', { name: 'Style', exact: true }).selectOption(job.style ?? 'minimal');
  if (job.baked) await page.getByLabel(/^Pre-rendered view/).selectOption(job.baked);
  if (job.renderer === 'webgl-3d')
    await page.getByLabel(/^View preset/).selectOption(job.preset ?? 'straight');
  const meta = page.getByTestId('spike-meta');
  const before = (await meta.count()) > 0 ? await meta.textContent() : null;
  await page.getByRole('button', { name: 'Render' }).click();
  if (before === null) await expect(meta).toBeVisible({ timeout: 150_000 });
  else await expect(meta).not.toHaveText(before, { timeout: 150_000 });
  const ms = Number((await meta.textContent())?.match(/(\d+) ms/)?.[1]);
  timings[job.name] = ms;
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('link', { name: 'Download PNG' }).click(),
  ]);
  const bytes = await readFile(await download.path());
  if (OUTPUT) {
    await mkdir(OUTPUT, { recursive: true });
    await writeFile(`${OUTPUT}/${job.name}.png`, bytes);
  }
  return bytes;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/lab/device-spike');
  await expect(page.getByRole('note')).toContainText('not part of Mockup Studio');
});

const QUADRANTS: [number, number, number][] = [
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
  [255, 255, 0],
];

/** Samples the four quadrant centres inside a projected screen quad. */
function quadrantProbes(c: [number, number][]) {
  const lerp = (a: [number, number], b: [number, number], t: number): [number, number] => [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
  ];
  // Bilinear interpolation of the corners is close enough at quadrant centres for a colour check.
  const at = (u: number, v: number) => {
    const [x, y] = lerp(lerp(c[0]!, c[1]!, u), lerp(c[3]!, c[2]!, u), v);
    return { x, y };
  };
  return [at(0.25, 0.3), at(0.75, 0.3), at(0.25, 0.75), at(0.75, 0.75)];
}

test('WebGL path keeps screenshot colours exact (unlit, not tone mapped)', async ({ page }) => {
  const bytes = await render(page, {
    name: 'webgl-quadrants-straight',
    renderer: 'webgl-3d',
    screenshot: 'quadrants.png',
  });
  expect(readImageHeader(new Uint8Array(bytes))).toMatchObject({ width: 1920, height: 1080 });
  // Straight on, the single hero screen spans roughly x 790-1130, y 140-950 at 1920x1080.
  const samples = await samplePng(
    page,
    bytes,
    quadrantProbes([
      [795, 145],
      [1125, 145],
      [1125, 945],
      [795, 945],
    ]),
  );
  samples.forEach((sample, i) => expect(near(sample as Rgba, QUADRANTS[i]!, 4)).toBe(true));
});

test('pre-rendered path keeps screenshot colours exact at an angle', async ({ page, request }) => {
  const meta = await (await request.get('/lab-assets/frameflow-phone/floating-cinematic/asset.json')).json();
  expect(meta.verification.passed).toBe(true);
  expect(meta.license.kind).toBe('original');
  const bytes = await render(page, {
    name: 'baked-quadrants-floating',
    renderer: 'baked',
    baked: 'floating-cinematic',
    screenshot: 'quadrants.png',
  });
  // Map asset pixel corners into the 1920x1080 output the same way the renderer places the device.
  const { deviceBounds: b, screenCorners } = meta as {
    deviceBounds: { x: number; y: number; width: number; height: number };
    screenCorners: [number, number][];
  };
  const scale = (0.82 * 1080) / b.height;
  const place = ([x, y]: [number, number]): [number, number] => [
    0.5 * 1920 - (b.x + b.width / 2) * scale + x * scale,
    0.5 * 1080 - (b.y + b.height / 2) * scale + y * scale,
  ];
  const samples = await samplePng(page, bytes, quadrantProbes(screenCorners.map(place)));
  samples.forEach((sample, i) => expect(near(sample as Rgba, QUADRANTS[i]!, 4)).toBe(true));
});

test('renders every comparison view without errors', async ({ page }) => {
  const jobs: Job[] = [
    { name: '1-current-2d-minimal', renderer: 'canvas-2d', style: 'minimal' },
    {
      name: '2-current-2d-cinematic-stack',
      renderer: 'canvas-2d',
      style: 'cinematic',
      template: 'trio-stack',
    },
    { name: '3-webgl-floating-cinematic', renderer: 'webgl-3d', style: 'cinematic', preset: 'floating' },
    { name: '4-webgl-hero-minimal', renderer: 'webgl-3d', style: 'minimal', preset: 'hero' },
    {
      name: '5-webgl-stack-cinematic',
      renderer: 'webgl-3d',
      style: 'cinematic',
      template: 'trio-stack',
      preset: 'floating',
    },
    { name: '6-baked-floating-cinematic', renderer: 'baked', baked: 'floating-cinematic' },
    { name: '7-baked-floating-minimal', renderer: 'baked', baked: 'floating-minimal' },
    { name: '8-baked-hero-minimal', renderer: 'baked', baked: 'hero-minimal' },
  ];
  for (const job of jobs) {
    const bytes = await render(page, job);
    expect(readImageHeader(new Uint8Array(bytes))).toMatchObject({
      format: 'png',
      width: 1920,
      height: 1080,
    });
  }
  await expect(page.locator('main [role="alert"]')).toHaveCount(0);
  if (OUTPUT) await writeFile(`${OUTPUT}/timings.json`, JSON.stringify(timings, null, 2));
});
