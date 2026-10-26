# ADR 0008: One Browser Canvas Renderer for Preview and Export

Status: Accepted for Milestone 2, subject to review against reference images
Date: 2026-10-26

## Context

The Engineering Blueprint asks for a deterministic final render path and
says preview and export must follow the same scene semantics. It suggests
Sharp for server-side image work. The PRD asks that uploads are not sent
to external services and that unnecessary persistent uploads are avoided
in the personal-first MVP.

A server renderer would need its own canvas implementation (for example
Skia bindings) next to the browser preview, which creates two renderers
that can drift, and it would require uploading every screenshot.

## Decision

Render scenes with a single Canvas 2D function, `renderScene`
(`src/mockup-engine/render.ts`), used by both the live preview and PNG
export. Export renders at the full canvas size in an `OffscreenCanvas`,
encodes a PNG, and verifies the encoded file's signature and dimensions
before the download starts.

Screenshots are validated from their bytes and decoded in the browser. No
screenshot leaves the device in this milestone, and the
Content-Security-Policy blocks outbound connections.

Device assets are original vector geometry drawn by the renderer
(`src/devices/frameflow-phone.ts`). The asset declares its screen
aperture, cutout, corner smoothing, supported rotation range (-30° to 30°)
and licence. Perspective transforms are not supported by this renderer and
are declared unsupported by the asset.

Sharp is not added. Server-side rendering is reconsidered when Motion
Studio's worker needs to composite scenes into video frames.

## Consequences

-   Preview and export cannot disagree about layout: they run the same code
    and differ only in output size.
-   Rendering is deterministic for a given browser engine; golden images are
    therefore platform specific (Chromium on Linux in CI).
-   Uploads need no server, storage or rate limiting yet.
-   Export size is bounded by browser canvas memory; limits are set to 8192 px
    per side and 40 megapixels.
-   Photographic realism is limited by vector shading. Licensed or original
    photographic device renders can replace the procedural frame later
    without changing the scene schema, because assets are referenced by ID.
-   The video worker will need to run the same renderer, most likely in a
    headless browser, to keep scenes consistent across image and video.
