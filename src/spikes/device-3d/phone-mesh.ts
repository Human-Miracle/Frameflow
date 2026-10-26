import * as THREE from 'three';
import type { DeviceAsset, DeviceFinish, RoundedRect } from '@/devices/types';
import { smoothRoundedRect } from '@/mockup-engine/paths';

/**
 * Builds a 3D phone from the same DeviceAsset geometry the 2D renderer uses.
 * Units are device units (1 unit = 1 native screen pixel); x right, y up,
 * z towards the viewer, origin at the body centre.
 */
export const THICKNESS = 150;

const FINISH_COLOURS: Record<DeviceFinish, { metal: string; roughness: number; reflections: number }> = {
  graphite: { metal: '#6c6f75', roughness: 0.2, reflections: 2.4 },
  silver: { metal: '#e2e4e7', roughness: 0.18, reflections: 2.2 },
};

/** Adapts device-unit (y down, top-left origin) paths to centred, y-up shape space. */
function shapeFrom(asset: DeviceAsset, rect: RoundedRect, smoothing: number, inset = 0): THREE.Shape {
  const shape = new THREE.Shape();
  const cx = asset.body.width / 2;
  const cy = asset.body.height / 2;
  smoothRoundedRect(
    {
      moveTo: (x, y) => shape.moveTo(x - cx, cy - y),
      lineTo: (x, y) => shape.lineTo(x - cx, cy - y),
      bezierCurveTo: (a, b, c, d, x, y) =>
        shape.bezierCurveTo(a - cx, cy - b, c - cx, cy - d, x - cx, cy - y),
      closePath: () => shape.closePath(),
    },
    rect,
    smoothing,
    inset,
  );
  return shape;
}

export interface PhoneMeshOptions {
  finish: DeviceFinish;
  screen: THREE.Texture;
  /** Reflection strength of the cover glass over the screen; 0 keeps screen pixels untouched. */
  glassReflection: number;
}

export function buildPhone(asset: DeviceAsset, options: PhoneMeshOptions): THREE.Group {
  const group = new THREE.Group();
  const finish = FINISH_COLOURS[options.finish];
  const bevel = asset.frameWidth * 1.4;

  const metal = new THREE.MeshPhysicalMaterial({
    color: finish.metal,
    metalness: 1,
    roughness: finish.roughness,
    envMapIntensity: finish.reflections,
    clearcoat: 0.4,
    clearcoatRoughness: 0.15,
  });

  // No large triangle may sit under the screen: the software rasterizer computes wrong depth
  // for long triangles at an angle, which let the glass or body show through the screen.
  // So the body and the glass both have the screen cut out, and a subdivided backing plane
  // sits deep inside the body behind the hole.
  const screenHole = () => shapeFrom(asset, asset.screen, asset.cornerSmoothing);

  // Body: rounded slab whose bevel forms the polished rail around the edge.
  const bodyShape = shapeFrom(asset, asset.body, asset.cornerSmoothing, bevel);
  bodyShape.holes.push(screenHole());
  const body = new THREE.Mesh(
    new THREE.ExtrudeGeometry(bodyShape, {
      depth: THICKNESS - bevel * 2,
      bevelEnabled: true,
      bevelThickness: bevel,
      bevelSize: bevel,
      bevelSegments: 10,
      curveSegments: 48,
    }),
    metal,
  );
  body.position.z = -THICKNESS / 2 + bevel;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  const front = THICKNESS / 2;

  // Cover glass and black border, slightly glossy so the rim picks up the environment.
  // Cover glass and black border, slightly glossy so the rim picks up the environment.
  const glassShape = shapeFrom(asset, asset.body, asset.cornerSmoothing, asset.frameWidth * 0.55);
  glassShape.holes.push(screenHole());
  const glass = new THREE.Mesh(
    new THREE.ShapeGeometry(glassShape, 48),
    new THREE.MeshPhysicalMaterial({
      color: '#050506',
      roughness: 0.08,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
    }),
  );
  glass.position.z = front + 0.5;
  group.add(glass);

  // Rounded like the aperture so its corners never poke out past the body's rounded corners.
  const backing = new THREE.Mesh(
    new THREE.ShapeGeometry(screenHole(), 32),
    new THREE.MeshBasicMaterial({ color: '#000000' }),
  );
  group.add(backing);

  // Screen: a regular grid textured with a pre-masked image. Unlit and not tone mapped, so
  // screenshot pixels reach the output unchanged. Drawn opaque with alpha-to-coverage for the
  // rounded corners masked by an alpha test: SwiftShader dropped parts of the screen in the
  // transparent pass and ignored alpha-to-coverage.
  const screenGeometry = new THREE.PlaneGeometry(asset.screen.width, asset.screen.height, 8, 16);
  const screen = new THREE.Mesh(
    screenGeometry,
    new THREE.MeshBasicMaterial({ map: options.screen, toneMapped: false, alphaTest: 0.5 }),
  );
  screen.position.set(
    asset.screen.x + asset.screen.width / 2 - asset.body.width / 2,
    asset.body.height / 2 - (asset.screen.y + asset.screen.height / 2),
    front + 1,
  );
  group.add(screen);

  if (options.glassReflection > 0) {
    const reflection = new THREE.Mesh(
      new THREE.ShapeGeometry(shapeFrom(asset, asset.screen, asset.cornerSmoothing), 48),
      new THREE.MeshPhysicalMaterial({
        color: '#000000',
        roughness: 0.02,
        metalness: 0,
        transparent: true,
        opacity: options.glassReflection,
        depthWrite: false,
      }),
    );
    reflection.position.z = front + 9;
    group.add(reflection);
  }

  for (const button of asset.buttons) {
    const geometry = new THREE.BoxGeometry(button.depth * 2, button.length, THICKNESS * 0.45);
    const mesh = new THREE.Mesh(geometry, metal);
    const x = button.side === 'left' ? -asset.body.width / 2 : asset.body.width / 2;
    mesh.position.set(x, asset.body.height / 2 - button.y - button.length / 2, 0);
    mesh.castShadow = true;
    group.add(mesh);
  }

  return group;
}
