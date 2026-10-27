import { z } from 'zod';

/**
 * asset.json written by asset-pipeline/blender/render_device.py (pipeline v2).
 * Shared by the browser loader and the Node asset-library checks.
 */
const gate = z.object({ passed: z.boolean() }).passthrough();
const point = z.tuple([z.number(), z.number()]);

export const libraryAssetSchema = z.object({
  formatVersion: z.literal(2),
  pipelineVersion: z.string(),
  deviceAssetId: z.string(),
  deviceAssetVersion: z.string(),
  view: z
    .object({
      id: z.string().regex(/^[a-z0-9-]+$/),
      label: z.string(),
      yaw: z.number(),
      pitch: z.number(),
      roll: z.number(),
      fov: z.number(),
      finish: z.enum(['silver', 'graphite']),
      lighting: z.enum(['studio', 'cinematic']),
    })
    .passthrough(),
  image: z.object({
    width: z.number().int().positive(),
    height: z.number().int().positive(),
    beauty: z.literal('beauty.webp'),
    mask: z.literal('mask.png'),
    matte: z.literal('matte.png'),
    beautyBytes: z.number().int().positive(),
    maskBytes: z.number().int().positive(),
    matteBytes: z.number().int().positive(),
    masterPngBytes: z.number().int().positive(),
  }),
  screenCorners: z.tuple([point, point, point, point]),
  deviceBounds: z.object({ x: z.number(), y: z.number(), width: z.number(), height: z.number() }),
  gates: z.object({ homography: gate, mask: gate, framing: gate, size: gate, matte: gate }),
  verification: z.object({ passed: z.boolean() }).passthrough(),
  render: z
    .object({
      blender: z.string(),
      maxSamples: z.number(),
      beautySeconds: z.number(),
      totalSeconds: z.number(),
    })
    .passthrough(),
  provenance: z.object({ thirdPartyAssets: z.array(z.unknown()) }).passthrough(),
  license: z.object({ kind: z.literal('original'), holder: z.string(), terms: z.string() }),
});

export type LibraryAsset = z.infer<typeof libraryAssetSchema>;

/** True only when every quality gate recorded at render time passed. */
export function passedAllGates(asset: LibraryAsset): boolean {
  return asset.verification.passed && Object.values(asset.gates).every((g) => g.passed);
}
