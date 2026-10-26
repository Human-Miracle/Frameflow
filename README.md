# Frameflow --- Project Context Pack

Version: 1.0\
Status: Initial build baseline\
Purpose: Provide Claude Code with a coherent, implementation-ready
source of truth.

## How to use this pack

1.  Extract this folder into the root of the Frameflow repository, or
    copy its `docs/` folder into the repository.
2.  Read `docs/PRD.md`, `docs/ENGINEERING_BLUEPRINT.md`,
    `docs/UX_INFORMATION_ARCHITECTURE.md`, and
    `docs/IMPLEMENTATION_PLAN.md` first.
3.  Treat `docs/DECISIONS.md` and `docs/ADR/` as the current
    architecture baseline unless repository evidence requires a
    documented change.
4.  Inspect the repository before modifying existing code. Do not
    overwrite user work.
5.  Build incrementally. Complete the first vertical slice and run its
    tests before continuing.

## Product in one sentence

Frameflow is a browser-based presentation studio that turns real product
UI screenshots and guided prototype recordings into high-end, editable,
portfolio-ready mockups and videos.

## Source-of-truth rules

-   Product requirements define intended behavior.
-   Engineering Blueprint defines system boundaries and technical
    principles.
-   UX & Information Architecture defines navigation and workflows.
-   Visual Design System defines visual language and rendering quality.
-   Testing & Observability Blueprint defines quality gates and
    operational signals.
-   ADRs explain why major technical choices were made.
-   Implementation Plan defines sequencing and acceptance criteria.
-   If documents conflict, do not guess silently. Flag the conflict,
    propose a resolution, and update the relevant document after
    approval or clear evidence.

## Initial delivery principle

The first milestone must prove a real end-to-end workflow: upload an
actual screenshot, map it accurately into a device, create at least two
visual treatments, and export a high-resolution image. Motion Studio
should exist in the product architecture and navigation, but must not
pretend to record or export video until those capabilities work.
