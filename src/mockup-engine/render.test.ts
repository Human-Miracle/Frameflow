import { describe, expect, it } from 'vitest';
import { FRAMEFLOW_PHONE as phone } from '@/devices/frameflow-phone';
import { FrameflowError } from '@/domain/errors';
import { createScene } from '@/scene/templates';
import { renderScene, type Canvas2D, type ScreenLookup } from './render';

interface Call {
  method: string;
  args: unknown[];
  transform: number[];
}

/**
 * A recording 2D context that tracks the current transform, so tests can check
 * where screenshots land without a real canvas.
 */
function recordingContext(): { ctx: Canvas2D; calls: Call[] } {
  const calls: Call[] = [];
  let m = [1, 0, 0, 1, 0, 0];
  const stack: number[][] = [];
  const multiply = (n: number[]) => {
    const [a, b, c, d, e, f] = m as [number, number, number, number, number, number];
    const [A, B, C, D, E, F] = n as [number, number, number, number, number, number];
    m = [a * A + c * B, b * A + d * B, a * C + c * D, b * C + d * D, a * E + c * F + e, b * E + d * F + f];
  };
  const gradient = { addColorStop: () => undefined };
  const handlers: Record<string, (...args: number[]) => unknown> = {
    save: () => stack.push([...m]),
    restore: () => {
      m = stack.pop() ?? [1, 0, 0, 1, 0, 0];
    },
    setTransform: (...args) => {
      m = args;
    },
    translate: (x, y) => multiply([1, 0, 0, 1, x!, y!]),
    scale: (x, y) => multiply([x!, 0, 0, y!, 0, 0]),
    rotate: (angle) =>
      multiply([Math.cos(angle!), Math.sin(angle!), -Math.sin(angle!), Math.cos(angle!), 0, 0]),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  };
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(target, prop: string) {
      if (prop in target) return target[prop];
      return (...args: number[]) => {
        calls.push({ method: prop, args, transform: [...m] });
        return handlers[prop]?.(...args);
      };
    },
    set(target, prop: string, value) {
      target[prop] = value;
      return true;
    },
  });
  return { ctx: ctx as unknown as Canvas2D, calls };
}

const image = (id: string) => ({ source: { id } as unknown as CanvasImageSource, width: 1179, height: 2556 });
const screens: ScreenLookup = (id) => image(id);

describe('renderScene', () => {
  it('draws screenshots in layer order, bottom first', () => {
    const scene = createScene({ id: 's', templateId: 'trio-stack', screenAssetIds: ['a', 'b', 'c'] });
    const { ctx, calls } = recordingContext();
    renderScene(ctx, scene, { width: 1920, height: 1080 }, screens);
    const drawn = calls
      .filter((c) => c.method === 'drawImage')
      .map((c) => (c.args[0] as unknown as { id: string }).id);
    expect(drawn).toEqual(['a', 'b', 'c']);
  });

  it('maps the screenshot onto the aperture at the expected canvas position', () => {
    const scene = createScene({ id: 's', templateId: 'single-hero', screenAssetIds: ['a'] });
    const size = { width: 1920, height: 1080 };
    const { ctx, calls } = recordingContext();
    renderScene(ctx, scene, size, screens);
    const draw = calls.find((c) => c.method === 'drawImage')!;
    const [, , , , , dx, dy, dw, dh] = draw.args as number[];
    const [a, , , d, e, f] = draw.transform as [number, number, number, number, number, number];
    const transform = scene.layers[0]!.transform;
    const scale = (transform.height * size.height) / phone.body.height;
    expect(a).toBeCloseTo(scale);
    expect(e + a * dx!).toBeCloseTo(
      size.width * transform.x - (phone.body.width / 2 - phone.screen.x) * scale,
    );
    expect(f + d * dy!).toBeCloseTo(
      size.height * transform.y - (phone.body.height / 2 - phone.screen.y) * scale,
    );
    expect(dw! * a).toBeCloseTo(phone.screen.width * scale);
    expect(dh! * d).toBeCloseTo(phone.screen.height * scale);
  });

  it('produces the same drawing commands for the same inputs (deterministic)', () => {
    const scene = createScene({
      id: 's',
      templateId: 'trio-stack',
      styleId: 'cinematic',
      screenAssetIds: ['a'],
    });
    const first = recordingContext();
    const second = recordingContext();
    renderScene(first.ctx, scene, { width: 800, height: 450 }, screens);
    renderScene(second.ctx, scene, { width: 800, height: 450 }, screens);
    expect(second.calls).toEqual(first.calls);
  });

  it('leaves empty screens dark instead of inventing content', () => {
    const scene = createScene({ id: 's', templateId: 'single-hero' });
    const { ctx, calls } = recordingContext();
    renderScene(ctx, scene, { width: 800, height: 450 }, screens);
    expect(calls.some((c) => c.method === 'drawImage')).toBe(false);
  });

  it('reports a missing screenshot rather than rendering a corrupt scene', () => {
    const scene = createScene({ id: 's', templateId: 'single-hero', screenAssetIds: ['gone'] });
    const { ctx } = recordingContext();
    expect(() => renderScene(ctx, scene, { width: 800, height: 450 }, () => undefined)).toThrow(
      FrameflowError,
    );
  });
});
