# Claude Code --- Start Here

Read `README.md` and the documents in `docs/` before implementing
features.

You are working on Frameflow, a browser-based product presentation
studio. Follow the PRD, Engineering Blueprint, UX & Information
Architecture, Visual Design System, Testing & Observability Blueprint,
ADRs, and Implementation Plan as the project source of truth.

## Your immediate task

1.  Inspect the existing repository and agent instructions.
2.  Preserve existing user work and conventions.
3.  Summarize the current state and identify risks.
4.  Start Milestone 0 and then implement Milestone 1 as appropriate.
5.  Build the first real rendering vertical slice from Milestone 2 as
    the next priority; do not stop after writing plans.
6.  Validate every stage with tests and report actual results.

The first product proof must let a user upload a real PNG/JPEG/WebP UI
screenshot, place it accurately into a device screen aperture, switch
between minimal and cinematic compositions, create a three-device scene,
and export a valid high-resolution PNG.

Do not generate or redraw the source UI with AI. Do not fake
functionality. If licensed device assets are not available, document the
limitation and implement a deterministic proof of concept with the best
available assets. Do not claim photographic realism until the output has
been visually reviewed.

Motion Studio must appear in the product architecture, but do not
pretend guided recording or MP4 export works until implemented and
tested. Validate prototype compatibility and capture security before
committing to an approach.

Keep the code modular, TypeScript strict, tests meaningful, and
dependencies limited to the active milestone. Update documentation and
ADRs when decisions change.

Start by inspecting the repository, then proceed with implementation.
