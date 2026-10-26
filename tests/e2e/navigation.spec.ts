import { expect, test } from '@playwright/test';

test('home links to both workspaces', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('link', { name: /Create mockup/ }).click();
  await expect(page).toHaveURL(/\/mockup$/);
  await expect(page.getByRole('button', { name: 'Export PNG' })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Primary' })
    .getByRole('link', { name: 'Motion Studio' })
    .click();
  await expect(page).toHaveURL(/\/motion$/);
});

test('Motion Studio says recording is unavailable and offers no working recorder', async ({ page }) => {
  await page.goto('/motion');
  await expect(page.getByRole('status')).toContainText('Recording is not available yet');
  await expect(page.getByRole('button', { name: 'Start recording' })).toBeDisabled();
});
