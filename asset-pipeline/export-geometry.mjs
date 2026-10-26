// Exports a device asset's outlines as polygons for the Blender pipeline, so the
// rendered device is built from the same geometry as the app's renderers.
// Usage: node --experimental-strip-types asset-pipeline/export-geometry.mjs <out.json>
import { writeFile } from 'node:fs/promises';
import { FRAMEFLOW_PHONE as asset } from '../src/devices/frameflow-phone.ts';
import { smoothRoundedRect } from '../src/mockup-engine/paths.ts';

/** Flattens the smoothed rounded-rect path into a polygon (device units, y down). */
function outline(rect, smoothing, inset = 0, steps = 24) {
  const points = [];
  let last = null;
  smoothRoundedRect(
    {
      moveTo: (x, y) => {
        points.push([x, y]);
        last = [x, y];
      },
      lineTo: (x, y) => {
        points.push([x, y]);
        last = [x, y];
      },
      bezierCurveTo: (ax, ay, bx, by, x, y) => {
        const [sx, sy] = last;
        for (let i = 1; i <= steps; i += 1) {
          const t = i / steps;
          const u = 1 - t;
          points.push([
            u * u * u * sx + 3 * u * u * t * ax + 3 * u * t * t * bx + t * t * t * x,
            u * u * u * sy + 3 * u * u * t * ay + 3 * u * t * t * by + t * t * t * y,
          ]);
        }
        last = [x, y];
      },
      closePath: () => {},
    },
    rect,
    smoothing,
    inset,
  );
  // Drop consecutive duplicates (moveTo/lineTo at the same point as a curve end).
  return points.filter(
    (p, i) => i === 0 || Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) > 1e-6,
  );
}

const geometry = {
  id: asset.id,
  version: asset.version,
  body: { width: asset.body.width, height: asset.body.height },
  frameWidth: asset.frameWidth,
  screen: asset.screen,
  bodyOutline: outline(asset.body, asset.cornerSmoothing),
  glassOutline: outline(asset.body, asset.cornerSmoothing, asset.frameWidth * 0.55),
  screenOutline: outline(asset.screen, asset.cornerSmoothing),
  buttons: asset.buttons,
  license: asset.license,
};
await writeFile(process.argv[2], JSON.stringify(geometry));
console.log(`Wrote ${process.argv[2]}: ${geometry.bodyOutline.length} body points`);
