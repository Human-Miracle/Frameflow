# Visual Design System & Scene Art Direction

Version: 1.0

## 1. Visual thesis

Frameflow should feel like a premium creative utility: restrained
application chrome, excellent typography, spacious controls, and a
canvas where the work---not the tool UI---dominates.

The exported scene quality is the product's primary differentiator.

## 2. Three composition families

### Cinematic

-   Deep charcoal/near-black environments.
-   Overlapping devices with deliberate perspective and depth.
-   Metallic edges and controlled reflections.
-   Grounded shadows and restrained accent lighting.
-   High contrast without crushing UI detail.

### Minimal

-   White, warm grey, cool grey, or dark neutral backgrounds.
-   Accurate device geometry.
-   Subtle shadows and low visual noise.
-   Consistent spacing and alignment.
-   No decorative effects unless they support hierarchy.

### Editorial

-   Editable headline, caption, annotation, and graphic layers.
-   Strong typographic hierarchy.
-   Intentional negative space.
-   Controlled use of accent colors.
-   Devices integrated with, not randomly placed beside, the editorial
    layout.

## 3. Template inventory for first library

Target 12 curated templates:

1.  Cinematic Stack --- three overlapping phones.
2.  Twin Portrait --- two angled phones.
3.  Single Hero --- one large phone.
4.  Floating Trio --- three separated devices on a light background.
5.  Interface Spread --- four to six devices.
6.  Editorial Cover --- two devices plus headline.
7.  Architecture Story --- devices plus background image/texture.
8.  Fintech Feature --- device plus UI callouts.
9.  Responsive Pair --- laptop plus phone.
10. Desktop Showcase --- laptop or monitor.
11. Tablet Workspace --- tablet plus phone.
12. Storyboard Strip --- three to five sequential screens.

For the first vertical slice, implement only the templates needed to
prove the renderer; do not create 12 low-quality placeholders just to
meet the count.

## 4. Device asset requirements

Each device asset must include:

-   Stable asset ID and version.
-   Asset source and license/usage rights.
-   Transparent hardware render or composable hardware layers.
-   Explicit screen aperture/mask.
-   Screen coordinate geometry and supported mapping.
-   Device dimensions/aspect ratio.
-   Supported rotations/transforms.
-   Material and lighting assumptions.
-   Optional separate frame/reflection/shadow layers.

Use original or properly licensed assets. Do not redistribute assets
without the required rights.

## 5. Screen fidelity rules

-   Source UI is authoritative.
-   Do not use image generation to reconstruct interface screens.
-   Do not warp text except as required by a documented perspective
    transform.
-   Preserve screen aspect ratio unless a user explicitly selects a
    crop.
-   Provide visible crop/fit controls where needed.
-   Correctly account for notches, rounded corners, and camera cutouts.
-   Keep screen content sharp and readable.
-   Use device-specific geometry, not a generic rectangle placed over
    every frame.

## 6. Typography

-   Use a restrained application type scale.
-   Use licensed fonts with recorded family/weight metadata.
-   Editorial layers must remain editable in scene data.
-   Support line height, tracking, alignment, wrapping, and color.
-   Ensure font availability is validated for reproducible exports.
-   Avoid arbitrary font substitution without notifying the user.

## 7. Scene controls

Quick mode:

-   Template.
-   Screen assignment.
-   Background preset.
-   Accent color where supported.
-   Device scale/position within safe bounds.
-   Lighting intensity preset where supported.
-   Canvas/export format.

Advanced mode:

-   Layer selection and order.
-   Transform controls.
-   Supported perspective/rotation.
-   Shadow/lighting settings.
-   Text and graphic editing.
-   Visibility/lock/grouping.
-   Alignment guides and snapping.
-   Reset-to-template.

Expose only parameters that the selected asset/renderer can genuinely
support.

## 8. Rendering quality

-   Preview and export must follow the same scene semantics.
-   Use high-resolution assets appropriate to target output.
-   Render at target dimensions; avoid merely upscaling a small preview.
-   Establish a canonical color space (sRGB for initial web exports).
-   Validate alpha/transparency behavior.
-   Test output on light and dark backgrounds.
-   Maintain golden images for visual regression.

## 9. Motion design rules

-   The actual UI must remain faithful to captured footage.
-   Device frame and environment remain consistent across frames unless
    intentionally animated.
-   Start with fixed camera and a small set of safe movement presets.
-   Tap indicators should be restrained and temporally aligned with
    interactions.
-   Use simple transitions before advanced keyframes.
-   Avoid effects that reduce interface readability.
-   Respect reduced-motion preferences in the editor; exported motion is
    explicitly configured by the user.

## 10. Product UI design

-   Quiet neutral application chrome.
-   Strong hierarchy and generous spacing.
-   Avoid a generic dashboard full of unnecessary cards.
-   Use clear empty, processing, success, and error states.
-   The scene canvas should have the strongest visual emphasis.
-   Use accessible contrast and visible focus states.

## 11. Visual acceptance review

For every template, inspect:

-   Screen aperture alignment.
-   Cutouts and corner clipping.
-   Device overlap and layer order.
-   Shadow direction and contact points.
-   Reflections and material plausibility.
-   Text sharpness.
-   Negative space and composition balance.
-   UI legibility at actual export size.
-   Output consistency across repeated renders. 
