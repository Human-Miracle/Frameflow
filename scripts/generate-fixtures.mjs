// Regenerates tests/fixtures. Run with `npm run fixtures`; the output is committed.
import { writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';
import { darkUi, lightUi, quadrants } from './fixture-pages.mjs';

const out = new URL('../tests/fixtures/', import.meta.url);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 393, height: 852 }, deviceScaleFactor: 3 });

async function shoot(html, name, type = 'png') {
  await page.setContent(html);
  const buffer = await page.screenshot({ type, ...(type === 'jpeg' ? { quality: 92 } : {}) });
  await writeFile(new URL(name, out), buffer);
  return buffer;
}

await shoot(lightUi, 'light-ui.png');
await shoot(darkUi, 'dark-ui.png');
await shoot(quadrants, 'quadrants.png');
await shoot(lightUi, 'light-ui.jpg', 'jpeg');

// WebP via the browser's encoder.
await page.setContent(darkUi);
const png = await page.screenshot({ type: 'png' });
const webpBase64 = await page.evaluate(async (base64) => {
  const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob());
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  canvas.getContext('2d').drawImage(bitmap, 0, 0);
  const blob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.9 });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}, png.toString('base64'));
await writeFile(new URL('dark-ui.webp', out), Buffer.from(webpBase64, 'base64'));

// A screenshot whose shape differs from the device screen (16:9 tall) to exercise cropping.
const wide = await browser.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3 });
await wide.setContent(lightUi);
await writeFile(new URL('tall-16x9.png', out), await wide.screenshot({ type: 'png' }));

// Invalid inputs.
await writeFile(new URL('not-an-image.png', out), 'This is a text file pretending to be a PNG.\n');
const tiny = await browser.newPage({ viewport: { width: 32, height: 32 }, deviceScaleFactor: 1 });
await tiny.setContent('<body style="margin:0;background:#888"></body>');
await writeFile(new URL('too-small.png', out), await tiny.screenshot({ type: 'png' }));

await browser.close();
console.log('Fixtures written to tests/fixtures');
