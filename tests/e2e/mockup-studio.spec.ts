import { expect, test } from '@playwright/test';
import { FRAMEFLOW_PHONE as phone } from '@/devices/frameflow-phone';
import { deviceToCanvas, placeDevice } from '@/mockup-engine/geometry';
import { createScene } from '@/scene/templates';
import { readImageHeader } from '@/upload/image-header';
import { appAlerts, exportPng, near, samplePng, samplePreview, upload } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.goto('/mockup');
});

test('screenshot to PNG: upload, preview, export at the configured size', async ({ page }) => {
  const exportButton = page.getByRole('button', { name: 'Export PNG' });
  await expect(exportButton).toBeDisabled();
  await expect(page.getByText(/Assign a screenshot to Phone/)).toBeVisible();

  await upload(page, 'light-ui.png');
  await expect(page.getByRole('list', { name: 'Uploaded screenshots' })).toContainText('1179 × 2556 · PNG');
  await expect(exportButton).toBeEnabled();

  await page.getByLabel('Size', { exact: true }).last().selectOption('fhd');
  const { download, bytes } = await exportPng(page);
  expect(download.suggestedFilename()).toBe('frameflow-single-hero-minimal-1920x1080.png');
  expect(readImageHeader(new Uint8Array(bytes))).toEqual({
    format: 'png',
    width: 1920,
    height: 1080,
    animated: false,
  });
  await expect(page.getByTestId('export-success')).toContainText('1920 × 1080 px');
});

test('places the screenshot exactly inside the screen aperture, the right way up', async ({ page }) => {
  await upload(page, 'quadrants.png');
  await page.getByLabel('Size', { exact: true }).last().selectOption('fhd');
  const { bytes } = await exportPng(page);

  const scene = createScene({ id: 'x', templateId: 'single-hero' });
  const layer = scene.layers[0]!;
  const placement = placeDevice(layer, phone, { width: 1920, height: 1080 });
  const at = (fx: number, fy: number) =>
    deviceToCanvas(
      { x: phone.screen.x + phone.screen.width * fx, y: phone.screen.y + phone.screen.height * fy },
      phone,
      placement,
    );
  const [topLeft, topRight, bottomLeft, bottomRight, justOutside] = await samplePng(page, bytes, [
    at(0.25, 0.3),
    at(0.75, 0.3),
    at(0.25, 0.75),
    at(0.75, 0.75),
    deviceToCanvas({ x: phone.screen.x - 30, y: phone.screen.y + phone.screen.height / 2 }, phone, placement),
  ]);
  expect(near(topLeft!, [255, 0, 0])).toBe(true);
  expect(near(topRight!, [0, 255, 0])).toBe(true);
  expect(near(bottomLeft!, [0, 0, 255])).toBe(true);
  expect(near(bottomRight!, [255, 255, 0])).toBe(true);
  // The bezel just outside the aperture stays dark: the screenshot does not spill out.
  expect(justOutside!.slice(0, 3).every((v) => v < 40)).toBe(true);

  // The cutout is drawn over the screen at its documented position.
  const cutout = phone.cutouts[0]!;
  const [inCutout] = await samplePng(page, bytes, [
    deviceToCanvas(
      { x: phone.screen.x + cutout.x + cutout.width / 2, y: phone.screen.y + cutout.y + cutout.height / 2 },
      phone,
      placement,
    ),
  ]);
  expect(near(inCutout!, [0, 0, 0], 8)).toBe(true);
});

test('minimal and cinematic presets visibly differ', async ({ page }) => {
  await upload(page, 'light-ui.png');
  await page.getByText('Minimal', { exact: true }).click();
  const [minimalCorner] = await samplePreview(page, [{ x: 0.03, y: 0.05 }]);
  await page.getByText('Cinematic', { exact: true }).click();
  await expect.poll(async () => (await samplePreview(page, [{ x: 0.03, y: 0.05 }]))[0]![0]).toBeLessThan(60);
  expect(minimalCorner![0]).toBeGreaterThan(200);
});

test('three-device stack keeps layer order and screen alignment', async ({ page }) => {
  await page.getByText('Cinematic Stack', { exact: true }).click();
  await expect(page.getByRole('list', { name: 'Devices, front to back' }).getByRole('listitem')).toHaveCount(
    3,
  );
  await upload(page, 'quadrants.png');
  // The second screenshot goes to the selected (front) device.
  await upload(page, 'dark-ui.png');
  await page.getByLabel('Size', { exact: true }).last().selectOption('fhd');
  const { bytes } = await exportPng(page);

  const scene = createScene({ id: 'x', templateId: 'trio-stack' });
  const size = { width: 1920, height: 1080 };
  const [left, , front] = scene.layers;
  const leftPlacement = placeDevice(left!, phone, size);
  const frontPlacement = placeDevice(front!, phone, size);
  const [leftTopLeft, overlap] = await samplePng(page, bytes, [
    deviceToCanvas({ x: phone.screen.x + 200, y: phone.screen.y + 700 }, phone, leftPlacement),
    // Inside the front screen's left edge, where the left phone lies underneath.
    deviceToCanvas({ x: phone.screen.x + 60, y: phone.screen.y + 1400 }, phone, frontPlacement),
  ]);
  expect(near(leftTopLeft!, [255, 0, 0])).toBe(true);
  // The front screen (dark UI) covers the left phone's quadrant colours.
  expect(overlap!.slice(0, 3).every((v) => v < 60)).toBe(true);
});

test('supports position, scale and rotation adjustments within the device limits', async ({ page }) => {
  await upload(page, 'light-ui.png');
  const rotation = page.getByLabel('Rotation');
  await expect(rotation).toHaveAttribute('max', '30');
  await rotation.fill('12');
  await expect(page.locator('output', { hasText: '12°' })).toBeVisible();
  await page.getByLabel('Size', { exact: true }).first().fill('0.6');
  await page.getByLabel('Horizontal position').fill('0.35');
  await page.getByText('Midnight').click();
  const { bytes } = await exportPng(page);
  expect(readImageHeader(new Uint8Array(bytes))).toMatchObject({ width: 3840, height: 2160 });
});

test('accepts JPEG and WebP screenshots', async ({ page }) => {
  await upload(page, 'light-ui.jpg', 'dark-ui.webp');
  const list = page.getByRole('list', { name: 'Uploaded screenshots' });
  await expect(list).toContainText('JPEG');
  await expect(list).toContainText('WEBP');
});

test('rejects invalid uploads with an actionable message and recovers', async ({ page }) => {
  await upload(page, 'not-an-image.png');
  await expect(appAlerts(page)).toContainText('not a PNG, JPEG or WebP image');
  await upload(page, 'too-small.png');
  await expect(appAlerts(page)).toContainText('at least 64 px');
  await expect(page.getByRole('button', { name: 'Export PNG' })).toBeDisabled();

  await upload(page, 'light-ui.png');
  await expect(appAlerts(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Export PNG' })).toBeEnabled();
});

test('warns when a screenshot is cropped to fit the screen', async ({ page }) => {
  await upload(page, 'tall-16x9.png');
  await expect(page.getByText(/of this screenshot is cropped/)).toBeVisible();
  await page.getByText('Show all', { exact: true }).click();
  await expect(page.getByText(/of this screenshot is cropped/)).toHaveCount(0);
});
