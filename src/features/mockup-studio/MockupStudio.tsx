'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { toFrameflowError } from '@/domain/errors';
import { MAX_SESSION_SCREENS, UPLOAD_LIMITS } from '@/domain/limits';
import { DEVICE_ASSETS } from '@/devices/registry';
import { exportScenePng } from '@/export/export-png';
import { EXPORT_SIZES, exportFileName, exportReadiness } from '@/export/output';
import { fitScreen } from '@/mockup-engine/geometry';
import type { ScreenLookup } from '@/mockup-engine/render';
import { BACKGROUND_PRESETS, STYLE_PRESETS } from '@/scene/presets';
import type { Scene } from '@/scene/schema';
import { TEMPLATES } from '@/scene/templates';
import { ACCEPTED_MIME_TYPES } from '@/upload/validate';
import { decodeScreenshot } from '@/upload/decode';
import { OptionGroup, Panel, RangeField } from './controls';
import { ScenePreview } from './ScenePreview';
import { canRedo, canUndo, editorReducer, initialEditorState } from './history';
import { OpenSceneDialog } from './OpenSceneDialog';
import { initialStudioState, type LayerMove, type ScreenEntry } from './state';
import { useSceneDocument } from './useSceneDocument';
import styles from './MockupStudio.module.css';

type UploadStatus =
  | { kind: 'idle' }
  | { kind: 'processing'; count: number }
  | { kind: 'error'; message: string };
type ExportStatus =
  | { kind: 'idle' }
  | { kind: 'rendering' }
  | { kind: 'success'; forScene: Scene; fileName: string; width: number; height: number; bytes: number }
  | { kind: 'error'; forScene: Scene; message: string };

const percent = (value: number) => `${Math.round(value * 100)}%`;
const megabytes = (bytes: number) => `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export function MockupStudio() {
  const [editor, dispatch] = useReducer(editorReducer, undefined, () =>
    initialEditorState(initialStudioState(crypto.randomUUID())),
  );
  const state = editor.studio;
  const [openDialog, setOpenDialog] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({ kind: 'idle' });
  const [rawExportStatus, setExportStatus] = useState<ExportStatus>({ kind: 'idle' });
  const [dragging, setDragging] = useState(false);
  // Number of finished upload batches; exposed on the drop zone so automation can wait for completion.
  const [uploadBatches, setUploadBatches] = useState(0);
  const { scene, screens, selectedLayerId } = state;

  // Release decoded bitmaps and thumbnail URLs when the workspace closes.
  const screensRef = useRef<ScreenEntry[]>([]);
  useEffect(() => {
    screensRef.current = screens;
  }, [screens]);
  useEffect(
    () => () => {
      for (const screen of screensRef.current) {
        screen.bitmap.close();
        URL.revokeObjectURL(screen.thumbnailUrl);
      }
    },
    [],
  );

  const lookup: ScreenLookup = useMemo(() => {
    const byId = new Map(screens.map((screen) => [screen.id, screen]));
    return (id) => {
      const screen = byId.get(id);
      return screen ? { source: screen.bitmap, width: screen.width, height: screen.height } : undefined;
    };
  }, [screens]);

  const sceneDoc = useSceneDocument(editor, dispatch, lookup);
  const checkpoint = useCallback(() => dispatch({ type: 'checkpoint' }), []);

  // Undo, redo and save shortcuts. Text fields keep their own undo.
  const shortcuts = useRef({ save: sceneDoc.save });
  useEffect(() => {
    shortcuts.current = { save: sceneDoc.save };
  }, [sceneDoc.save]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      const target = event.target as HTMLElement | null;
      if (target?.matches('input[type="text"], textarea')) return;
      const key = event.key.toLowerCase();
      if (key === 'z') {
        event.preventDefault();
        dispatch({ type: event.shiftKey ? 'redo' : 'undo' });
      } else if (key === 'y') {
        event.preventDefault();
        dispatch({ type: 'redo' });
      } else if (key === 's') {
        event.preventDefault();
        void shortcuts.current.save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Any edit makes a previous export result stale, so results are shown only for the scene they came from.
  const exportStatus: ExportStatus =
    (rawExportStatus.kind === 'success' || rawExportStatus.kind === 'error') &&
    rawExportStatus.forScene !== scene
      ? { kind: 'idle' }
      : rawExportStatus;

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const list = Array.from(files);
    if (list.length === 0) return;
    if (screensRef.current.length + list.length > MAX_SESSION_SCREENS) {
      setUploadStatus({
        kind: 'error',
        message: `You can work with up to ${MAX_SESSION_SCREENS} screenshots at a time. Remove one first.`,
      });
      return;
    }
    setUploadStatus({ kind: 'processing', count: list.length });
    const failures: string[] = [];
    for (const file of list) {
      try {
        const screen = await decodeScreenshot(file, file.name);
        dispatch({ type: 'screenAdded', screen });
      } catch (error) {
        failures.push(`${file.name}: ${toFrameflowError(error).message}`);
      }
    }
    setUploadStatus(failures.length > 0 ? { kind: 'error', message: failures.join(' ') } : { kind: 'idle' });
    setUploadBatches((count) => count + 1);
  }, []);

  const removeScreen = (screen: ScreenEntry) => {
    dispatch({ type: 'screenRemoved', screenId: screen.id });
    screen.bitmap.close();
    URL.revokeObjectURL(screen.thumbnailUrl);
  };

  const moveLayer = (layerId: string, to: LayerMove) => dispatch({ type: 'layerMoved', layerId, to });

  const readiness = exportReadiness(scene);
  const selected = scene.layers.find((layer) => layer.id === selectedLayerId) ?? null;
  const selectedAsset = selected ? DEVICE_ASSETS.get(selected.deviceAssetId) : undefined;
  const selectedScreen = selected?.screen.assetId
    ? screens.find((s) => s.id === selected.screen.assetId)
    : undefined;
  const crop =
    selected && selectedAsset && selectedScreen
      ? fitScreen(selectedScreen, selectedAsset.screen, selected.screen.fit, selected.screen.anchor)
          .cropFraction
      : 0;
  const exportSizeId =
    EXPORT_SIZES.find((size) => size.width === scene.canvas.width && size.height === scene.canvas.height)
      ?.id ?? '4k';

  const runExport = async () => {
    setExportStatus({ kind: 'rendering' });
    try {
      const result = await exportScenePng(scene, lookup);
      const fileName = exportFileName(scene);
      const url = URL.createObjectURL(result.blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = fileName;
      anchor.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
      setExportStatus({
        kind: 'success',
        forScene: scene,
        fileName,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
      });
    } catch (error) {
      setExportStatus({ kind: 'error', forScene: scene, message: toFrameflowError(error).message });
    }
  };

  return (
    <main className={styles.workspace}>
      <h1 className="visually-hidden">Mockup Studio</h1>

      <aside className={styles.sidebar} aria-label="Scene setup">
        <Panel title="Screenshots">
          <div
            className={styles.dropzone}
            data-dragging={dragging}
            data-upload-batches={uploadBatches}
            aria-busy={uploadStatus.kind === 'processing'}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              void handleFiles(event.dataTransfer.files);
            }}
          >
            <label htmlFor="screenshot-input" className={styles.uploadButton}>
              Upload screenshot
            </label>
            <input
              id="screenshot-input"
              type="file"
              accept={ACCEPTED_MIME_TYPES.join(',')}
              multiple
              className="visually-hidden"
              aria-describedby="upload-help"
              onChange={(event) => {
                if (event.target.files) void handleFiles(event.target.files);
                event.target.value = '';
              }}
            />
            <p id="upload-help" className={styles.help}>
              PNG, JPEG or WebP, up to {UPLOAD_LIMITS.maxBytes / (1024 * 1024)} MB. Or drop files here.
              Screenshots stay in this browser.
            </p>
          </div>
          <div aria-live="polite">
            {uploadStatus.kind === 'processing' && (
              <p className={styles.help}>Checking {uploadStatus.count} file(s)…</p>
            )}
          </div>
          {uploadStatus.kind === 'error' && (
            <p className={styles.errorMessage} role="alert">
              {uploadStatus.message}
            </p>
          )}
          {screens.length > 0 && (
            <ul className={styles.screenList} aria-label="Uploaded screenshots">
              {screens.map((screen) => (
                <li key={screen.id} className={styles.screenItem}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- local object URL, not optimisable */}
                  <img src={screen.thumbnailUrl} alt="" className={styles.thumb} />
                  <div className={styles.screenMeta}>
                    <span className={styles.screenName}>{screen.name}</span>
                    <span className={styles.help}>
                      {screen.width} × {screen.height} · {screen.format.toUpperCase()}
                    </span>
                  </div>
                  <button
                    type="button"
                    className={styles.textButton}
                    onClick={() => removeScreen(screen)}
                    aria-label={`Remove ${screen.name}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Template">
          <OptionGroup
            legend="Template"
            name="template"
            value={scene.templateId}
            options={TEMPLATES.map((t) => ({ value: t.id, label: t.label, description: t.description }))}
            onChange={(templateId) => dispatch({ type: 'templateChanged', templateId })}
          />
        </Panel>

        <Panel title="Style">
          <OptionGroup
            legend="Style"
            name="style"
            layout="segmented"
            value={scene.styleId}
            options={STYLE_PRESETS.map((s) => ({ value: s.id, label: s.label }))}
            onChange={(styleId) => dispatch({ type: 'styleChanged', styleId })}
          />
          <p className={styles.help}>{STYLE_PRESETS.find((s) => s.id === scene.styleId)?.description}</p>
        </Panel>

        <Panel title="Background">
          <fieldset className={styles.fieldset}>
            <legend className="visually-hidden">Background</legend>
            <div className={styles.swatches}>
              {BACKGROUND_PRESETS.map((preset) => (
                <label
                  key={preset.id}
                  className={styles.swatch}
                  data-checked={scene.background.presetId === preset.id}
                >
                  <input
                    type="radio"
                    name="background"
                    className="visually-hidden"
                    checked={scene.background.presetId === preset.id}
                    onChange={() => dispatch({ type: 'backgroundChanged', presetId: preset.id })}
                  />
                  <span className={styles.swatchChip} data-preset={preset.id} aria-hidden="true" />
                  <span className={styles.swatchLabel}>{preset.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </Panel>
      </aside>

      <section className={styles.canvasColumn} aria-label="Preview">
        <div className={styles.toolbar} role="toolbar" aria-label="Scene">
          <input
            key={`${scene.id}:${scene.name}`}
            type="text"
            className={styles.nameInput}
            aria-label="Scene name"
            defaultValue={scene.name}
            maxLength={120}
            onBlur={(event) => {
              if (event.target.value.trim() && event.target.value !== scene.name) {
                dispatch({ type: 'sceneRenamed', name: event.target.value.trim() });
                checkpoint();
              } else {
                event.target.value = scene.name;
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.currentTarget.blur();
            }}
          />
          <span className={styles.saveState} data-testid="save-state" aria-live="polite">
            {sceneDoc.status.kind === 'busy'
              ? sceneDoc.status.label
              : sceneDoc.dirty
                ? sceneDoc.saved || sceneDoc.savedAt
                  ? 'Unsaved changes'
                  : 'Not saved yet'
                : sceneDoc.savedAt
                  ? `Saved ${new Date(sceneDoc.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : 'Not saved yet'}
          </span>
          <div className={styles.toolbarGroup}>
            <button
              type="button"
              className={styles.toolButton}
              onClick={() => dispatch({ type: 'undo' })}
              disabled={!canUndo(editor)}
              aria-keyshortcuts="Control+Z Meta+Z"
            >
              Undo
            </button>
            <button
              type="button"
              className={styles.toolButton}
              onClick={() => dispatch({ type: 'redo' })}
              disabled={!canRedo(editor)}
              aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z Control+Y"
            >
              Redo
            </button>
          </div>
          <div className={styles.toolbarGroup}>
            <button type="button" className={styles.toolButton} onClick={sceneDoc.newScene}>
              New
            </button>
            <button
              type="button"
              className={styles.toolButton}
              onClick={() => {
                setOpenDialog(true);
                void sceneDoc.refreshList();
              }}
            >
              Open…
            </button>
            <button
              type="button"
              className={styles.toolButton}
              onClick={() => void sceneDoc.saveCopy()}
              disabled={sceneDoc.status.kind === 'busy'}
            >
              Save as copy
            </button>
            <button
              type="button"
              className={`${styles.toolButton} ${styles.toolButtonPrimary}`}
              onClick={() => void sceneDoc.save()}
              disabled={sceneDoc.status.kind === 'busy'}
              aria-keyshortcuts="Control+S Meta+S"
            >
              Save
            </button>
          </div>
        </div>
        {sceneDoc.status.kind === 'error' && (
          <p className={`${styles.errorMessage} ${styles.toolbarMessage}`} role="alert">
            {sceneDoc.status.message}
          </p>
        )}
        {sceneDoc.status.kind === 'notice' && (
          <p className={`${styles.warningMessage} ${styles.toolbarMessage}`} role="alert">
            {sceneDoc.status.message}
          </p>
        )}
        <ScenePreview
          scene={scene}
          screens={lookup}
          selectedLayerId={selectedLayerId}
          onSelect={(layerId) => dispatch({ type: 'layerSelected', layerId })}
        />
        {screens.length === 0 && (
          <p className={styles.emptyHint}>Upload a screenshot to place it in the device.</p>
        )}
      </section>

      <aside className={styles.sidebar} aria-label="Device and export settings">
        <Panel title="Devices">
          <ul className={styles.layerList} aria-label="Devices, front to back">
            {[...scene.layers].reverse().map((layer, index) => (
              <li key={layer.id} className={styles.layerRow}>
                <button
                  type="button"
                  className={styles.layerButton}
                  aria-pressed={layer.id === selectedLayerId}
                  onClick={() => dispatch({ type: 'layerSelected', layerId: layer.id })}
                >
                  <span>{layer.name}</span>
                  <span className={styles.help}>
                    {[
                      !layer.visible && 'Hidden',
                      layer.locked && 'Locked',
                      !layer.screen.assetId && 'No screenshot',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </button>
                <button
                  type="button"
                  className={styles.orderButton}
                  aria-label={`Move ${layer.name} forward`}
                  disabled={index === 0}
                  onClick={() => moveLayer(layer.id, 'forward')}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className={styles.orderButton}
                  aria-label={`Move ${layer.name} backward`}
                  disabled={index === scene.layers.length - 1}
                  onClick={() => moveLayer(layer.id, 'backward')}
                >
                  ↓
                </button>
              </li>
            ))}
          </ul>

          {selected && selectedAsset ? (
            <div className={styles.layerControls}>
              <div className={styles.field}>
                <label htmlFor="screen-select">Screenshot</label>
                <select
                  id="screen-select"
                  className={styles.select}
                  value={selected.screen.assetId ?? ''}
                  onChange={(event) =>
                    dispatch({
                      type: 'screenAssigned',
                      layerId: selected.id,
                      screenId: event.target.value || null,
                    })
                  }
                >
                  <option value="">None</option>
                  {screens.map((screen) => (
                    <option key={screen.id} value={screen.id}>
                      {screen.name}
                    </option>
                  ))}
                </select>
              </div>
              <OptionGroup
                legend="Screen fit"
                name="fit"
                layout="segmented"
                value={selected.screen.fit}
                options={[
                  { value: 'cover', label: 'Fill screen' },
                  { value: 'contain', label: 'Show all' },
                ]}
                onChange={(fit) => dispatch({ type: 'fitChanged', layerId: selected.id, fit })}
              />
              {crop > 0.005 && (
                <p className={styles.warningMessage}>
                  {percent(crop)} of this screenshot is cropped because its shape differs from the screen (
                  {selectedAsset.screen.nativeWidth} × {selectedAsset.screen.nativeHeight}). Choose Show all
                  to see the whole image.
                </p>
              )}
              <RangeField
                label="Horizontal position"
                value={selected.transform.x}
                min={0}
                max={1}
                step={0.005}
                format={percent}
                disabled={selected.locked}
                onCommit={checkpoint}
                onChange={(x) => dispatch({ type: 'transformChanged', layerId: selected.id, patch: { x } })}
              />
              <RangeField
                label="Vertical position"
                value={selected.transform.y}
                min={0}
                max={1}
                step={0.005}
                format={percent}
                disabled={selected.locked}
                onCommit={checkpoint}
                onChange={(y) => dispatch({ type: 'transformChanged', layerId: selected.id, patch: { y } })}
              />
              <RangeField
                label="Size"
                value={selected.transform.height}
                min={0.2}
                max={1.4}
                step={0.01}
                format={percent}
                disabled={selected.locked}
                onCommit={checkpoint}
                onChange={(height) =>
                  dispatch({ type: 'transformChanged', layerId: selected.id, patch: { height } })
                }
              />
              <RangeField
                label="Rotation"
                value={selected.transform.rotation}
                min={selectedAsset.supportedTransforms.rotationDegrees.min}
                max={selectedAsset.supportedTransforms.rotationDegrees.max}
                step={0.5}
                format={(value) => `${value}°`}
                disabled={selected.locked}
                onCommit={checkpoint}
                onChange={(rotation) =>
                  dispatch({ type: 'transformChanged', layerId: selected.id, patch: { rotation } })
                }
              />
              <div className={styles.checkRow}>
                <label>
                  <input
                    type="checkbox"
                    checked={selected.visible}
                    onChange={() => dispatch({ type: 'visibilityToggled', layerId: selected.id })}
                  />{' '}
                  Visible
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={selected.locked}
                    onChange={() => dispatch({ type: 'lockToggled', layerId: selected.id })}
                  />{' '}
                  Locked
                </label>
              </div>
            </div>
          ) : (
            <p className={styles.help}>Select a device in the list or click it in the preview.</p>
          )}
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() => dispatch({ type: 'layoutReset' })}
          >
            Reset layout
          </button>
        </Panel>

        <Panel title="Export">
          <div className={styles.field}>
            <label htmlFor="export-size">Size</label>
            <select
              id="export-size"
              className={styles.select}
              value={exportSizeId}
              onChange={(event) => {
                const size = EXPORT_SIZES.find((s) => s.id === event.target.value);
                if (size) dispatch({ type: 'canvasResized', width: size.width, height: size.height });
              }}
            >
              {EXPORT_SIZES.map((size) => (
                <option key={size.id} value={size.id}>
                  {size.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className={styles.primaryButton}
            onClick={() => void runExport()}
            disabled={!readiness.ok || exportStatus.kind === 'rendering'}
            aria-describedby="export-status"
          >
            {exportStatus.kind === 'rendering' ? 'Exporting…' : 'Export PNG'}
          </button>
          <div id="export-status" aria-live="polite">
            {!readiness.ok && <p className={styles.help}>{readiness.error.message}</p>}
            {exportStatus.kind === 'rendering' && (
              <p className={styles.help}>
                Rendering {scene.canvas.width} × {scene.canvas.height} px…
              </p>
            )}
            {exportStatus.kind === 'success' && (
              <p className={styles.successMessage} data-testid="export-success">
                Exported {exportStatus.fileName} · {exportStatus.width} × {exportStatus.height} px ·{' '}
                {megabytes(exportStatus.bytes)}. Check your downloads.
              </p>
            )}
          </div>
          {exportStatus.kind === 'error' && (
            <p className={styles.errorMessage} role="alert">
              Export failed: {exportStatus.message}
            </p>
          )}
        </Panel>
      </aside>
      <OpenSceneDialog
        open={openDialog}
        scenes={sceneDoc.savedScenes}
        currentId={scene.id}
        onClose={() => setOpenDialog(false)}
        onDelete={(id) => void sceneDoc.remove(id)}
        onOpen={(id) => {
          setOpenDialog(false);
          void sceneDoc.open(id);
        }}
      />
    </main>
  );
}
