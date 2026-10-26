# ADR 0001: Browser-Based Product

Status: Accepted

## Context

Frameflow should be usable from a browser and should eventually serve
designers beyond its creator. A local desktop-only tool would increase
installation and distribution friction.

## Decision

Build Frameflow as a browser-based web application. Keep
resource-intensive video processing in a separate worker when
implemented.

## Consequences

Positive:

-   Easy access and deployment.
-   Natural path to commercial SaaS.
-   Shared application UI across operating systems.

Trade-offs:

-   Browser APIs and permissions constrain recording.
-   Heavy rendering requires careful resource management.
-   Persistent asset storage and authentication become necessary as multi-user use expands. 
