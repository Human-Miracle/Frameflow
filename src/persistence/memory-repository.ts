import { FrameflowError } from '@/domain/errors';
import { buildRecord, parseRecord, referencedScreenIds, summarise } from './record';
import type { LoadedScene, SavedSceneSummary, SceneRepository, SceneToSave } from './types';

/**
 * In-memory repository with the same behaviour as the IndexedDB one. Used in
 * unit tests; never used in the app as a silent fallback, because it would
 * appear to save while losing everything on reload.
 */
export class MemorySceneRepository implements SceneRepository {
  private readonly records = new Map<string, unknown>();
  private readonly blobs = new Map<string, Blob>();

  constructor(private readonly now: () => Date = () => new Date()) {}

  async list(): Promise<SavedSceneSummary[]> {
    const summaries: SavedSceneSummary[] = [];
    for (const raw of this.records.values()) {
      const record = parseRecord(raw);
      if (record.ok) summaries.push(summarise(record.value));
    }
    return summaries.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  }

  async load(id: string): Promise<LoadedScene> {
    const raw = this.records.get(id);
    if (raw === undefined) throw new FrameflowError('STORAGE_FAILURE', 'This saved scene no longer exists.');
    const record = parseRecord(raw);
    if (!record.ok) throw record.error;
    const screens: LoadedScene['screens'] = [];
    const missingScreenIds: string[] = [];
    for (const meta of record.value.screens) {
      const blob = this.blobs.get(meta.id);
      if (blob) screens.push({ meta, blob });
      else missingScreenIds.push(meta.id);
    }
    return { scene: record.value.scene, savedAt: record.value.savedAt, screens, missingScreenIds };
  }

  async save(input: SceneToSave): Promise<SavedSceneSummary> {
    const record = buildRecord(input, this.now());
    if (!record.ok) throw record.error;
    // Stored as a deep copy, the way IndexedDB's structured clone would.
    this.records.set(record.value.id, structuredClone(record.value));
    for (const screen of input.screens) this.blobs.set(screen.meta.id, screen.blob);
    this.collectGarbage();
    return summarise(record.value);
  }

  async remove(id: string): Promise<void> {
    this.records.delete(id);
    this.collectGarbage();
  }

  /** Test helper: simulates storage losing a screenshot. */
  dropScreen(id: string): void {
    this.blobs.delete(id);
  }

  /** Test helper: stores an arbitrary raw record, as a corrupted database might. */
  putRaw(id: string, raw: unknown): void {
    this.records.set(id, raw);
  }

  get screenCount(): number {
    return this.blobs.size;
  }

  private collectGarbage(): void {
    const keep = referencedScreenIds(this.records.values());
    for (const id of this.blobs.keys()) if (!keep.has(id)) this.blobs.delete(id);
  }
}
