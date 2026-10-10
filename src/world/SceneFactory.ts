import * as THREE from 'three';
import type { Place } from '../data/places';
import { createStone } from './stone';

/**
 * Builds the 3D content for a single Place.
 *
 * The returned `stoneMesh` is the surface carvings will attach to in a later
 * prompt, so its identity and name are part of this module's contract.
 * Lighting, camera and renderer are NOT created here — that is PlaceViewer's
 * job — so the scene stays a pure "what is in this place" description.
 */

/** Everything a PlaceViewer needs to render one place. */
export interface SceneBundle {
  /** The scene graph for the place. */
  scene: THREE.Scene;
  /** The carvable stone surface. Carved names will be added to this mesh. */
  stoneMesh: THREE.Mesh;
}

export const SceneFactory = {
  /**
   * Create the scene for `place`.
   *
   * @param place The place to build. Its `seed` drives the stone shape.
   */
  create(place: Place): SceneBundle {
    const scene = new THREE.Scene();

    const stoneMesh = createStone(place.seed);
    scene.add(stoneMesh);

    // A subtle ground disc grounds the stone visually. Not carvable.
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(2.4, 48),
      new THREE.MeshStandardMaterial({
        color: 0x171b22,
        roughness: 1,
        metalness: 0,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -1.15;
    ground.name = 'ground';
    scene.add(ground);

    return { scene, stoneMesh };
  },
};
