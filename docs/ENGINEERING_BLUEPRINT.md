# Engineering Blueprint

Version: 1.0\
Status: Initial architecture baseline

## 1. Architecture goals

-   Deliver a reliable image-rendering workflow early.
-   Keep static rendering independent from video-worker complexity.
-   Share a versioned scene model across mockup and video modules.
-   Avoid premature microservices.
-   Keep provider-specific storage, auth, and queue integrations behind
    clear boundaries.
-   Make security, testing, and observability part of the first
    implementation.

## 2. Recommended system shape

A modular web application plus an isolated rendering worker when needed.

-   Web app: UI, upload workflow, scene editing, project APIs.
-   Domain package: scene types, validation, geometry, and business
    rules.
-   Mockup renderer: preview and final image composition.
-   Storage adapter: local development first where practical; object
    storage later.
-   Database adapter: persistence when saved projects are introduced.
-   Render worker: browser recording, video encoding, and longer jobs.
-   Observability: structured logs, job IDs, render metrics, and error
    reporting.

Do not add separate deployable services for every module. A modular
monolith is the default until scale or security isolation justifies
separation.

## 3. Suggested stack (validate against repository first)

-   Next.js + TypeScript.
-   Tailwind CSS and an accessible component system.
-   Canvas for initial 2D scene interaction; evaluate WebGL only if
    needed.
-   Sharp for supported server-side image transforms and format
    conversion.
-   Zod or equivalent runtime schema validation.
-   PostgreSQL + Drizzle ORM when durable project persistence is needed.
-   S3-compatible object storage behind an adapter when persistent
    assets are needed.
-   Playwright for browser automation and end-to-end tests.
-   FFmpeg for video post-processing/encoding.
-   A bounded job queue for video processing when the workflow requires
    background execution.

Do not install all dependencies at project initialization. Add only what
is needed for the active milestone and record important decisions.

## 4. Proposed repository boundaries

apps/

-   web/ --- Next.js application.
-   render-worker/ --- isolated browser capture and video processing when introduced.

packages/

-   domain/ --- types, schemas, validation, domain logic.
-   ui/ --- reusable accessible UI components.
-   scene-schema/ --- versioned scene document and migrations.
-   mockup-engine/ --- screen mapping, layer ordering, rendering abstractions.
-   storage/ --- local/object storage adapter.
-   database/ --- schema and queries when persistence is added.
-   video-engine/ --- capture/render interfaces when Motion Studio reaches implementation.

docs/

-   PRD, architecture, UX/IA, visual system, testing/observability, implementation plan, ADRs.

Adapt this structure to the current repository. Do not force a monorepo
if the existing project is small and a simpler structure is better;
preserve clear module boundaries.

## 5. Scene model

A scene contains:

-   schemaVersion and scene ID.
-   Canvas dimensions, color space, background.
-   Ordered layers.
-   Device asset ID and screen asset ID.
-   Transform coordinates in normalized or canvas-relative units.
-   Device-specific screen aperture and supported transforms.
-   Text and graphic layers.
-   Shadow, lighting, reflection parameters supported by the renderer.
-   Render/export configuration.
-   Optional future timeline extension.

Scene definitions are editable source data; rendered images/videos are
derived outputs. Never make the exported PNG the only saved
representation of a scene.

## 6. Rendering strategy

### Preview

Use browser rendering for interactive feedback. Keep preview resolution
bounded and responsive. Preview and export must follow the same scene
semantics.

### Final image render

Use a deterministic render path that can output exact dimensions. Support:

-   Screen fitting and cropping rules.
-   Device masks and cutouts.
-   Supported perspective transforms.
-   Layer order and clipping.
-   Text rendering.
-   Background and shadow composition.
-   PNG/WebP output where supported.

### Asset approach

Use licensed or original device assets. Each asset must have a
documented screen aperture, supported transform range, material/lighting
assumptions, version, and licensing metadata. Do not assume every device
supports arbitrary rotation or perspective.

Start with 2.5D compositing and pre-rendered device assets. Introduce
true 3D only if validated use cases cannot be served by the simpler
renderer.

## 7. Motion architecture

Motion Studio is a separate pipeline that consumes a scene and a source
recording.

Pipeline:

1.  Validate prototype URL and compatibility.
2.  Start isolated browser capture.
3.  Record user-driven interactions.
4.  Store source video and recording metadata.
5.  Create a render job.
6.  Composite screen recording into the selected device scene.
7.  Apply supported tap indicators, transitions, and captions.
8.  Encode MP4 with FFmpeg or equivalent.
9.  Validate output and publish download.
10. Apply retention/cleanup policies.

Do not perform long browser or video work inside a short-lived web
request. Use explicit job states: queued, running, succeeded, failed,
cancelled, and expired where relevant.

### Capture safety

-   Allowlist schemes and block local/private network destinations.
-   Defend against DNS rebinding and redirects to prohibited addresses.
-   Restrict outbound network access at the worker/container layer.
-   Isolate browser processes and filesystem access.
-   Enforce duration, CPU, memory, and concurrency limits.
-   Never accept arbitrary user code for execution.
-   Keep secrets and authenticated browser sessions isolated.

Figma URLs do not guarantee universal playback or event access. Validate
Embed API capabilities and browser recording behavior with a technical
spike before promising compatibility.

## 8. Persistence and data model

Potential entities:

-   users
-   projects
-   assets
-   scene_documents
-   template_definitions
-   recording_sessions
-   render_jobs
-   export_records
-   usage_events

Implement only the entities needed for the current milestone. Use stable
asset IDs and avoid storing raw filesystem paths in scene documents.
Keep schema migrations explicit.

## 9. API and module contracts

Prefer typed service interfaces:

-   validateUpload(input)
-   createScene(input)
-   validateScene(scene)
-   renderScene(scene, options)
-   createRecordingSession(input)
-   enqueueRenderJob(input)
-   getRenderJobStatus(jobId)

These are conceptual contracts; choose final names to fit repository
conventions. Keep HTTP route handlers thin and validate all inputs at
boundaries.

## 10. Failure handling

-   Return actionable validation messages.
-   Distinguish invalid input, unsupported capability, temporary
    failure, and internal error.
-   Make render jobs idempotent where possible.
-   Retry only transient failures and cap retry count.
-   Preserve job logs and correlation IDs.
-   Never report export success before validating the output file.
-   Avoid silent fallback that changes visual quality without telling
    the user.

## 11. Environment and deployment

Separate development, test, and production configuration. Use
environment variable validation at startup. Never commit secrets. Keep
the web app and resource-intensive worker independently deployable when
video processing is introduced.

## 12. Architecture exit criteria

The initial architecture is acceptable when a complete screenshot-to-PNG
workflow runs locally, its scene configuration is validated and
reusable, core tests pass, and the repository documents how the
rendering boundary can later support video.
