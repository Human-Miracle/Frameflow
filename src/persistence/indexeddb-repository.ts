import { FrameflowError } from '@/domain/errors';
import { traced } from '@/observability/logger';
import { buildRecord, parseRecord, referencedScreenIds, storageError, summarise } from './record';
import type { LoadedScene, SavedSceneSummary, SceneRepository, SceneToSave } from './types';

const DB_NAME = 'frameflow';
const DB_VERSION = 1;
const SCENES = 'scenes';
const SCREENS = 'screens';

interface StoredScreen {
  id: string;
  blob: Blob;
}

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function done(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new DOMException('Transaction aborted', 'AbortError'));
  });
}

export function indexedDbAvailable(): boolean {
  return typeof indexedDB !== 'undefined';
}

/**
 * Saves scenes in this browser's IndexedDB: one record per scene plus the
 * original screenshot files, shared between scenes by screen ID. Screenshots
 * no scene references are deleted on every save and delete.
 *
 * Limits: data stays on this device and browser profile, can be cleared by
 * the browser or the user, and is not synced or backed up.
 */
export class IndexedDbSceneRepository implements SceneRepository {
  private db: Promise<IDBDatabase> | null = null;

  constructor(
    private readonly dbName = DB_NAME,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private open(): Promise<IDBDatabase> {
    if (!indexedDbAvailable()) {
      return Promise.reject(
        new FrameflowError(
          'STORAGE_FAILURE',
          'This browser does not allow saving scenes (IndexedDB is unavailable).',
        ),
      );
    }
    const opening = (this.db ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(this.dbName, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(SCENES)) db.createObjectStore(SCENES, { keyPath: 'id' });
        if (!db.objectStoreNames.contains(SCREENS)) db.createObjectStore(SCREENS, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () =>
        reject(new FrameflowError('STORAGE_FAILURE', 'Close other Frameflow tabs, then try again.'));
    }).catch((error: unknown) => {
      this.db = null;
      throw storageError(error);
    }));
    return opening;
  }

  async list(): Promise<SavedSceneSummary[]> {
    return traced('scene.list', {}, async () => {
      try {
        const db = await this.open();
        const raw = await request(db.transaction(SCENES).objectStore(SCENES).getAll());
        return raw
          .map(parseRecord)
          .flatMap((record) => (record.ok ? [summarise(record.value)] : []))
          .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
      } catch (error) {
        throw storageError(error);
      }
    });
  }

  async load(id: string): Promise<LoadedScene> {
    return traced('scene.load', {}, async () => {
      try {
        const db = await this.open();
        const tx = db.transaction([SCENES, SCREENS]);
        const raw: unknown = await request(tx.objectStore(SCENES).get(id));
        if (raw === undefined)
          throw new FrameflowError('STORAGE_FAILURE', 'This saved scene no longer exists.');
        const record = parseRecord(raw);
        if (!record.ok) throw record.error;
        const screens: LoadedScene['screens'] = [];
        const missingScreenIds: string[] = [];
        for (const meta of record.value.screens) {
          const stored = (await request(tx.objectStore(SCREENS).get(meta.id))) as StoredScreen | undefined;
          if (stored?.blob instanceof Blob) screens.push({ meta, blob: stored.blob });
          else missingScreenIds.push(meta.id);
        }
        return { scene: record.value.scene, savedAt: record.value.savedAt, screens, missingScreenIds };
      } catch (error) {
        throw storageError(error);
      }
    });
  }

  async save(input: SceneToSave): Promise<SavedSceneSummary> {
    return traced(
      'scene.save',
      { layers: input.scene.layers.length, screens: input.screens.length },
      async () => {
        const record = buildRecord(input, this.now());
        if (!record.ok) throw record.error;
        try {
          const db = await this.open();
          const tx = db.transaction([SCENES, SCREENS], 'readwrite');
          const scenes = tx.objectStore(SCENES);
          const screens = tx.objectStore(SCREENS);
          scenes.put(record.value);
          for (const screen of input.screens)
            screens.put({ id: screen.meta.id, blob: screen.blob } satisfies StoredScreen);
          await this.collectGarbage(scenes, screens);
          await done(tx);
          return summarise(record.value);
        } catch (error) {
          throw storageError(error);
        }
      },
    );
  }

  async remove(id: string): Promise<void> {
    return traced('scene.delete', {}, async () => {
      try {
        const db = await this.open();
        const tx = db.transaction([SCENES, SCREENS], 'readwrite');
        const scenes = tx.objectStore(SCENES);
        scenes.delete(id);
        await this.collectGarbage(scenes, tx.objectStore(SCREENS));
        await done(tx);
      } catch (error) {
        throw storageError(error);
      }
    });
  }

  /** Deletes screenshots no saved scene references. Runs inside the caller's transaction. */
  private async collectGarbage(scenes: IDBObjectStore, screens: IDBObjectStore): Promise<void> {
    const keep = referencedScreenIds(await request(scenes.getAll()));
    const keys = await request(screens.getAllKeys());
    for (const key of keys) if (typeof key === 'string' && !keep.has(key)) screens.delete(key);
  }
}
