# ADR 0010: Browser-Local Scene Persistence Behind a Repository Interface

Status: Accepted for the personal-first MVP
Date: 2026-10-26

## Context

Milestone 3 requires saving and reopening scenes with their settings and
screen assignments intact. The PRD asks to avoid unnecessary persistent
uploads, and the Engineering Blueprint says to add a database only when
durable project persistence is needed. There is no server, account system
or object storage yet.

A reopened scene is only useful if its screenshots come back too, so
storing the scene JSON alone is not enough.

## Decision

Store scenes in the browser's IndexedDB behind a `SceneRepository`
interface (`src/persistence/types.ts`):

-   One record per scene: record format version, scene document (schema
    v1), screenshot metadata, save time and a small rendered thumbnail.
-   Original screenshot files stored once per screen ID and shared between
    scenes ("Save as copy" reuses them). Files no scene references are
    deleted on every save and delete.
-   Records and files read back from storage are treated as untrusted:
    records are validated with the scene schema, and screenshots go through
    the same byte validation and decoding as new uploads. Missing or
    damaged screenshots are reported and their devices left empty.
-   If IndexedDB is unavailable, saving fails with a clear message. There
    is no silent in-memory fallback, because it would look like saving
    while losing work on reload. `MemorySceneRepository` exists for tests
    only.

Undo and redo are an editor concern, not stored: history holds scene
snapshots, a slider drag forms one step, and selection is not an edit.

## Consequences

-   Saved scenes stay on one browser profile on one device. They are not
    synced, backed up or shared, and clearing site data deletes them.
-   Storage is limited by the browser's quota; quota errors are reported.
-   A server implementation can replace the IndexedDB one without changing
    the editor, because callers depend only on `SceneRepository`.
-   Exported images stay derived outputs; the scene record is the source of
    truth.
