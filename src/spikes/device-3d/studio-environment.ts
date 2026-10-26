import * as THREE from 'three';

/**
 * A procedural photo studio used only for reflections: a room with softbox
 * panels and strip lights. Strip lights are what draw the crisp highlight
 * bands along polished metal rails in product photography. No external HDR
 * image is needed, so there is nothing to license.
 */
export function studioEnvironment(style: 'minimal' | 'cinematic'): THREE.Scene {
  const scene = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(40, 24, 40),
    new THREE.MeshBasicMaterial({ color: style === 'minimal' ? '#8d8b88' : '#1a1a1e', side: THREE.BackSide }),
  );
  scene.add(room);

  const light = (
    width: number,
    height: number,
    intensity: number,
    position: [number, number, number],
    target = new THREE.Vector3(),
  ) => {
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      new THREE.MeshBasicMaterial({
        color: new THREE.Color(intensity, intensity, intensity),
        side: THREE.DoubleSide,
      }),
    );
    panel.position.set(...position);
    panel.lookAt(target);
    scene.add(panel);
  };

  if (style === 'minimal') {
    light(16, 10, 2.2, [0, 11, 4]); // large overhead softbox
    light(3, 16, 3, [-14, 2, 6]); // left strip
    light(3, 16, 2.4, [14, 2, 6]); // right strip
    light(18, 6, 1.4, [0, 0, 18]); // front fill behind the camera
  } else {
    light(2.4, 18, 8, [-13, 2, 5]); // hard left strip: bright rail highlight
    light(2, 18, 6, [13, 1, 3]); // right rim strip
    light(10, 2, 1.6, [0, 11, 6]); // narrow top bar
  }
  return scene;
}
