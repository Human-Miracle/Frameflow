# Claude Code Implementation Plan

Version: 1.0\
Execution style: Small, verified milestones

## Operating instructions

-   Inspect the repository and existing agent instructions before edits.
-   Preserve existing work.
-   Read the product documents before coding.
-   Use the repository's existing package manager and conventions unless
    there is a documented reason to change.
-   Do not install every proposed dependency up front.
-   Do not fake unfinished features.
-   Run tests after each meaningful milestone.
-   Update docs and ADRs when decisions change.
-   Report actual test results and remaining limitations.

## Milestone 0 --- Repository reconnaissance

Tasks:

-   Inspect files, package manager, framework, tests, scripts, existing assets, and environment setup.
-   Identify existing work that must be preserved.
-   Report assumptions and risks.
-   Do not overwrite or reset the repository.

Exit criteria:

-   Current state and implementation approach are documented.
-   No existing user work has been lost.

## Milestone 1 --- Application foundation

Tasks:

-   Establish/confirm application shell and navigation.
-   Add Mockup Studio and Motion Studio routes.
-   Establish visual tokens and shared UI components.
-   Add strict TypeScript and validation patterns.
-   Add lint/typecheck/test scripts.
-   Add documentation structure.

Exit criteria:

-   App starts locally.
-   Both workspaces are navigable.
-   Core quality commands run.
-   Motion Studio clearly communicates that recording is not yet implemented.

## Milestone 2 --- Rendering proof of concept

Tasks:

-   Validate PNG/JPEG/WebP uploads.
-   Implement scene schema and validation.
-   Implement one device asset with documented screen geometry.
-   Map screenshot into screen aperture.
-   Add minimal and cinematic presets.
-   Add a three-device composition.
-   Export valid high-resolution PNG.
-   Add unit, integration, and end-to-end tests.

Exit criteria:

-   Complete upload-to-export journey works.
-   Source UI remains accurate.
-   Output dimensions are correct.
-   Visual result has been manually inspected against reference goals.

## Milestone 3 --- Scene Composer MVP

Tasks:

-   Add scene selection and screen replacement.
-   Add background, position, scale, and supported rotation controls.
-   Add layer selection and ordering.
-   Add undo/redo and save-state handling.
-   Add reusable scene configuration.
-   Add additional templates only after quality gates pass.

Exit criteria:

-   A user can edit and reuse scenes without rebuilding from scratch.
-   The saved scene reopens consistently.
-   Renderer regression tests pass.

## Milestone 4 --- Capture technical spike

Tasks:

-   Compare direct browser recording with Figma Embed API approach.
-   Validate compatible prototype URL behavior.
-   Test start/stop, screen dimensions, recording output, and permissions.
-   Implement URL allowlisting, private-network blocking, worker isolation, timeouts, and resource limits.
-   Document supported and unsupported scenarios.

Exit criteria:

-   One dependable guided capture route is proven.
-   Security review and limitations are documented.
-   No universal Figma compatibility is claimed.

## Milestone 5 --- Motion Studio MVP

Tasks:

-   Implement recording session state.
-   Add review and retake.
-   Store source recording and metadata as appropriate.
-   Add bounded job queue and isolated worker.
-   Composite recording into selected device scene.
-   Add tap indicators and basic transitions.
-   Encode and validate MP4.
-   Add progress, cancellation where feasible, and failure recovery.

Exit criteria:

-   Compatible journey can be recorded and exported.
-   Output plays correctly at expected dimensions.
-   Jobs have traceable states and bounded resource use.

## Milestone 6 --- Integration and personal launch

Tasks:

-   Share device assets and scene definitions across modules.
-   Improve project persistence and asset management as needed.
-   Add regression tests for both image and video paths.
-   Review storage retention, quotas, rate limits, and error handling.
-   Test with real portfolio screens and workflows.
-   Document setup, limitations, and next priorities.

Exit criteria:

-   Both modules work end to end for explicitly supported use cases.
-   No critical known UI-fidelity issues in supported templates.
-   Setup and test instructions are reproducible.

## Required checks for every milestone

-   Formatting/lint.
-   Type checking.
-   Relevant unit and integration tests.
-   Relevant end-to-end tests.
-   Visual review for rendering changes.
-   Security review for upload/capture changes.
-   Documentation updates.
-   Honest completion report.

## Final report format

1.  Implemented.
2.  Verified by tests.
3.  Not implemented.
4.  Known limitations.
5.  Commands to run locally.
6.  Decisions made or changed.
7.  Next milestone and acceptance criteria.
