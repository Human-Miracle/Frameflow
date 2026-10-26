# ADR 0009: Single Package With Module Folders

Status: Accepted
Date: 2026-10-26

## Context

The Engineering Blueprint proposes `apps/` and `packages/` folders, and
also says not to force a monorepo when the project is small. At Milestone
2 the repository contains one web application and no worker.

## Decision

Keep one Next.js package. Enforce module boundaries with folders under
`src/` that mirror the proposed packages:

-   `src/domain`: error codes and resource limits.
-   `src/scene`: versioned scene schema, validation, templates and presets
    (the proposed `scene-schema` package).
-   `src/devices`: device asset definitions and registry.
-   `src/mockup-engine`: geometry, screen fitting and the renderer.
-   `src/upload`: header parsing, validation and decoding.
-   `src/export`: export sizing, readiness and output verification.
-   `src/observability`: structured logging.
-   `src/features` and `src/app`: UI.

Domain, scene, device and engine modules do not import from React, Next.js
or UI code, so they can move into packages unchanged.

Styling uses CSS Modules with design tokens in `src/app/globals.css`
instead of Tailwind CSS, to keep dependencies limited to the active
milestone.

## Consequences

-   One install, one build, simple scripts.
-   The render worker will need these modules; at that point the repository
    becomes a workspace and these folders move into `packages/`.
-   Boundary discipline is by convention until then.
