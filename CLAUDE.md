# Frameflow: agent instructions

Read `docs/CLAUDE_CODE_START_PROMPT.md` before starting any work. It
points to the rest of the project source of truth in `docs/` and
`docs/ADR/`.

If documents conflict, flag the conflict and propose a resolution
instead of guessing.

## Working in this repository

- Run `npm run check` and `npm run test:e2e` before reporting work as done.
- Domain modules (`src/domain`, `src/scene`, `src/devices`,
  `src/mockup-engine`, `src/upload`, `src/export`) must not import React,
  Next.js or UI code (ADR 0009).
- Preview and export must both go through `renderScene` (ADR 0008).
- Golden images in `tests/e2e/__snapshots__` change only after the new
  output has been inspected; update with
  `npx playwright test visual --update-snapshots`.
- Keep `docs/IMPLEMENTATION_STATUS.md` current at the end of each milestone.
