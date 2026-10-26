'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch } from 'react';
import { toFrameflowError } from '@/domain/errors';
import type { ScreenLookup } from '@/mockup-engine/render';
import { IndexedDbSceneRepository } from '@/persistence/indexeddb-repository';
import type { SavedSceneSummary, SceneRepository } from '@/persistence/types';
import { documentKey, releaseScreens, renderThumbnail, restoreDocument, toSaveInput } from './documents';
import type { EditorAction, EditorState } from './history';
import { initialStudioState } from './state';

export type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'busy'; label: string }
  | { kind: 'error'; message: string }
  | { kind: 'notice'; message: string };

export interface SceneDocument {
  /** True when the workspace differs from what was last saved or opened. */
  dirty: boolean;
  /** Whether the current scene ID exists in storage. */
  saved: boolean;
  savedAt: string | null;
  status: SaveStatus;
  savedScenes: SavedSceneSummary[];
  refreshList: () => Promise<void>;
  save: () => Promise<void>;
  saveCopy: () => Promise<void>;
  open: (id: string) => Promise<void>;
  newScene: () => void;
  remove: (id: string) => Promise<void>;
}

const DISCARD_PROMPT = 'You have unsaved changes. Discard them?';

export function useSceneDocument(
  editor: EditorState,
  dispatch: Dispatch<EditorAction>,
  lookup: ScreenLookup,
  repository?: SceneRepository,
): SceneDocument {
  const repo = useMemo(() => repository ?? new IndexedDbSceneRepository(), [repository]);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });
  const [scenes, setScenes] = useState<SavedSceneSummary[]>([]);

  const { studio } = editor;
  const currentKey = useMemo(() => documentKey(studio), [studio]);
  const hasContent = studio.screens.length > 0 || editor.past.length > 0;
  const dirty = savedKey === null ? hasContent : currentKey !== savedKey;

  // Latest values for async callbacks and the unload guard.
  const latest = useRef({ studio, dirty, lookup });
  useEffect(() => {
    latest.current = { studio, dirty, lookup };
  }, [studio, dirty, lookup]);

  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (latest.current.dirty) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, []);

  const refreshList = useCallback(async () => {
    try {
      setScenes(await repo.list());
    } catch (error) {
      setStatus({ kind: 'error', message: toFrameflowError(error).message });
    }
  }, [repo]);

  const persist = useCallback(
    async (label: string, snapshot: Pick<EditorState['studio'], 'scene' | 'screens'>) => {
      setStatus({ kind: 'busy', label });
      try {
        const thumbnail = await renderThumbnail(snapshot.scene, latest.current.lookup);
        const summary = await repo.save(toSaveInput(snapshot, thumbnail));
        setSavedKey(documentKey(snapshot));
        setSavedAt(summary.savedAt);
        setStatus({ kind: 'idle' });
      } catch (error) {
        setStatus({ kind: 'error', message: `Not saved: ${toFrameflowError(error).message}` });
      }
    },
    [repo],
  );

  const save = useCallback(() => persist('Saving…', latest.current.studio), [persist]);

  const saveCopy = useCallback(async () => {
    const current = latest.current.studio;
    const id = crypto.randomUUID();
    const name = `${current.scene.name} copy`.slice(0, 120);
    dispatch({ type: 'sceneIdentityChanged', id, name });
    await persist('Saving copy…', { ...current, scene: { ...current.scene, id, name } });
  }, [dispatch, persist]);

  const open = useCallback(
    async (id: string) => {
      if (latest.current.dirty && !window.confirm(DISCARD_PROMPT)) return;
      setStatus({ kind: 'busy', label: 'Opening…' });
      try {
        const restored = await restoreDocument(await repo.load(id));
        releaseScreens(latest.current.studio.screens);
        dispatch({ type: 'documentLoaded', scene: restored.scene, screens: restored.screens });
        // Missing screenshots leave the document different from the saved record, so it stays unsaved.
        setSavedKey(
          restored.lost.length === 0 ? documentKey({ scene: restored.scene, screens: restored.screens }) : '',
        );
        const summary = (await repo.list()).find((scene) => scene.id === id);
        setSavedAt(summary?.savedAt ?? null);
        setStatus(
          restored.lost.length > 0
            ? {
                kind: 'notice',
                message: `Opened, but ${restored.lost.length} screenshot(s) could not be restored (${restored.lost.join(', ')}). Upload them again and assign them.`,
              }
            : { kind: 'idle' },
        );
      } catch (error) {
        setStatus({ kind: 'error', message: `Could not open the scene: ${toFrameflowError(error).message}` });
      }
    },
    [dispatch, repo],
  );

  const newScene = useCallback(() => {
    if (latest.current.dirty && !window.confirm(DISCARD_PROMPT)) return;
    releaseScreens(latest.current.studio.screens);
    const fresh = initialStudioState(crypto.randomUUID());
    dispatch({ type: 'documentLoaded', scene: fresh.scene, screens: [] });
    setSavedKey(null);
    setSavedAt(null);
    setStatus({ kind: 'idle' });
  }, [dispatch]);

  const remove = useCallback(
    async (id: string) => {
      try {
        await repo.remove(id);
        if (id === latest.current.studio.scene.id) {
          setSavedKey(null);
          setSavedAt(null);
        }
        await refreshList();
      } catch (error) {
        setStatus({ kind: 'error', message: `Could not delete: ${toFrameflowError(error).message}` });
      }
    },
    [refreshList, repo],
  );

  return {
    dirty,
    saved: savedKey !== null && savedAt !== null,
    savedAt,
    status,
    savedScenes: scenes,
    refreshList,
    save,
    saveCopy,
    open,
    newScene,
    remove,
  };
}
