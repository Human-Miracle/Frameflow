import { readFile } from 'node:fs/promises';
import type { Download, Page } from '@playwright/test';

export const fixture = (name: string) => new URL(`../fixtures/${name}`, import.meta.url).pathname;

export async function upload(page: Page, ...names: string[]) {
  await page.setInputFiles('#screenshot-input', names.map(fixture));
}

export async function exportPng(page: Page): Promise<{ download: Download; bytes: Buffer }> {
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export PNG' }).click(),
  ]);
  const path = await download.path();
  return { download, bytes: await readFile(path) };
}

export type Rgba = [number, number, number, number];

/** Decodes a PNG in the browser and samples pixels at canvas coordinates. */
export async function samplePng(
  page: Page,
  bytes: Buffer,
  points: { x: number; y: number }[],
): Promise<Rgba[]> {
  return page.evaluate(
    async ({ base64, points }) => {
      // Decoded without fetch(): the app's CSP blocks data: URLs for connections.
      const binary = atob(base64);
      const data = Uint8Array.from(binary, (char) => char.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([data], { type: 'image/png' }));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(bitmap, 0, 0);
      return points.map(
        ({ x, y }) => Array.from(ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data) as Rgba,
      );
    },
    { base64: bytes.toString('base64'), points },
  );
}

/** Samples the live preview canvas at fractions of its size. */
export async function samplePreview(page: Page, points: { x: number; y: number }[]): Promise<Rgba[]> {
  return page.getByTestId('scene-preview').evaluate((canvas: HTMLCanvasElement, points) => {
    const ctx = canvas.getContext('2d')!;
    return points.map(
      ({ x, y }) =>
        Array.from(
          ctx.getImageData(Math.round(x * canvas.width), Math.round(y * canvas.height), 1, 1).data,
        ) as Rgba,
    );
  }, points);
}

export const near = (actual: Rgba, expected: [number, number, number], tolerance = 12) =>
  actual.slice(0, 3).every((value, index) => Math.abs(value - expected[index]!) <= tolerance);

/** Error messages inside the app (excludes Next.js's empty route announcer). */
export const appAlerts = (page: Page) => page.locator('main [role="alert"]');
