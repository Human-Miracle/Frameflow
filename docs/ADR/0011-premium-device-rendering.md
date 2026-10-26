# ADR 0011: Pre-Rendered Device Views With Verified Screen Mapping

Status: Proposed, pending visual review by the product owner
Date: 2026-10-26

## Context

The product references (supplied 2026-10-26) show angled and floating
phones, isometric grids, low hero angles, polished metal rails with sharp
highlight bands, thin bezels, grounded soft shadows and editorial type
around the devices. The current renderer (ADR 0008) draws a flat vector
phone with in-plane rotation only. It cannot show any of those views.

A spike compared three approaches on the same device geometry and the same
synthetic UI screenshot, at 1920 × 1080. Images are in
`docs/spikes/device-rendering/`; the lab page is `/lab/device-spike`.

| | Canvas 2D (current) | Real-time WebGL (three.js) | Pre-rendered view (Blender Cycles) + homography |
|---|---|---|---|
| Perspective views | No | Any angle | Fixed angles, one per rendered view |
| Metal, reflections, shadows | Painted gradients | Physically based, real-time quality | Path traced, soft area-light shadows |
| Screenshot fidelity | Exact | Exact colours (unlit, not tone mapped) | Exact colours; mapping error 0.0011 to 0.0012 px mean, under 0.004 px at the 99.9th percentile |
| Render time, 1920 × 1080 | 65 to 140 ms | 9.5 to 11.4 s (software GL in this container) | 280 to 360 ms, plus about 2.5 min per view once, offline |
| Defects found | None | Screen dropped in transparent pass; sliver-triangle depth errors; shadow streaks | None in the views rendered |
| Same path for video | Yes | Only with GPUs in workers | Yes: the compositor is a pure function on pixel arrays |

Timings are from `docs/spikes/device-rendering/timings-1920x1080.json`.

External assets were not used. Apple's product bezels are reported to be
licensed only for mock-ups of software for Apple platforms, without
modification or 3D simulation (secondary sources, not verified against
Apple's current terms). Free "CC0 mockup" collections found were PSD photo
mock-ups whose licences would need checking with the original authors. The
spike device is therefore an original model rendered by our own pipeline.

## Decision

1.  Adopt pre-rendered device views with homography compositing as the
    target premium rendering path for Mockup Studio, subject to the product
    owner's visual review of the spike images.
2.  Views are produced offline by `asset-pipeline/` with Blender Cycles from
    the app's own device geometry. Each view must pass the screen-mapping
    check (99.9th percentile error at most 0.5 screen pixels), and the
    runtime refuses views that did not.
3.  The screenshot is composited at runtime by `compositeScreen`: exact
    homography, trilinear sampling from a mip pyramid, Blender's coverage
    mask for corners and occlusion. With glare at 0, screenshot pixels are
    never altered by lighting.
4.  Keep the Canvas 2D renderer as the product renderer until pre-rendered
    views ship in Mockup Studio, and keep it as the straight-on fallback.
5.  Do not adopt real-time WebGL for export. It may be reconsidered for an
    interactive angle preview on clients with GPUs.

## Consequences

-   Each view is a fixed camera angle. Users choose among curated views
    rather than free 3D rotation, which matches the preset-first principle.
-   Scene schema v2 will need a per-device `view` reference (asset ID,
    version, view ID). Multi-device compositions need either baked
    multi-device scenes (one render, one mask per screen) or per-device views
    layered in paint order.
-   Asset quality now bounds output quality. Before shipping, the device
    model needs thinner bezels (current border is about twice a current
    flagship's), camera module, ports and antenna lines, plus more lighting
    setups and environments.
-   Views must be rendered at least as large as the largest export: the
    spike's 1400 px views are upscaled at 4K.
-   Each view adds about 1 MB (beauty) and 45 KB (mask).
-   The video worker can reuse the compositor per frame. Animated camera
    moves need per-frame corner tracks from Blender.
-   Supersedes the "2.5D before full 3D" decision only in mechanism: ADR
    0004's 2.5D approach is kept, with path-traced pre-renders as the assets.
