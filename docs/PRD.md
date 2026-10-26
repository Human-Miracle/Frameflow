# Product Requirements Document (PRD)

Version: 1.0\
Product: Frameflow\
Status: MVP baseline

## 1. Summary

Frameflow is a browser-based product presentation studio for designers. It combines:

1.  Mockup Studio --- turn screenshots into polished device compositions.
2.  Motion Studio --- record a guided journey through a compatible browser-based prototype and present it as a polished video.

The product is personal-first: the first real customer is the creator,
using it to remove portfolio production bottlenecks. The architecture
should permit later commercialization without building multi-tenant
complexity prematurely.

## 2. Problem

Designers can finish high-quality UI but still struggle to present it
well. Producing realistic device mockups requires suitable assets and
compositing skills; producing polished walkthroughs requires recording,
device framing, motion, and video processing. These steps slow portfolio
creation and introduce quality inconsistencies.

## 3. Vision and positioning

Vision: The fastest way for a product designer to turn finished UI into
beautiful, believable, portfolio-ready presentations.

Positioning: A purpose-built presentation engine between simple
screenshot generators and full professional image/video editors.
Frameflow does not replace Figma, Photoshop, or Premiere Pro; it removes
the most common presentation-production tasks.

## 4. Target users

### Primary

Independent product designers and UX/UI designers building portfolios,
case studies, job applications, client presentations, and launch
content.

### Secondary

Freelancers and design agencies that need repeatable, consistent visuals
across projects.

### Later

Product teams that create stakeholder demos, launch assets, and shared
presentation material.

## 5. Product principles

-   Fidelity before spectacle: do not alter or hallucinate source UI.
-   Great defaults before complex controls.
-   Preset-first, advanced when needed.
-   One source, multiple outputs.
-   Deterministic, repeatable exports.
-   Progressive automation: guided capture first, automated journey
    generation later.
-   No feature is considered complete until it is implemented and
    tested.

## 6. Product scope

### MVP: shared foundation

-   Product shell with Mockup Studio and Motion Studio destinations.
-   Upload validation for PNG, JPEG, and WebP screenshots.
-   Project/scene configuration model, initially local or persisted
    according to the chosen repository stage.
-   Clear error, loading, empty, and success states.
-   Reusable templates and export settings.
-   Automated tests for core workflows.

### MVP: Mockup Studio

-   Screenshot upload and replacement.
-   Device asset with explicit screen aperture/mask.
-   Single-device straight-on composition.
-   Three-device overlapping composition.
-   Minimal and cinematic presets.
-   Basic position, scale, and supported rotation controls.
-   Background configuration.
-   Preview and high-resolution PNG export.
-   WebP export if the selected pipeline supports it reliably.
-   Save/reopen scene configuration when persistence is implemented.
-   No AI-generated replacement of actual UI.

### MVP: Motion Studio

-   Dedicated workspace and honest capability states.
-   Technical spike for compatible prototype access.
-   Guided browser-based recording for an explicitly supported route.
-   Review, retake, and recording metadata.
-   Basic tap indicators and limited transitions after capture is
    reliable.
-   Scene-aware framing and MP4 export after a tested worker pipeline
    exists.
-   No claim of universal Figma prototype compatibility.

### Out of scope for initial MVP

-   Automatic generation of a full journey from a Figma URL.
-   Full multitrack video editing.
-   Marketplace/community template library.
-   Team collaboration and approval flows.
-   Arbitrary full 3D manipulation.
-   Native mobile apps.
-   AI redraw/reconstruction of UI.
-   Subscription/billing system before validation.

## 7. Key user journeys

### Journey A: create a mockup

1.  Open Mockup Studio.
2.  Upload a valid screenshot.
3.  Choose a template.
4.  Preview the screenshot in the device.
5.  Adjust supported settings.
6.  Export a high-resolution image.
7.  Receive a clear success or actionable error.

### Journey B: edit a scene

1.  Open a saved scene.
2.  Replace one or more screen assets.
3.  Modify supported layers or preset settings.
4.  Undo/redo supported changes.
5.  Save and export again without rebuilding the scene.

### Journey C: guided prototype video

1.  Open Motion Studio.
2.  Paste or select a compatible prototype URL.
3.  Run compatibility and security checks.
4.  Start a guided recording.
5.  Perform the user journey.
6.  Stop, preview, and retake if needed.
7.  Apply supported device framing and interaction effects.
8.  Submit a render job and track its status.
9.  Download a valid MP4 or receive an actionable error.

## 8. Functional requirements

### Upload

-   Validate MIME/type, file signature where feasible, file size,
    dimensions, and decoding.
-   Reject unsupported files with actionable messages.
-   Never trust filename extensions alone.
-   Do not send uploaded designs to external AI services.
-   Avoid unnecessary persistent uploads for a personal-first MVP.

### Scene composition

-   Scene data must be versioned and independent of the rendered output.
-   Each device asset must declare its screen geometry and supported
    transformations.
-   Layer ordering must be deterministic.
-   Replacing a screen must not distort its contents unexpectedly.
-   Export dimensions must match the requested dimensions.

### Rendering

-   Preserve UI text and visual fidelity.
-   Support masks, rounded corners, and supported perspective
    transforms.
-   Keep editable typography as structured scene data until final
    rendering where feasible.
-   Ensure repeatable results from the same scene and asset inputs.
-   Report rendering errors rather than silently returning corrupt
    output.

### Motion

-   Recording must be user-initiated and clearly indicated.
-   Capture must run in an isolated environment with URL/network
    restrictions.
-   Recording compatibility limitations must be visible before the user
    invests time.
-   Render jobs need states, timeouts, resource limits, and retry
    behavior.
-   Preserve the original recording as a source asset when appropriate.

## 9. Non-functional requirements

-   Strict TypeScript and runtime validation at trust boundaries.
-   Accessible controls and keyboard support for core interactions.
-   Responsive browser UI; editing may prioritize desktop layouts.
-   Secure file handling and isolated browser capture.
-   No secrets in source control.
-   Useful structured logs and correlation/job IDs.
-   Bounded render resolution, recording duration, concurrency, and
    storage.
-   Core flows covered by unit, integration, and end-to-end tests.
-   Documented environment setup and reproducible local development.

## 10. Success metrics and initial targets

Targets are hypotheses to validate, not claims of current performance.

-   First successful mockup export: under 60 seconds for a prepared
    screenshot.
-   Repeat export from a preset: under 30 seconds.
-   Mockup export success rate: at least 95% during controlled testing.
-   Guided demo creation: under five minutes after a compatible
    prototype is ready.
-   UI fidelity: no unintended changes to source UI.
-   Recovery: users can understand and recover from common failures
    without restarting the app.

Track time from completed design to usable asset, successful exports,
failure reasons, repeat usage, and how often users still need external
editing tools.

## 11. Acceptance criteria

The initial rendering vertical slice is accepted when:

-   A valid screenshot can be uploaded.
-   The screenshot is placed inside a defined device screen aperture.
-   Minimal and cinematic presets visibly differ.
-   A three-device scene preserves layer order and screen alignment.
-   The user can export a valid PNG at configured dimensions.
-   The export is visually inspected against the preview.
-   Invalid uploads and rendering errors have clear feedback.
-   Tests cover the primary journey.

## 12. Risks and mitigations

-   Device asset quality: use original or properly licensed assets and
    verify commercial rights.
-   Perspective mapping: test geometry before building many templates.
-   Browser capture incompatibility: run a technical spike and
    explicitly define supported prototype routes.
-   Render cost: bound resolution, duration, concurrency, and retries.
-   Scope creep: keep automatic journey generation and full video
    editing out of MVP.
-   UI distortion: use deterministic compositing; never generate the
    interface with AI.
