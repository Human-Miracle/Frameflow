import type { Scene } from '@/scene/schema';

/** Metadata stored for each screenshot a saved scene uses. The bytes are stored separately. */
export interface SavedScreenMeta {
  id: string;
  name: string;
  format: 'png' | 'jpeg' | 'webp';
  width: number;
  height: number;
  bytes: number;
}

export interface SavedSceneSummary {
  id: string;
  name: string;
  savedAt: string;
  templateId: string;
  styleId: string;
  screenCount: number;
  /** Small PNG preview rendered from the scene. A derived image, never the source of truth. */
  thumbnail: Blob | null;
}

export interface SceneToSave {
  scene: Scene;
  screens: readonly { meta: SavedScreenMeta; blob: Blob }[];
  thumbnail: Blob | null;
}

export interface LoadedScene {
  scene: Scene;
  savedAt: string;
  screens: { meta: SavedScreenMeta; blob: Blob }[];
  /** Screenshots the record references but storage no longer holds. */
  missingScreenIds: string[];
}

/**
 * Where saved scenes live. The browser implementation uses IndexedDB; a
 * server-backed implementation can replace it without changing callers.
 * Implementations validate records on load and never return an unvalidated scene.
 */
export interface SceneRepository {
  list(): Promise<SavedSceneSummary[]>;
  load(id: string): Promise<LoadedScene>;
  save(input: SceneToSave): Promise<SavedSceneSummary>;
  remove(id: string): Promise<void>;
}
