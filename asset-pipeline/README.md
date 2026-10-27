# Device asset pipeline

Produces pre-rendered device views with Blender Cycles (ADR 0011, ADR 0012).
Views are used only by the experimental lab page (`/lab/device-spike`) until
the library passes its quality gate and a decision moves it into Mockup Studio.
The Canvas 2D renderer stays the production renderer and the fallback.

## Libraries

| Library | Device | Pipeline | Script | Views | Output |
|---|---|---|---|---|---|
| v1 (spike) | `frameflow-phone@1.0.0` | 1 | `blender/render_device_v1.py` | `frameflow-phone-v1/views.json` | `public/lab-assets/frameflow-phone/` |
| v2 | `frameflow-phone@2.0.0` | 2.1.0 | `blender/render_device.py` | `frameflow-phone-v2/views.json` | `public/lab-assets/frameflow-phone-v2/` |

## View format (v2)

Each view is a folder `public/lab-assets/<device-id>-v<major>/<view-id>/`:

| File | Format | Purpose |
|---|---|---|
| `beauty.webp` | WebP, lossy colour (quality 92) with lossless alpha, straight alpha | Device and its shadow on transparency. The screen is black cover glass; anything visible there is reflection, available as optional glare. |
| `matte.png` | 8-bit greyscale PNG, same size | Antialiased coverage of the device alone, without its shadow. Alpha above the matte is shadow, which the app scales (shadow strength) without changing the device. |
| `mask.png` | 8-bit greyscale PNG, same size as `beauty.webp` | Antialiased coverage of the visible screen: the rounded aperture minus the cutout and lens, plus any occlusion. |
| `asset.json` | JSON, `formatVersion: 2` | View definition, screen projection, device bounds, gate results, render settings, file sizes, provenance and licence. |

The lossless PNG master of each beauty pass is written to
`asset-pipeline/build/` and is not committed; it can be regenerated.

### Screen projection

`screenCorners` holds the four corners of the screen's full rectangle
(before corner rounding), projected into beauty pixels at sub-pixel
precision, ordered top-left, top-right, bottom-right, bottom-left of the
screenshot. The screen is planar, so mapping the screenshot's rectangle onto
these corners with a homography is exact; the gate measures it. Rounded
corners and the cutout come from `mask.png`, never from the corners.

`deviceBounds` is the projected bounding box of the device body in beauty
pixels. Layouts place a view by centring these bounds on the layer position
and scaling them to the layer height.

### Naming and versioning

-   View IDs are lowercase words joined by hyphens and describe the camera,
    not a template: `front`, `three-quarter-left`, `angle-right`, `steep`.
-   The folder carries the device's major version. A device geometry change
    bumps `deviceAssetVersion` and needs a new folder; views from different
    device versions are never mixed.
-   `pipelineVersion` changes when rendering changes (lighting, materials,
    gates). Re-rendering a view with a new pipeline replaces its files.
-   The loader refuses views whose `deviceAssetVersion` differs from the
    app's device definition, or whose gates did not all pass.

## Orientations

Supported: the curated camera views in `views.json`, each a fixed orbit of
the camera around a device resting on a surface (yaw towards the device's
right side, pitch towards its bottom edge), plus small in-plane rotation of
the whole rendered view when a template tilts a device.

Not supported, intentionally:

-   Continuous rotation. Each angle is a separate offline render, chosen
    because it looks good; free rotation would need real-time rendering,
    which the spike showed falls short in quality and reliability (ADR 0011).
-   Views of the back of the device, and lighting that changes with in-plane
    rotation (large template rotations would rotate the shadow too).

## Quality gate

At render time (`render_device.py`, the view is rejected if any fails):

| Gate | Check | Threshold |
|---|---|---|
| Homography | Blender's UV pass compared with the homography of the projected corners at 20,000 pixels | 99.9th percentile error at most 0.5 screen px |
| Mask | Rendered mask compared with the analytically projected screen polygon minus the cutout and lens, 4x supersampled | Disagreeing pixels (outside antialiased edges) at most 0.01 % of the screen |
| Framing | Device inside the unfeathered area; shadow faded over the outer 8 %; nothing left at the border | Border alpha at most 2 % |
| Size | Longest side | At least 3000 px |
| Matte | Device matte never exceeds the beauty alpha beyond edge noise | Excess (over 10 % alpha) on at most 0.1 % of device pixels |

In the repository's test suites:

-   `src/spikes/baked/library-assets.test.ts`: files present, dimensions and
    sizes match `asset.json`, gates passed, device version, convex screen quad,
    device large enough for 4K exports without upscaling, provenance.
-   `tests/e2e/device-quality.spec.ts`: light, dark and edge-content
    screenshots composited through every view; pixel preservation, edge
    content, rounded-corner masking; export fidelity (PSNR) against an 8×8
    supersampled reference; shadow strength scaling only the shadow.

## Compositing at runtime

-   **Direct**: the beauty pass (with shadow scaled), matte and mask are
    placed at output resolution first; then the screenshot is warped once
    from its full-size source with the exact homography. When minifying, each
    output pixel averages 2×2 trilinear subsamples. Measured against an 8×8
    supersampled reference at 1920 × 1080 this scores 36.1 to 40.6 dB PSNR,
    versus 34.7 to 37.2 dB for the spike's two-step method and 27.3 to
    29.8 dB for plain trilinear.
-   2×2 subsampling can alias one-pixel checkerboard patterns more than plain
    trilinear does (unit test `composite.test.ts`); real UI measured better.
-   Shadow strength defaults to 0.7 of the studio render.
-   With glare at 0, screenshot pixels are resampled but never relit.

## Loading and caching

-   A decoded 1541 × 3200 view takes about 20 MB of memory (RGBA). Load views
    lazily when a layer selects them and keep at most the views in use.
-   The lab loader caches each view once per page session and drops failed
    loads so they can be retried.
-   Before production, serve views from version-stamped paths with long-lived
    `Cache-Control: immutable` headers, or a content hash in the path.
-   Compositing runs per export on the CPU (pure functions in
    `src/spikes/baked/`); it can move to a worker without changes.

## Running it

Requires Node.js and a Python with Blender's `bpy` module and Pillow, in an
isolated virtual environment (authoring tools, not app dependencies):

```bash
python3 -m venv ~/.venvs/blender
~/.venvs/blender/bin/pip install bpy==5.2.3 pillow==12.0.0
BLENDER_PYTHON=~/.venvs/blender/bin/python asset-pipeline/frameflow-phone-v2/render-all.sh            # all views
BLENDER_PYTHON=~/.venvs/blender/bin/python asset-pipeline/frameflow-phone-v2/render-all.sh front      # one view
node asset-pipeline/report.mjs public/lab-assets/frameflow-phone-v2                                    # table of results
```

## Provenance and licensing

All geometry, materials and lighting are original:

-   Geometry: `src/devices/frameflow-phone-v2.ts`, exported by
    `export-geometry.mjs`. Proportions follow current flagship phones; it
    does not reproduce a specific manufacturer's design and must not be
    labelled as one.
-   Materials: procedural Blender shaders defined in the render script.
-   Lighting: procedural area lights and a uniform world colour. No HDR
    images, textures or third-party models.
-   Blender is used as a tool; its licence does not apply to rendered output.

Third-party device renders or models must not be added until their licence
has been checked for redistribution inside a product and for modification.
