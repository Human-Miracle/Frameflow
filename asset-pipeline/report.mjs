// Prints a markdown table of a rendered asset library from its asset.json files.
// Usage: node asset-pipeline/report.mjs public/lab-assets/frameflow-phone-v2
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = process.argv[2];
const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;
const rows = readdirSync(root)
  .filter((name) => statSync(join(root, name)).isDirectory())
  .map((id) => JSON.parse(readFileSync(join(root, id, 'asset.json'), 'utf8')))
  .sort((a, b) => Math.abs(a.view.yaw) + a.view.pitch - (Math.abs(b.view.yaw) + b.view.pitch));

console.log(
  '| View | Yaw / pitch / FOV | Size (px) | beauty.webp | mask.png | matte.png | PNG master | Homography p99.9 | Mask mismatch | Gates | Render |',
);
console.log('|---|---|---|---|---|---|---|---|---|---|---|');
for (const a of rows) {
  const g = a.gates;
  const passed = Object.values(g).every((x) => x.passed) ? 'all passed' : 'FAILED';
  console.log(
    `| \`${a.view.id}\` | ${a.view.yaw}° / ${a.view.pitch}° / ${a.view.fov}° | ${a.image.width} × ${a.image.height} | ${kb(a.image.beautyBytes)} | ${kb(a.image.maskBytes)} | ${kb(a.image.matteBytes)} | ${kb(a.image.masterPngBytes)} | ${g.homography.p999ErrorScreenPx} px | ${g.mask.disagreeingPx} px | ${passed} | ${(a.render.totalSeconds / 60).toFixed(1)} min |`,
  );
}
