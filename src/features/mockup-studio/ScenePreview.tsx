'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toFrameflowError } from '@/domain/errors';
import { DEVICE_ASSETS } from '@/devices/registry';
import { previewSize } from '@/export/output';
import { deviceToCanvas, hitTest, placeDevice } from '@/mockup-engine/geometry';
import { renderScene, type ScreenLookup } from '@/mockup-engine/render';
import type { Scene } from '@/scene/schema';
import styles from './MockupStudio.module.css';

interface Props {
  scene: Scene;
  screens: ScreenLookup;
  selectedLayerId: string | null;
  onSelect: (layerId: string | null) => void;
}

/**
 * Interactive preview. Draws with the same renderScene call as export, at a
 * bounded resolution that fits the workspace.
 */
export function ScenePreview({ scene, screens, selectedLayerId, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setBox({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const size = useMemo(
    () => (box.width > 0 && box.height > 0 ? previewSize(scene.canvas, box, window.devicePixelRatio) : null),
    [box, scene.canvas],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !size) return;
    const frame = requestAnimationFrame(() => {
      const ctx = canvas.getContext('2d', { colorSpace: 'srgb' });
      if (!ctx) return;
      try {
        renderScene(ctx, scene, size, screens);
        setError(null);
      } catch (cause) {
        setError(toFrameflowError(cause).message);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [scene, screens, size]);

  const handleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!size) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = {
      x: ((event.clientX - rect.left) / rect.width) * size.width,
      y: ((event.clientY - rect.top) / rect.height) * size.height,
    };
    onSelect(hitTest(scene, DEVICE_ASSETS, size, point));
  };

  const selected = scene.layers.find((layer) => layer.id === selectedLayerId);
  const selectedAsset = selected ? DEVICE_ASSETS.get(selected.deviceAssetId) : undefined;
  let outline: string | null = null;
  if (size && selected?.visible && selectedAsset) {
    // Drawn as an overlay in CSS pixels so the selection never reaches the export.
    const placement = placeDevice(selected, selectedAsset, { width: size.cssWidth, height: size.cssHeight });
    const { width, height } = selectedAsset.body;
    outline = [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: width, y: height },
      { x: 0, y: height },
    ]
      .map((corner) => deviceToCanvas(corner, selectedAsset, placement))
      .map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
      .join(' ');
  }

  const visibleCount = scene.layers.filter((layer) => layer.visible).length;

  return (
    <div ref={containerRef} className={styles.previewArea}>
      {size && (
        <div className={styles.stage} style={{ width: size.cssWidth, height: size.cssHeight }}>
          <canvas
            ref={canvasRef}
            className={`${styles.previewCanvas} ${scene.background.fill.kind === 'transparent' ? styles.checker : ''}`}
            width={size.width}
            height={size.height}
            onClick={handleClick}
            role="img"
            aria-label={`Preview of ${scene.name} with ${visibleCount} visible ${visibleCount === 1 ? 'device' : 'devices'}${selected ? `; ${selected.name} selected` : ''}. Click a device to select it.`}
            data-testid="scene-preview"
          />
          {outline && (
            <svg
              className={styles.selectionOverlay}
              viewBox={`0 0 ${size.cssWidth} ${size.cssHeight}`}
              aria-hidden="true"
            >
              <polygon points={outline} />
            </svg>
          )}
        </div>
      )}
      {error && (
        <p className={styles.previewError} role="alert">
          Preview failed: {error}
        </p>
      )}
    </div>
  );
}
