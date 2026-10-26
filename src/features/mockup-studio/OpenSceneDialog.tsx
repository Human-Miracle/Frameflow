'use client';

import { useEffect, useRef, useState } from 'react';
import type { SavedSceneSummary } from '@/persistence/types';
import { STYLE_PRESETS } from '@/scene/presets';
import { TEMPLATES } from '@/scene/templates';
import styles from './MockupStudio.module.css';

interface Props {
  open: boolean;
  scenes: SavedSceneSummary[];
  currentId: string;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const label = (list: readonly { id: string; label: string }[], id: string) =>
  list.find((item) => item.id === id)?.label ?? id;

function Thumbnail({ blob }: { blob: Blob | null }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) return;
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl); // eslint-disable-line react-hooks/set-state-in-effect -- tied to the object URL lifecycle
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);
  if (!url) return <span className={styles.sceneThumb} />;
  // eslint-disable-next-line @next/next/no-img-element -- local object URL, not optimisable
  return <img src={url} alt="" className={styles.sceneThumb} />;
}

export function OpenSceneDialog({ open, scenes, currentId, onOpen, onDelete, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className={styles.dialog} aria-labelledby="open-scene-title" onClose={onClose}>
      <div className={styles.dialogHeader}>
        <h2 id="open-scene-title" className={styles.dialogTitle}>
          Saved scenes
        </h2>
        <button type="button" className={styles.textButton} onClick={onClose}>
          Close
        </button>
      </div>
      <p className={styles.help}>
        Scenes are saved in this browser on this device. Clearing site data deletes them.
      </p>
      {scenes.length === 0 ? (
        <p className={styles.emptyList}>No saved scenes yet. Use Save to keep the current scene.</p>
      ) : (
        <ul className={styles.sceneList} aria-label="Saved scenes">
          {scenes.map((scene) => (
            <li key={scene.id} className={styles.sceneItem}>
              <Thumbnail blob={scene.thumbnail} />
              <div className={styles.screenMeta}>
                <span className={styles.screenName}>
                  {scene.name}
                  {scene.id === currentId && <span className={styles.help}> (open now)</span>}
                </span>
                <span className={styles.help}>
                  {label(TEMPLATES, scene.templateId)} · {label(STYLE_PRESETS, scene.styleId)} ·{' '}
                  {scene.screenCount} screenshot{scene.screenCount === 1 ? '' : 's'} · saved{' '}
                  {new Date(scene.savedAt).toLocaleString()}
                </span>
              </div>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => onOpen(scene.id)}
                aria-label={`Open ${scene.name}`}
              >
                Open
              </button>
              <button
                type="button"
                className={styles.textButton}
                aria-label={`Delete ${scene.name}`}
                onClick={() => {
                  if (window.confirm(`Delete "${scene.name}"? This cannot be undone.`)) onDelete(scene.id);
                }}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </dialog>
  );
}
