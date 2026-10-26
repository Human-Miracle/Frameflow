# ADR 0006: Modular Monolith With Isolated Rendering Worker

Status: Accepted

## Context

The initial product needs cohesive domain logic, while browser capture
and video encoding are resource-intensive and potentially risky.

## Decision

Keep core product functionality in a modular web application. Introduce
a separate, isolated worker for browser recording and video rendering.
Do not create additional services without a clear need.

## Consequences

-   Simpler initial development.
-   Worker deployment and queueing add complexity when video arrives.
-   Security boundaries and resource controls are clearer.
