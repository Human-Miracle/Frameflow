import type { RoundedRect } from '@/devices/types';

type PathTarget = Pick<CanvasPath, 'moveTo' | 'lineTo' | 'bezierCurveTo' | 'closePath'>;

/**
 * Traces a rounded rectangle with smoothed ("continuous") corners: each corner
 * curve starts further along the edge than a circular arc would, which removes
 * the visible kink where the straight edge meets the curve. smoothing = 0
 * gives a standard circular corner.
 */
export function smoothRoundedRect(path: PathTarget, rect: RoundedRect, smoothing: number, inset = 0): void {
  const x = rect.x + inset;
  const y = rect.y + inset;
  const width = rect.width - inset * 2;
  const height = rect.height - inset * 2;
  const radius = Math.max(0, rect.cornerRadius - inset);
  const extent = Math.min(radius * (1 + smoothing), width / 2, height / 2);
  // 0.4477 places the control points of a circular quarter arc; smoothing pulls them further in.
  const handle = extent * (0.4477 - 0.16 * smoothing);
  const right = x + width;
  const bottom = y + height;

  path.moveTo(x + extent, y);
  path.lineTo(right - extent, y);
  path.bezierCurveTo(right - handle, y, right, y + handle, right, y + extent);
  path.lineTo(right, bottom - extent);
  path.bezierCurveTo(right, bottom - handle, right - handle, bottom, right - extent, bottom);
  path.lineTo(x + extent, bottom);
  path.bezierCurveTo(x + handle, bottom, x, bottom - handle, x, bottom - extent);
  path.lineTo(x, y + extent);
  path.bezierCurveTo(x, y + handle, x + handle, y, x + extent, y);
  path.closePath();
}
