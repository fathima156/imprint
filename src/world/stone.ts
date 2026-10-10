import * as THREE from 'three';
import { createNoise3D, type NoiseFunction3D } from 'simplex-noise';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Procedural stone.
 *
 * A carvable rock is created by taking an icosphere and pushing each vertex
 * in/out using 3D simplex noise. The noise is seeded, so the same `seed`
 * always produces the exact same stone — needed so a place looks consistent
 * every time it is opened.
 *
 * Later prompts will attach carved names directly to the returned mesh
 * (see SceneFactory.create in SceneFactory.ts).
 */

/** Warm grey base colour; per-vertex shading is multiplied onto this. */
const BASE_COLOR = new THREE.Color(0x9c9389);
/** Icosphere subdivision level. 4 = smooth but still cheap. */
const DETAIL = 4;
/** How large the noise features are across the surface (higher = busier). */
const FREQUENCY = 1.4;
/** How far (in local units, radius 1) vertices are pushed in/out. */
const DISPLACEMENT = 0.22;

/**
 * Build a stone mesh for the given seed.
 *
 * The mesh geometry is centred at the origin with a nominal radius of 1.
 * Its material uses vertex colours for subtle variation.
 */
export function createStone(seed: number): THREE.Mesh {
  // Start from an icosphere, then merge duplicate vertices so that
  // computeVertexNormals() yields smooth (non-faceted) shading.
  const geometry = mergeVertices(new THREE.IcosahedronGeometry(1, DETAIL));

  const position = geometry.getAttribute('position') as THREE.BufferAttribute;
  const noise3D = createSeededNoise(seed);

  const colors = new Float32Array(position.count * 3);
  const vertex = new THREE.Vector3();
  const color = new THREE.Color();

  for (let i = 0; i < position.count; i++) {
    vertex.fromBufferAttribute(position, i);

    // Sample noise at the original surface direction.
    const n = noise3D(
      vertex.x * FREQUENCY,
      vertex.y * FREQUENCY,
      vertex.z * FREQUENCY,
    );

    // Push the vertex along its (unit) direction from the centre.
    const radius = 1 + n * DISPLACEMENT;
    vertex.normalize().multiplyScalar(radius);
    position.setXYZ(i, vertex.x, vertex.y, vertex.z);

    // Subtle colour variation so the surface is not a single flat colour.
    const shade = 0.82 + (n * 0.5 + 0.5) * 0.36; // roughly 0.82 .. 1.18
    color.copy(BASE_COLOR).multiplyScalar(shade);
    colors[i * 3 + 0] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }

  position.needsUpdate = true;
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();

  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.02,
    flatShading: false,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'stone';

  // The mesh (geometry + material) is owned by the scene; PlaceViewer
  // disposes everything it finds under the scene root.
  return mesh;
}

/**
 * Small deterministic PRNG (mulberry32). Used to feed the noise generator
 * so that a given seed is reproducible across page loads and devices.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return (): number => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Create a seeded 3D noise function. */
function createSeededNoise(seed: number): NoiseFunction3D {
  return createNoise3D(mulberry32(seed));
}
