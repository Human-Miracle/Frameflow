# ADR 0007: Quality and Security Are Release Gates

Status: Accepted

## Context

Image fidelity, safe file handling, reliable exports, and secure browser
capture are core product requirements.

## Decision

Every milestone must pass relevant type checks, tests, and output
validation. Upload limits, structured logs, render timeouts, rate
limits, and browser isolation are required. Do not claim features are
implemented without evidence.

## Consequences

-   Some features ship later than a purely visual prototype.
-   Defects are detected earlier.
-   Operational costs and security risks are bounded.
