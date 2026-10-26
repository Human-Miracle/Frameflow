# Testing & Observability Blueprint

Version: 1.0

## 1. Objectives

Prevent regressions in screen fidelity and composition, make failures
diagnosable, and ensure rendering work is bounded and recoverable.

## 2. Testing layers

### Unit tests

-   Scene schema validation and version handling.
-   Normalized-to-canvas coordinate conversion.
-   Screen aperture geometry.
-   Layer ordering.
-   Crop/contain/cover rules.
-   Export dimension calculation.
-   Job state transitions.
-   URL allowlist and prohibited destination logic.

### Integration tests

-   Upload validation and decoding.
-   Scene creation and serialization.
-   Renderer output generation.
-   Storage adapter behavior.
-   Job queue transitions when implemented.
-   Failure handling and retry limits.
-   Output file validation.

### End-to-end tests

-   Upload screenshot → choose preset → preview → export PNG.
-   Replace screen asset → re-render → export.
-   Save/reopen scene if persistence exists.
-   Invalid upload → visible actionable error.
-   Recording start/stop/review/retake for supported capture route.
-   Render job progress → valid MP4 download once Motion Studio is
    implemented.

### Visual regression

Maintain a small set of golden inputs:

-   Light UI.
-   Dark UI.
-   Long text.
-   Edge-to-edge imagery.
-   Very light and very dark screen edges.
-   Unusual screenshot aspect ratios.
-   Screens with notches/status bars.
-   Multiple overlapping devices.

Compare images with tolerances appropriate to the renderer. Investigate
differences rather than automatically updating baselines.

## 3. Quality gates

For each milestone:

1.  Formatting/lint passes.
2.  Type checking passes.
3.  Unit tests pass.
4.  Relevant integration tests pass.
5.  Relevant end-to-end tests pass.
6.  Visual regression reviewed for renderer changes.
7.  Manual smoke test completed for critical output quality.
8.  Documentation updated.

Never disable a failing test just to claim completion. If a test is
flaky or invalid, document why and repair the test strategy.

## 4. Observability

Use structured logs with:

-   timestamp
-   severity
-   environment
-   request/correlation ID
-   project ID where safe
-   render job ID
-   operation
-   duration
-   outcome
-   categorized error code

Avoid logging raw uploaded image contents, secrets, auth tokens, or
unnecessary personal data.

## 5. Metrics

Image:

-   upload attempts/success/failure.
-   render duration.
-   export dimensions and bytes.
-   render failure category.
-   preview-to-export discrepancy reports.

Video:

-   queue wait time.
-   capture duration.
-   render duration.
-   encoding failures.
-   worker memory/CPU use.
-   retries and timeout rate.
-   output validation failures.

Product workflow:

-   time to first export.
-   successful export rate.
-   retake frequency.
-   repeat use of saved presets.
-   use of external editing tools where feedback is available.

## 6. Error taxonomy

Distinguish:

-   INVALID_FILE
-   FILE_TOO_LARGE
-   IMAGE_DECODE_FAILED
-   UNSUPPORTED_ASSET_TRANSFORM
-   SCENE_VALIDATION_FAILED
-   RENDER_TIMEOUT
-   RENDER_OUT_OF_MEMORY
-   PROTOTYPE_UNSUPPORTED
-   CAPTURE_PERMISSION_DENIED
-   CAPTURE_TIMEOUT
-   VIDEO_ENCODING_FAILED
-   OUTPUT_VALIDATION_FAILED
-   STORAGE_FAILURE
-   INTERNAL_ERROR

Use stable codes internally and human-readable guidance in the UI.

## 7. Job lifecycle

For background rendering, use explicit states: queued → running →
succeeded/failed/cancelled/expired.

Requirements:

-   Unique job ID.
-   Idempotency key where appropriate.
-   Bounded retry count.
-   Timeout and cancellation handling.
-   Progress stages where measurable.
-   Output validation before success.
-   Cleanup for temporary files.
-   Clear user-facing recovery path.

## 8. Security checks

-   Validate file signature and decoded content.
-   Bound image dimensions and pixel count to avoid decompression bombs.
-   Restrict upload sizes.
-   Keep secrets out of logs.
-   Isolate browser workers.
-   Restrict browser network access and redirects.
-   Block loopback, private, link-local, and metadata service
    destinations.
-   Revalidate destinations after DNS resolution and redirects.
-   Apply CPU, memory, duration, and concurrency limits.
-   Test cleanup and access controls for uploaded and rendered assets.

## 9. Initial acceptance targets

Targets to validate during controlled testing:

-   At least 95% successful mockup exports.
-   At least 90% successful video exports initially once the video feature is released.
-   No known critical screen alignment or source-UI distortion defects in supported templates.
-   Every failed background job has a useful reason and traceable job ID. 
