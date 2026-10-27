# Implementation Status

Version: 0.3
Date: 2026-10-27
Status: Milestones 0 to 3 complete; device asset library v2 passes its quality gate, integration pending visual review (ADR 0012)

## Milestone 0: repository assessment

At the start of implementation the repository held only the project
documents and ADRs 0001 to 0007. There was no application code, package
manager, tests or assets, so nothing needed preserving except the docs.

Approach chosen: a single Next.js package (ADR 0009) with a browser
renderer shared by preview and export (ADR 0008).

## Milestone 1: application foundation

Done:

-   Next.js 16, React 19, TypeScript in strict mode (including
    `noUncheckedIndexedAccess`), npm.
-   App shell with Home, Mockup Studio and Motion Studio.
-   Motion Studio states that recording is not available; its record
    button is disabled.
-   Design tokens in `src/app/globals.css`, CSS Modules, visible focus
    states, reduced-motion support.
-   Scripts: `lint`, `format:check`, `typecheck`, `test`, `test:e2e`,
    `check`.
-   Security headers: Content-Security-Policy, `nosniff`, no referrer, and
    camera, microphone and geolocation disabled.

## Milestone 2: rendering proof of concept

Done:

-   Upload validation from file bytes: PNG, JPEG and WebP signatures,
    25 MB limit, 64 px minimum, 10,000 px and 50 megapixel maximum checked
    before decoding, animated images rejected, decoded size cross-checked.
-   Versioned scene schema (v1) with Zod validation and asset-aware rules.
-   One original device asset with documented geometry: Frameflow Phone,
    1179 × 2556 screen, pill cutout, smoothed corners, rotation from -30°
    to 30°, no perspective.
-   Templates: Single Hero and Cinematic Stack (three overlapping phones).
-   Styles: Minimal and Cinematic, plus seven background presets including
    transparent.
-   Quick controls: screenshot assignment, fill or show-all fit with a
    crop warning, position, size, rotation, visibility, lock, layout reset.
-   PNG export at six preset sizes up to 3840 × 2160, verified before
    download.
-   Structured JSON logs with correlation IDs and categorised error codes
    for upload and export.

Not done in this milestone (by plan): undo and redo, saving and reopening
scenes, text and graphic layers, WebP export, additional devices.

## Verification

-   64 unit tests (Vitest): upload parsing and limits, scene validation,
    geometry, screen fitting, layer order, hit testing, renderer command
    order and placement, export verification, studio state, logging.
-   14 end-to-end tests (Playwright, Chromium): navigation, honest Motion
    Studio state, upload to PNG export, pixel-exact aperture placement
    and orientation, cutout position, preset difference, three-device
    layer order, adjustments, JPEG and WebP input, invalid upload recovery,
    crop warning, and four golden-image comparisons.
-   The placement test was checked by deliberately shifting the screenshot
    in the renderer; the test failed as expected.

Golden images live in `tests/e2e/__snapshots__` and are specific to
Chromium on Linux. Test fixtures in `tests/fixtures` are synthetic app
screens rendered from HTML by `npm run fixtures`.

## Known limitations

-   No reference images were found in the repository, so outputs were
    reviewed against the written art direction only. The product owner
    should review exports against their reference images.
-   The device is procedural vector art. It is clean and accurate but not
    photographic: no material texture, glass reflection or camera module.
-   Only in-plane rotation is supported. Angled perspective views need
    either perspective mapping on a pre-rendered asset or a different
    renderer.
-   Golden images depend on the browser engine and fonts; other platforms
    need their own baselines.
-   Scenes are not persisted; reloading the page starts over.

## Milestone 3: Scene Composer

Done:

-   Save, Save as copy, Open, New and Delete for scenes, stored in this
    browser's IndexedDB with their original screenshot files (ADR 0010).
-   Reopened scenes are validated again, including every screenshot's
    bytes. Missing screenshots are reported and their devices left empty.
-   Saved, unsaved and saving states, an unload warning, and clear errors
    when storage is full or unavailable.
-   Undo and redo (buttons, Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl+Y). A slider
    drag is one step; selection is not an edit.
-   Layer reordering with forward and backward controls; paint order is the
    layer order.
-   Scene renaming.

Verified by unit tests for history, layer moves and the repository
contract, and by browser tests that save, reload, reopen and export a
byte-identical PNG, plus undo/redo, reordering and blocked-storage cases.

Limitations: scenes stay on one browser profile; no sync, backup or
sharing; no export or import of scene files yet.

## Device-rendering spike

Compared the current Canvas 2D renderer, real-time WebGL (three.js) and
pre-rendered Blender Cycles views with homography compositing. Results,
timings and images: ADR 0011 and `docs/spikes/device-rendering/`. The lab
page `/lab/device-spike` is experimental, not linked from navigation, and
not part of Mockup Studio.

Outcome: pre-rendered views give real perspective, path-traced metal and
shadows, and an exactly placed screenshot (verified mapping error under
0.004 px) in about 300 ms per export. They are a clear improvement over the
current renderer but are not yet at the reference quality: the device
model needs thinner bezels and hardware detail, lighting and environments
need work, and editorial text layers do not exist yet.

## Device quality gate and asset library v2

Done (ADR 0012, `asset-pipeline/README.md`):

-   Device model v2 (`src/devices/frameflow-phone-v2.ts`): thinner bezel
    (50 units, from 68), rounded metal band, flush antenna breaks, pill
    buttons, charging port and speaker holes, cover-glass slab, cutout with
    lens. Not registered in the production device registry.
-   Pipeline 2.1 renders a resting device with an orbiting camera, grounded
    soft shadows and restrained light-linked highlights, and writes beauty,
    screen mask, device matte and `asset.json` per view.
-   Six views at 3200 px on the longest side: front, three-quarter left and
    right, moderate angle left and right, steep. All pass the render-time gate
    (homography, mask, framing, size, matte) and the browser gate (light,
    dark and edge-content screenshots, export fidelity, shadow strength).
-   Direct compositing with 2×2 area sampling (36.1 to 40.6 dB PSNR against a
    supersampled reference) and adjustable shadow strength.
-   Comparison sheet and 4K exports in `docs/spikes/device-quality/`.

Not done: integration into Mockup Studio, a cinematic (graphite) library,
editorial layers, hands, props and environments. The Canvas 2D renderer is
unchanged and remains the production renderer.

## Next milestone

Proposed, pending the product owner's review of the comparison images:

1.  Scene schema v2 with a per-layer view reference and migration from v1.
2.  Library views in Mockup Studio as an opt-in beta for Minimal, with
    exports in a worker and a cached low-resolution preview.
3.  A graphite, cinematic-lit library for the Cinematic style.

Acceptance criteria: a user can choose a library view per device, save and
reopen it, and export at 4K with the same fidelity gate passing; existing
golden images, persistence and undo/redo tests still pass; the product
owner judges the output comparable to the references for supported views.

## Change log

-   0.1 (2026-10-26): Milestones 0 to 2.
-   0.2 (2026-10-26): Milestone 3 and the device-rendering spike.
-   0.3 (2026-10-27): Device asset library v2 and its quality gate.
