import * as THREE from 'three';
import { DEVICE_ASSETS, type DeviceRegistry } from '@/devices/registry';
import { paintOrder, type Size } from '@/mockup-engine/geometry';
import { paintBackground, type ScreenLookup } from '@/mockup-engine/render';
import type { Scene } from '@/scene/schema';
import { buildPhone, THICKNESS } from './phone-mesh';
import { composeScreen } from './screen-texture';
import { studioEnvironment } from './studio-environment';

/** Spike-only per-device view angles, in degrees. Not part of scene schema v1. */
export interface Orientation {
  yaw: number;
  pitch: number;
  /** Extra in-plane rotation added to the layer's own rotation. */
  roll?: number;
}

export interface Render3DOptions {
  orientations?: Readonly<Record<string, Orientation>>;
  glassReflection?: number;
  fieldOfView?: number;
}

/** Visible world height at the z = 0 plane; positions map from the scene's normalised units. */
const WORLD_HEIGHT = 10;

/**
 * Renders a scene with real-time 3D devices: physically based metal, cover
 * glass, image-based reflections from a procedural studio environment,
 * perspective and cast shadows. The background uses the 2D renderer's
 * painter so both paths share the same scene semantics.
 */
export function renderScene3D(
  scene: Scene,
  size: Size,
  screens: ScreenLookup,
  options: Render3DOptions = {},
  registry: DeviceRegistry = DEVICE_ASSETS,
): OffscreenCanvas {
  const output = new OffscreenCanvas(size.width, size.height);
  const ctx = output.getContext('2d');
  if (!ctx) throw new Error('2D canvas unavailable');
  paintBackground(ctx, scene.background, size);

  const glCanvas = new OffscreenCanvas(size.width, size.height);
  const renderer = new THREE.WebGLRenderer({
    canvas: glCanvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  const disposables: { dispose(): void }[] = [];
  try {
    renderer.setPixelRatio(1);
    renderer.setSize(size.width, size.height, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.VSMShadowMap;

    const cinematic = scene.styleId === 'cinematic';
    const world = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const environment = pmrem.fromScene(studioEnvironment(cinematic ? 'cinematic' : 'minimal'), 0.01).texture;
    disposables.push(pmrem, environment);
    world.environment = environment;
    world.environmentIntensity = cinematic ? 0.8 : 0.75;

    const aspect = size.width / size.height;
    const fov = options.fieldOfView ?? 18;
    const distance = WORLD_HEIGHT / 2 / Math.tan(THREE.MathUtils.degToRad(fov / 2));
    // Near and far hug the scene: the software renderer's depth buffer cannot separate the
    // screen from the glass beneath it with a wider range (that caused seams when angled).
    const depthRange = WORLD_HEIGHT * 2;
    const camera = new THREE.PerspectiveCamera(
      fov,
      aspect,
      Math.max(distance * 0.2, distance - depthRange),
      distance + depthRange,
    );
    camera.position.set(0, 0, distance);

    const layers = paintOrder(scene);
    let backmost = 0;
    layers.forEach((layer, index) => {
      const asset = registry.get(layer.deviceAssetId);
      if (!asset) throw new Error(`Unknown device ${layer.deviceAssetId}`);
      const unit = (layer.transform.height * WORLD_HEIGHT) / asset.body.height;
      // Later layers sit closer to the camera, so paint order still decides overlap.
      const z = index * THICKNESS * unit * 2.2;
      // Compensate perspective so position and size match the 2D layout.
      const perspective = (distance - z) / distance;

      const image = layer.screen.assetId ? screens(layer.screen.assetId) : undefined;
      if (layer.screen.assetId && !image) throw new Error(`Missing screenshot for ${layer.name}`);
      const texture = new THREE.CanvasTexture(composeScreen(asset, layer.screen, image));
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = true;
      texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      texture.minFilter = THREE.LinearMipmapLinearFilter;
      disposables.push(texture);

      const phone = buildPhone(asset, {
        finish: layer.finish,
        screen: texture,
        glassReflection: options.glassReflection ?? 0,
      });
      const orientation = options.orientations?.[layer.id] ?? { yaw: 0, pitch: 0 };
      phone.rotation.order = 'YXZ';
      phone.rotation.set(
        THREE.MathUtils.degToRad(orientation.pitch),
        THREE.MathUtils.degToRad(orientation.yaw),
        THREE.MathUtils.degToRad(-(layer.transform.rotation + (orientation.roll ?? 0))),
      );
      phone.scale.setScalar(unit * perspective);
      phone.position.set(
        (layer.transform.x - 0.5) * WORLD_HEIGHT * aspect * perspective,
        (0.5 - layer.transform.y) * WORLD_HEIGHT * perspective,
        z,
      );
      world.add(phone);
      backmost = Math.min(backmost, z - (THICKNESS / 2) * unit * 1.6);
    });

    // The devices lie on a surface; only its shadows are drawn over the 2D background.
    const shadowOpacity = Math.min(0.9, scene.lighting.shadow.opacity * (cinematic ? 1.2 : 2));
    const surface = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD_HEIGHT * aspect * 3, WORLD_HEIGHT * 3),
      new THREE.ShadowMaterial({ opacity: shadowOpacity, color: scene.lighting.shadow.color }),
    );
    surface.position.z = backmost;
    surface.receiveShadow = true;
    world.add(surface);

    const key = new THREE.DirectionalLight('#ffffff', cinematic ? 1.6 : 2.2);
    key.position.set(-WORLD_HEIGHT * 0.9, WORLD_HEIGHT * 1.3, WORLD_HEIGHT * 1.2);
    key.castShadow = true;
    key.shadow.mapSize.set(4096, 4096);
    key.shadow.radius = 18;
    key.shadow.blurSamples = 24;
    key.shadow.bias = -0.0004;
    const extent = WORLD_HEIGHT * aspect;
    Object.assign(key.shadow.camera, {
      left: -extent,
      right: extent,
      top: extent,
      bottom: -extent,
      near: 0.1,
      far: WORLD_HEIGHT * 6,
    });
    world.add(key);

    // Rim light from behind on the right picks out the metal edge, strongest in Cinematic.
    const rim = new THREE.DirectionalLight('#dfe6ff', 2.5 * scene.lighting.frameHighlight);
    rim.position.set(WORLD_HEIGHT * 1.2, WORLD_HEIGHT * 0.4, WORLD_HEIGHT * 0.2);
    world.add(rim);
    world.add(new THREE.AmbientLight('#ffffff', cinematic ? 0.05 : 0.2));

    renderer.render(world, camera);
    ctx.drawImage(glCanvas, 0, 0);

    world.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.geometry.dispose();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) material.dispose();
      }
    });
    return output;
  } finally {
    for (const item of disposables) item.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
  }
}
