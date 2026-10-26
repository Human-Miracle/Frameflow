# ADR 0002: Shared Versioned Scene Schema

Status: Accepted

## Context

Mockup images and prototype videos need consistent device framing,
background, typography, lighting, and layer ordering. Separate scene
implementations would drift.

## Decision

Represent each composition as a versioned, validated scene document.
Static and motion renderers consume the same scene semantics. Video adds
timeline/animation metadata without changing the static scene contract
unnecessarily.

## Consequences

-   Saved scenes remain editable.
-   Templates can be reused across outputs.
-   Schema migrations and renderer compatibility must be managed.
-   Rendered files are derived outputs, not the sole source of truth.
