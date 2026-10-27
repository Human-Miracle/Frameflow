# ADR 0012: Device Asset Library v2 and Its Quality Gate

Status: Proposed. Library passes its automated gate; integration into
Mockup Studio awaits the product owner's visual review
Date: 2026-10-27

## Context

ADR 0011 proposed pre-rendered device views with homography compositing.
The spike's device was not yet at the reference quality: bezels about twice
a current phone's, no hardware detail, floating rather than grounded
shadows, 1400 px renders upscaled at 4K, and a screenshot warped at asset
resolution and then rescaled.

## Decision

1.  **Device model v2** (`src/devices/frameflow-phone-v2.ts`): 50-unit
    display border (about 2.75 mm, down from 68 units), rounded metal band
    with fine roughness variation, flush antenna breaks, pill buttons, a
    charging port and speaker holes cut as real geometry, a cover-glass slab
    with a rounded edge, and a cutout with a front lens. It is not added to
    the production device registry; the Canvas 2D renderer and its golden
    images are unchanged and remain the fallback.
2.  **Grounded studio views**: the device rests on a shadow-catching surface
    and the camera orbits it, so every view has contact and cast shadows from
    one soft key light. Highlight strips light only the metal (light
    linking), so they draw rail highlights but never glare across the glass.
3.  **A deliberate angle library** (`asset-pipeline/frameflow-phone-v2/views.json`),
    each view rendered with the longest side at 3200 px.
4.  **Library format v2** as documented in `asset-pipeline/README.md`: WebP
    beauty pass with lossless alpha, 8-bit PNG screen mask, and `asset.json`
    with projection, bounds, gate results, sizes and provenance. Lossless
    masters stay out of the repository.
5.  **Quality gate**: views are rejected at render time unless the
    homography, mask, framing, size and matte checks pass; the test suites then
    check the committed files and composite light, dark and edge-content
    screenshots through every view.
6.  **Direct compositing**: the screenshot is warped once, from the full
    source, at output resolution after the device and mask are placed, with
    2×2 area sampling per output pixel when minifying (chosen by measurement).
    Shadow strength is adjustable through a device matte; default 0.7.
7.  **Continuous rotation is intentionally unsupported.** Users choose among
    curated views; each is an offline render chosen for quality.

## Results (pipeline 2.1.0, 2026-10-27)

Library, from `node asset-pipeline/report.mjs` (also in
`docs/spikes/device-quality/asset-report.md`):

| View | Yaw / pitch / FOV | Size (px) | beauty.webp | mask.png | matte.png | PNG master | Homography p99.9 | Mask mismatch | Gates | Render |
|---|---|---|---|---|---|---|---|---|---|---|
| `front` | 0° / 0° / 16° | 1541 × 3200 | 108 KB | 22 KB | 23 KB | 2168 KB | 0.0031 px | 0 px | all passed | 6.4 min |
| `three-quarter-left` | -20° / 10° / 18° | 1644 × 3200 | 102 KB | 28 KB | 28 KB | 2143 KB | 0.0223 px | 0 px | all passed | 6.2 min |
| `three-quarter-right` | 20° / 10° / 18° | 1644 × 3200 | 119 KB | 28 KB | 28 KB | 2164 KB | 0.024 px | 0 px | all passed | 6.2 min |
| `angle-left` | -34° / 16° / 18° | 1769 × 3200 | 92 KB | 30 KB | 30 KB | 2165 KB | 0.0409 px | 0 px | all passed | 6.5 min |
| `angle-right` | 34° / 16° / 18° | 1769 × 3200 | 124 KB | 30 KB | 30 KB | 2212 KB | 0.0378 px | 0 px | all passed | 6.7 min |
| `steep` | 28° / 52° / 26° | 3200 × 2929 | 181 KB | 36 KB | 36 KB | 3400 KB | 0.023 px | 0 px | all passed | 10.8 min |

All six views passed every render-time gate. The whole library is 1.2 MB
to deliver (WebP beauty, PNG mask and matte); lossless masters are about
2.1 to 3.4 MB each and stay out of the repository.

Screenshot compositing, `tests/e2e/device-quality.spec.ts`, all passing:

-   Light UI, dark UI and edge-content screenshots through every view:
    about 590 interior probes per render, each within the source pixel range
    under its sampling footprint (±8 levels); magenta edge border present
    mid-edge on all four sides at 4K; no screenshot pixels outside the
    rounded aperture. A deliberate 3-pixel misplacement fails this check.
-   Export fidelity against an 8×8 supersampled reference at 1920 × 1080
    (PSNR on the screen region):

    | Case | Direct, 2×2 (chosen) | Two-step (spike) | Direct, trilinear |
    |---|---|---|---|
    | front, light UI | 40.6 dB | 37.2 dB | 29.8 dB |
    | front, edge content | 39.0 dB | 36.4 dB | 28.6 dB |
    | angle-left, light UI | 38.8 dB | 36.9 dB | 29.2 dB |
    | angle-left, edge content | 36.1 dB | 34.8 dB | 27.3 dB |

-   Shadow strength 0 leaves the background exactly (within 1 level) and
    device pixels are identical at every strength.

Export time in the lab (Chromium, this container's CPU): one device
0.57 to 0.62 s at 1920 × 1080 and about 1.1 s at 3840 × 2160; three
devices 1.5 s and 3.0 s. The production 2D renderer takes 0.06 to 0.18 s.

Problems found and fixed during review, not by the gate alone:

-   Antenna breaks protruded 1.5 units and notched the rail seen from the
    front; now flush (0.3-unit lip).
-   Light plastic on silver read as bright slashes; toned to the metal's value.
-   Highlight strips reflected in the glass as hard white slabs; light
    linking now restricts them to the metal.
-   The soft key light's shadow tail reached the frame edge; it is faded over
    the outer 8 % with the device required to stay inside.
-   Shadows in the three-device stack were heavy; the matte now allows a
    restrained default.
-   Plain trilinear sampling blurred minified UI (about 30 dB); replaced by
    2×2 area sampling. It aliases a one-pixel checkerboard more than
    trilinear, which is recorded in a unit test.

Comparison images: `docs/spikes/device-quality/comparison-sheet.jpg` and
full-resolution exports in `docs/spikes/device-quality/exports/`.

## Assessment against the references

Closer: thin bezels, believable metal band with controlled highlights,
grounded soft shadows, angled three-quarter and overlapping compositions,
crisp UI at 4K. Still short of the references:

-   Only one finish and one lighting setup (silver, studio). The cinematic
    references need a graphite library under dark lighting.
-   No editorial composition: headline type, accent shapes, framed cards.
-   No hands, props, environments or blurred backdrops.
-   No floating, dramatically tilted fans; all views rest on a surface.
-   The cover glass shows no screen glare by default (fidelity first).

## Recommendation

The six studio views are ready to integrate as an opt-in, beta renderer for
the Minimal style, after the product owner's visual review of the comparison
images, with the Canvas 2D renderer kept as default and fallback.
Prerequisites: scene schema v2 with a per-layer view reference, exports in a
worker (one to three seconds at 4K), and a cached low-resolution preview so
editing stays responsive. Cinematic needs its own graphite library first.

## Consequences

-   Output quality is now bounded by the device model and lighting, which
    are code in this repository and can be iterated and re-rendered.
-   A view costs about 6 to 11 minutes of rendering on 4 CPU cores and
    0.15 to 0.25 MB to deliver; adding views is cheap enough to curate by eye.
-   New devices (tablet, laptop) need their own geometry and views; the
    format and gate apply unchanged.
-   Scene schema v2 needs a per-layer view reference before integration.
