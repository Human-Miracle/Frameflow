# Device asset pipeline (spike)

Produces pre-rendered device views for Frameflow with Blender Cycles. See
ADR 0011 for why this path exists and what it is not yet.

## What a view contains

Each view lives in `public/lab-assets/<device>/<view>/`:

-   `beauty.png`: the device and its shadow on a transparent background.
    The screen is rendered as black cover glass, so anything visible there is
    reflection, which the compositor can add as optional glare.
-   `mask.png`: antialiased coverage of the visible screen. It also handles
    occlusion when another object covers part of the screen.
-   `asset.json`: projected screen corners (sub-pixel), device bounds, the
    view (yaw, pitch, roll, field of view, style, finish), render settings,
    licence, and the measured screen-mapping error.

The screen is flat, so its projection is an exact homography of its four
corners. The script proves this for every view: it renders a UV pass,
compares it with the homography at 20,000 sampled pixels and rejects the
view if the 99.9th percentile error exceeds 0.5 screen pixels. The runtime
loader refuses views that did not pass.

## Running it

Requires Node.js and a Python with Blender's `bpy` module (Blender 5.2 LTS
was used). Install `bpy` in an isolated virtual environment; it is an
authoring tool, not an app dependency.

```bash
python3 -m venv ~/.venvs/blender && ~/.venvs/blender/bin/pip install bpy==5.2.3
BLENDER_PYTHON=~/.venvs/blender/bin/python asset-pipeline/render-all.sh
```

Views are listed in `views.json`. At 1400 × 1400 px and 64 samples a view
took about 2.5 minutes on 4 CPU cores.

## Geometry and licensing

`export-geometry.mjs` exports the outlines from `src/devices/frameflow-phone.ts`,
so the rendered device matches the app's device definition. Everything is
original: procedural geometry, procedural studio lighting, no third-party
models, textures or HDR images. Blender is used as a tool; its licence does
not apply to rendered output.

Third-party device renders or models must not be added until their licence
has been checked for redistribution inside a product and for modification.
