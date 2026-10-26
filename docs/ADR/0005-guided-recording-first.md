# ADR 0005: Guided Recording Before Automatic Journey Generation

Status: Accepted

## Context

Figma prototype URLs do not guarantee universal access to every
interaction, animation, overlay, or state. Automatic journey
reconstruction is a high-risk feature.

## Decision

Validate and ship a guided recording workflow for explicitly supported
prototypes first. Investigate Figma Embed API and browser automation
options in a technical spike. Defer automatic journey generation.

## Consequences

-   Smaller initial scope and faster learning.
-   Users must perform the journey.
-   Compatibility limitations must be communicated clearly.
-   Capture workers require strict URL and network isolation.
