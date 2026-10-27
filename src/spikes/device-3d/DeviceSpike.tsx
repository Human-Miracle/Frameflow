'use client';

import { useEffect, useState } from 'react';
import { toFrameflowError } from '@/domain/errors';
import { renderScene, type ScreenLookup } from '@/mockup-engine/render';
import type { Scene } from '@/scene/schema';
import { applyStyle, createScene } from '@/scene/templates';
import { decodeScreenshot, type DecodedScreen } from '@/upload/decode';
import bakedViews from '../../../asset-pipeline/frameflow-phone-v1/views.json';
import libraryViews from '../../../asset-pipeline/frameflow-phone-v2/views.json';
import {
  DEFAULT_SHADOW_STRENGTH,
  loadLibraryView,
  renderLibraryScene,
  type CompositeMode,
  type LibraryView,
} from '../baked/library';
import { loadBakedView, renderSceneBaked, type LoadedBakedView } from '../baked/render-baked';
import { renderScene3D, type Orientation } from './render-3d';
import styles from './spike.module.css';

type Renderer = 'canvas-2d' | 'webgl-3d' | 'baked' | 'library';

interface Settings {
  renderer: Renderer;
  templateId: 'single-hero' | 'trio-stack';
  styleId: 'minimal' | 'cinematic';
  yaw: number;
  pitch: number;
  roll: number;
  fov: number;
  glass: number;
  bakedViewId: string;
  /** Library view per template slot (layer ID). */
  libraryViews: Record<string, string>;
  compositeMode: CompositeMode;
  shadowStrength: number;
  width: number;
  height: number;
}

/** View presets modelled on common portfolio shots. */
export const VIEW_PRESETS = {
  straight: { label: 'Straight on', yaw: 0, pitch: 0, roll: 0, fov: 18 },
  hero: { label: 'Hero, low angle', yaw: -14, pitch: -24, roll: 0, fov: 32 },
  floating: { label: 'Floating tilt', yaw: 26, pitch: 14, roll: -8, fov: 22 },
  isometric: { label: 'Isometric', yaw: 0, pitch: 48, roll: 30, fov: 14 },
} as const;

/** Fans the three-device stack: outer phones turn a little further than the front one. */
export function orientationsFor(
  scene: Scene,
  yaw: number,
  pitch: number,
  roll = 0,
): Record<string, Orientation> {
  const fan: Record<string, number> = { left: 12, right: -12 };
  return Object.fromEntries(
    scene.layers.map((layer) => [layer.id, { yaw: yaw + (fan[layer.id] ?? 0), pitch, roll }]),
  );
}

const bakedCache = new Map<string, Promise<LoadedBakedView>>();
function bakedView(id: string): Promise<LoadedBakedView> {
  let view = bakedCache.get(id);
  if (!view) {
    view = loadBakedView(`/lab-assets/frameflow-phone/${id}`);
    bakedCache.set(id, view);
  }
  return view;
}

async function renderComparison(
  settings: Settings,
  screen: DecodedScreen,
): Promise<{ blob: Blob; ms: number }> {
  const scene = applyStyle(
    createScene({
      id: 'spike',
      templateId: settings.templateId,
      canvas: { width: settings.width, height: settings.height },
      screenAssetIds: [screen.id],
    }),
    settings.styleId,
  );
  const lookup: ScreenLookup = (id) =>
    id === screen.id ? { source: screen.bitmap, width: screen.width, height: screen.height } : undefined;
  const size = { width: settings.width, height: settings.height };
  const start = performance.now();
  let canvas: OffscreenCanvas;
  if (settings.renderer === 'library') {
    const views = new Map<string, LibraryView>();
    for (const layer of scene.layers) {
      views.set(layer.id, await loadLibraryView(settings.libraryViews[layer.id] ?? 'front'));
    }
    // Library views are lit as a studio shoot; in-plane rotation of the stack is kept as camera roll.
    canvas = renderLibraryScene(scene, size, lookup, views, {
      mode: settings.compositeMode,
      glare: settings.glass,
      shadowStrength: settings.shadowStrength,
    });
  } else if (settings.renderer === 'baked') {
    const view = await bakedView(settings.bakedViewId);
    canvas = renderSceneBaked(applyStyle(scene, view.meta.view.style), size, lookup, view, settings.glass);
  } else if (settings.renderer === 'webgl-3d') {
    canvas = renderScene3D(scene, size, lookup, {
      orientations: orientationsFor(scene, settings.yaw, settings.pitch, settings.roll),
      glassReflection: settings.glass,
      fieldOfView: settings.fov,
    });
  } else {
    canvas = new OffscreenCanvas(size.width, size.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D canvas unavailable');
    renderScene(ctx, scene, size, lookup);
  }
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return { blob, ms: Math.round(performance.now() - start) };
}

export function DeviceSpike() {
  const [screen, setScreen] = useState<DecodedScreen | null>(null);
  const [settings, setSettings] = useState<Settings>({
    renderer: 'webgl-3d',
    templateId: 'single-hero',
    styleId: 'cinematic',
    ...VIEW_PRESETS.floating,
    glass: 0,
    bakedViewId: bakedViews[0]!.id,
    libraryViews: { hero: 'front', left: 'angle-right', right: 'angle-left', center: 'three-quarter-right' },
    compositeMode: 'direct',
    shadowStrength: DEFAULT_SHADOW_STRENGTH,
    width: 1920,
    height: 1080,
  });
  const [result, setResult] = useState<{ url: string; ms: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(
    () => () => {
      if (result) URL.revokeObjectURL(result.url);
    },
    [result],
  );

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  const run = async () => {
    if (!screen) return;
    setBusy(true);
    setError(null);
    try {
      const { blob, ms } = await renderComparison(settings, screen);
      setResult({ url: URL.createObjectURL(blob), ms });
    } catch (cause) {
      setError(toFrameflowError(cause).message);
    } finally {
      setBusy(false);
    }
  };

  const angled = settings.renderer === 'webgl-3d';
  const glassEnabled = settings.renderer !== 'canvas-2d';

  return (
    <main className={styles.main}>
      <form
        className={styles.controls}
        onSubmit={(event) => {
          event.preventDefault();
          void run();
        }}
      >
        <h1 className="visually-hidden">Device rendering spike</h1>
        <p className={styles.banner} role="note">
          Experimental rendering spike for comparing approaches. It is not part of Mockup Studio, saves
          nothing, and its device is an original test model, not a photographed product.
        </p>
        <label className={styles.field}>
          Screenshot
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              try {
                screen?.bitmap.close();
                setScreen(await decodeScreenshot(file, file.name));
                setError(null);
              } catch (cause) {
                setError(toFrameflowError(cause).message);
              }
            }}
          />
        </label>
        <label className={styles.field}>
          Renderer
          <select value={settings.renderer} onChange={(e) => update('renderer', e.target.value as Renderer)}>
            <option value="canvas-2d">Current: Canvas 2D vector</option>
            <option value="webgl-3d">Spike: WebGL 3D (real time)</option>
            <option value="baked">Spike: pre-rendered view (Blender Cycles)</option>
            <option value="library">Library v2: pre-rendered angles (quality gate)</option>
          </select>
        </label>
        <label className={styles.field}>
          Layout
          <select
            value={settings.templateId}
            onChange={(e) => update('templateId', e.target.value as Settings['templateId'])}
          >
            <option value="single-hero">Single Hero</option>
            <option value="trio-stack">Cinematic Stack</option>
          </select>
        </label>
        <label className={styles.field}>
          Style
          <select
            value={settings.styleId}
            onChange={(e) => update('styleId', e.target.value as Settings['styleId'])}
          >
            <option value="minimal">Minimal</option>
            <option value="cinematic">Cinematic</option>
          </select>
        </label>
        {settings.renderer === 'library' && (
          <>
            {(settings.templateId === 'single-hero' ? ['hero'] : ['left', 'right', 'center']).map((slot) => (
              <label key={slot} className={styles.field}>
                Library view: {slot}
                <select
                  value={settings.libraryViews[slot]}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      libraryViews: { ...s.libraryViews, [slot]: e.target.value },
                    }))
                  }
                >
                  {libraryViews.map((view) => (
                    <option key={view.id} value={view.id}>
                      {view.label}
                    </option>
                  ))}
                </select>
              </label>
            ))}
            <label className={styles.field}>
              Screen compositing
              <select
                value={settings.compositeMode}
                onChange={(e) => update('compositeMode', e.target.value as CompositeMode)}
              >
                <option value="direct">Direct at output resolution (2×2 area sampling)</option>
                <option value="direct-trilinear">Direct, plain trilinear</option>
                <option value="two-step">Two-step (spike method)</option>
                <option value="reference">Reference, 8×8 supersampled (slow, for measurement)</option>
              </select>
            </label>
            <label className={styles.field}>
              Shadow strength {Math.round(settings.shadowStrength * 100)}%
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.shadowStrength}
                onChange={(e) => update('shadowStrength', Number(e.target.value))}
              />
            </label>
          </>
        )}
        {settings.renderer === 'baked' && (
          <label className={styles.field}>
            Pre-rendered view (lighting and style are baked in; one device)
            <select value={settings.bakedViewId} onChange={(e) => update('bakedViewId', e.target.value)}>
              {bakedViews.map((view) => (
                <option key={view.id} value={view.id}>
                  {view.id}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className={styles.field}>
          View preset{!angled && ' (3D only)'}
          <select
            disabled={!angled}
            defaultValue="floating"
            onChange={(e) => {
              const { yaw, pitch, roll, fov } = VIEW_PRESETS[e.target.value as keyof typeof VIEW_PRESETS];
              setSettings((s) => ({ ...s, yaw, pitch, roll, fov }));
            }}
          >
            {Object.entries(VIEW_PRESETS).map(([id, preset]) => (
              <option key={id} value={id}>
                {preset.label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          Yaw {settings.yaw}°{!angled && ' (3D only)'}
          <input
            type="range"
            min={-40}
            max={40}
            value={settings.yaw}
            disabled={!angled}
            onChange={(e) => update('yaw', Number(e.target.value))}
          />
        </label>
        <label className={styles.field}>
          Pitch {settings.pitch}°{!angled && ' (3D only)'}
          <input
            type="range"
            min={-30}
            max={30}
            value={settings.pitch}
            disabled={!angled}
            onChange={(e) => update('pitch', Number(e.target.value))}
          />
        </label>
        <label className={styles.field}>
          Roll {settings.roll}°{!angled && ' (3D only)'}
          <input
            type="range"
            min={-45}
            max={45}
            value={settings.roll}
            disabled={!angled}
            onChange={(e) => update('roll', Number(e.target.value))}
          />
        </label>
        <label className={styles.field}>
          Lens {settings.fov}° field of view{!angled && ' (3D only)'}
          <input
            type="range"
            min={10}
            max={45}
            value={settings.fov}
            disabled={!angled}
            onChange={(e) => update('fov', Number(e.target.value))}
          />
        </label>
        <label className={styles.field}>
          Glass reflection {Math.round(settings.glass * 100)}%{!glassEnabled && ' (3D only)'}
          <input
            type="range"
            min={0}
            max={0.3}
            step={0.01}
            value={settings.glass}
            disabled={!glassEnabled}
            onChange={(e) => update('glass', Number(e.target.value))}
          />
        </label>
        <label className={styles.field}>
          Size
          <select
            value={`${settings.width}x${settings.height}`}
            onChange={(e) => {
              const [w, h] = e.target.value.split('x').map(Number);
              setSettings((s) => ({ ...s, width: w!, height: h! }));
            }}
          >
            <option value="1920x1080">1920 × 1080</option>
            <option value="3840x2160">3840 × 2160</option>
          </select>
        </label>
        <button type="submit" className={styles.button} disabled={!screen || busy}>
          {busy ? 'Rendering…' : 'Render'}
        </button>
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </form>
      <section className={styles.stage} aria-label="Result">
        {result ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL */}
            <img
              src={result.url}
              alt="Rendered comparison"
              className={styles.result}
              data-testid="spike-result"
            />
            <p className={styles.meta} data-testid="spike-meta">
              Rendered in {result.ms} ms ·{' '}
              <a href={result.url} download={`spike-${settings.renderer}-${settings.templateId}.png`}>
                Download PNG
              </a>
            </p>
          </>
        ) : (
          <p className={styles.meta}>Upload a screenshot and render.</p>
        )}
      </section>
    </main>
  );
}
