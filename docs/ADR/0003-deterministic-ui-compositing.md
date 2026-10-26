# ADR 0003: Deterministic UI Compositing

Status: Accepted

## Context

AI-generated images can distort text, icons, and interface details.
Frameflow's value depends on accurate presentation of real product UI.

## Decision

Use deterministic screen mapping and compositing for source interfaces.
AI may be explored for optional background concepts or assistance, but
must not redraw the source UI in the core rendering path.

## Consequences

-   Better fidelity and repeatability.
-   Device masks and transforms need explicit geometry.
-   Visual quality depends on asset quality and renderer correctness.
