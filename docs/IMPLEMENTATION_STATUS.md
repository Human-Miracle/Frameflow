# Implementation Status

Version: 0.1
Date: 2026-10-26
Status: Milestones 0 to 2 complete, pending visual review by the product owner

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

## Next milestone: Scene Composer (Milestone 3)

Acceptance criteria from the Implementation Plan:

-   A user can edit and reuse scenes without rebuilding from scratch.
-   A saved scene reopens consistently.
-   Renderer regression tests pass.

Planned work: undo and redo, save and reopen scene files with
re-linking of screenshots by ID, layer reordering, and the decision on
photographic device assets.

## Change log

-   0.1 (2026-10-26): Milestones 0 to 2.
