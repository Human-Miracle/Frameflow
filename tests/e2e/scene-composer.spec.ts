import { expect, test, type Page } from '@playwright/test';
import { FRAMEFLOW_PHONE as phone } from '@/devices/frameflow-phone';
import { deviceToCanvas, placeDevice } from '@/mockup-engine/geometry';
import { createScene } from '@/scene/templates';
import { appAlerts, exportPng, near, samplePng, upload } from './helpers';

const saveState = (page: Page) => page.getByTestId('save-state');
const deviceNames = async (page: Page) =>
  page
    .getByRole('list', { name: 'Devices, front to back' })
    .locator('li')
    .evaluateAll((items) => items.map((li) => li.querySelector('button span')?.textContent ?? ''));

test.beforeEach(async ({ page }) => {
  await page.goto('/mockup');
});

test('saves a scene and reopens it after a reload with settings and screenshots intact', async ({ page }) => {
  await expect(saveState(page)).toHaveText('Not saved yet');
  await page.getByText('Cinematic Stack', { exact: true }).click();
  await upload(page, 'quadrants.png');
  await upload(page, 'dark-ui.png');
  await page.getByText('Midnight').click();
  await page.getByRole('button', { name: 'Move Front phone backward' }).click();
  await page.getByLabel('Scene name').fill('Launch stack');
  await page.getByLabel('Scene name').press('Enter');
  await page.getByLabel('Size', { exact: true }).last().selectOption('fhd');
  const before = await exportPng(page);

  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(saveState(page)).toHaveText(/^Saved \d/);

  page.on('dialog', (dialog) => void dialog.accept());
  await page.reload();
  await expect(saveState(page)).toHaveText('Not saved yet');
  await page.getByRole('button', { name: 'Open…' }).click();
  const dialog = page.getByRole('dialog', { name: 'Saved scenes' });
  await expect(dialog).toContainText('Launch stack');
  await expect(dialog).toContainText('Cinematic Stack · Minimal · 2 screenshots');
  await dialog.getByRole('button', { name: 'Open Launch stack' }).click();

  await expect(saveState(page)).toHaveText(/^Saved \d/);
  await expect(page.getByLabel('Scene name')).toHaveValue('Launch stack');
  await expect(page.getByRole('radio', { name: /Cinematic Stack/ })).toBeChecked();
  await expect(page.getByRole('radio', { name: 'Midnight' })).toBeChecked();
  const screenshots = page.getByRole('list', { name: 'Uploaded screenshots' });
  await expect(screenshots).toContainText('quadrants.png');
  await expect(screenshots).toContainText('dark-ui.png');
  expect(await deviceNames(page)).toEqual(['Right phone', 'Front phone', 'Left phone']);

  // The reopened scene renders byte-for-byte the same export as before saving.
  const after = await exportPng(page);
  expect(after.download.suggestedFilename()).toBe(before.download.suggestedFilename());
  expect(after.bytes.equals(before.bytes)).toBe(true);
});

test('shows unsaved changes after an edit and saves a copy as a separate scene', async ({ page }) => {
  await upload(page, 'light-ui.png');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(saveState(page)).toHaveText(/^Saved/);
  await page.getByText('Cinematic', { exact: true }).click();
  await expect(saveState(page)).toHaveText('Unsaved changes');
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(saveState(page)).toHaveText(/^Saved/);

  await page.getByRole('button', { name: 'Save as copy' }).click();
  await expect(page.getByLabel('Scene name')).toHaveValue('Single Hero copy');
  await expect(saveState(page)).toHaveText(/^Saved/);
  await page.getByRole('button', { name: 'Open…' }).click();
  const items = page.getByRole('list', { name: 'Saved scenes' }).getByRole('listitem');
  await expect(items).toHaveCount(2);

  page.on('dialog', (dialog) => void dialog.accept());
  await page.getByRole('button', { name: 'Delete Single Hero copy' }).click();
  await expect(items).toHaveCount(1);
  await page.getByRole('button', { name: 'Close' }).click();
  // The open scene was the deleted copy, so it is no longer saved anywhere.
  await expect(saveState(page)).toHaveText('Not saved yet');
});

test('undo and redo with buttons and keyboard shortcuts', async ({ page }) => {
  await upload(page, 'light-ui.png');
  const rotation = page.getByLabel('Rotation');
  await rotation.fill('12');
  await rotation.dispatchEvent('pointerup');
  await page.getByText('Cinematic', { exact: true }).click();

  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('radio', { name: 'Minimal' })).toBeChecked();
  await expect(rotation).toHaveValue('12');
  await page.keyboard.press('Control+z');
  await expect(rotation).toHaveValue('0');
  await page.keyboard.press('Control+Shift+z');
  await expect(rotation).toHaveValue('12');
  await page.getByRole('button', { name: 'Redo' }).click();
  await expect(page.getByRole('radio', { name: 'Cinematic', exact: true })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Redo' })).toBeDisabled();
});

test('layer reordering changes which device is drawn on top', async ({ page }) => {
  await page.getByText('Cinematic Stack', { exact: true }).click();
  await upload(page, 'quadrants.png');
  await upload(page, 'dark-ui.png');
  await page.getByLabel('Size', { exact: true }).last().selectOption('fhd');

  const scene = createScene({ id: 'x', templateId: 'trio-stack' });
  const left = placeDevice(scene.layers[0]!, phone, { width: 1920, height: 1080 });
  // Inside the left phone's screen, in the area the front phone covers by default.
  const probe = deviceToCanvas(
    { x: phone.screen.x + phone.screen.width - 60, y: phone.screen.y + 1500 },
    phone,
    left,
  );

  const [covered] = await samplePng(page, (await exportPng(page)).bytes, [probe]);
  expect(covered!.slice(0, 3).every((v) => v < 60)).toBe(true);

  await page.getByRole('button', { name: 'Move Left phone forward' }).click();
  await page.getByRole('button', { name: 'Move Left phone forward' }).click();
  expect(await deviceNames(page)).toEqual(['Left phone', 'Front phone', 'Right phone']);
  await expect(page.getByRole('button', { name: 'Move Left phone forward' })).toBeDisabled();

  const [onTop] = await samplePng(page, (await exportPng(page)).bytes, [probe]);
  expect(near(onTop!, [255, 255, 0])).toBe(true);
});

test('reports a clear error when the browser blocks storage', async ({ page }) => {
  await page.evaluate(() => {
    Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true });
  });
  await upload(page, 'light-ui.png');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(appAlerts(page)).toContainText('Not saved: This browser does not allow saving scenes');
  await expect(saveState(page)).toHaveText('Not saved yet');
});
