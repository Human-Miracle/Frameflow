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
- Scene persistence goes through `SceneRepository` (ADR 0010); never read
  IndexedDB directly from UI code.
- `src/spikes/` and `/lab/device-spike` are experiments (ADR 0011). Do not
  import them from product code until a decision moves them into the product.
- Pre-rendered device views are produced by `asset-pipeline/` and must pass
  its screen-mapping verification; never hand-edit `public/lab-assets`.
