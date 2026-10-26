import { expect, test } from '@playwright/test';
import { exportPng, upload } from './helpers';

/**
 * Golden exports for renderer regressions. Baselines are platform specific
 * (Chromium on Linux). When a change is intended, inspect the new image before
 * updating with `npx playwright test visual --update-snapshots`.
 */
const cases = [
  { name: 'minimal-single-light', template: 'Single Hero', style: 'Minimal', screens: ['light-ui.png'] },
  { name: 'minimal-single-dark', template: 'Single Hero', style: 'Minimal', screens: ['dark-ui.png'] },
  {
    name: 'cinematic-stack',
    template: 'Cinematic Stack',
    style: 'Cinematic',
    screens: ['light-ui.png', 'dark-ui.png'],
  },
  {
    name: 'cinematic-single-cropped',
    template: 'Single Hero',
    style: 'Cinematic',
    screens: ['tall-16x9.png'],
  },
];

for (const scenario of cases) {
  test(`golden export: ${scenario.name}`, async ({ page }) => {
    await page.goto('/mockup');
    await page.getByText(scenario.template, { exact: true }).click();
    await page.getByText(scenario.style, { exact: true }).click();
    await upload(page, scenario.screens[0]!);
    for (const name of scenario.screens.slice(1)) await upload(page, name);
    await page.getByLabel('Size', { exact: true }).last().selectOption('fhd');
    const { bytes } = await exportPng(page);
    expect(bytes).toMatchSnapshot(`${scenario.name}.png`);
  });
}
