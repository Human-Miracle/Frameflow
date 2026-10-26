# ADR 0004: 2.5D Before Full 3D

Status: Accepted, subject to proof-of-concept validation

## Context

The references require premium depth and realism, but a full 3D editor
adds significant implementation and asset complexity.

## Decision

Begin with licensed/original device assets, accurate screen apertures,
perspective mapping, compositing, and controlled shadow/reflection
layers. Reassess full 3D only after testing the first compositions.

## Consequences

-   Faster path to usable visuals.
-   Some arbitrary rotations and dynamic lighting will be unsupported.
-   Asset licensing and screen geometry are critical.
-   Upgrade only when real requirements cannot be met by the initial
    approach.
