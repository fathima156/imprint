import * as THREE from 'three';
import { createNoise3D, type NoiseFunction3D } from 'simplex-noise';

/**
 * An endless, all-land terrain.
 *
 * The ground is split into square chunks. Only the chunks near the camera are
 * kept in memory; as the camera moves chunks outside the view radius are
 * dropped and new ones generated. Because the height is sampled from a
 * continuous noise field using *world* coordinates, neighbouring chunks always
 * line up — so the world feels infinite.
 *
 * There is no water: every surface is green land that varies in shade with
 * height (light meadow low down, darker green, rocky ground on the peaks).
 * `heightAt()` exposes the surface height so landmarks and the camera can use it.
 */

/** World units along one edge of a chunk (also metres — 1 unit = 1 m). */
const CHUNK_SIZE = 64;
/** Subdivisions per chunk edge (CHUNK_SEGMENTS + 1 vertices per edge). */
const CHUNK_SEGMENTS = 24;
/** How many chunks to keep around the camera in each direction. */
const VIEW_RADIUS = 8;

/** Noise shape parameters (tuned by eye for a believable landscape). */
const CONTINENT_FREQ = 0.0032;
const DETAIL_FREQ = 0.02;
const CONTINENT_AMP = 15;
const DETAIL_AMP = 3;

/** A raised area — where landmarks live. */
export interface TerrainAnchor {
  x: number;
  z: number;
  /** Radius of the raised mound. */
  radius: number;
  /** Peak height of the mound. */
  height: number;
}

/** Colour stops used to tint the land by height. */
const COLOUR_LOW = new THREE.Color(0x8fbf6a); // light meadow
const COLOUR_GRASS = new THREE.Color(0x5f9e4a); // green land
const COLOUR_DARK = new THREE.Color(0x3f7a38); // darker green
const COLOUR_ROCK = new THREE.Color(0x8a8f7a); // rocky high ground

export class InfiniteTerrain {
  private readonly parent: THREE.Object3D;
  private readonly material: THREE.MeshStandardMaterial;
  private readonly noise: NoiseFunction3D;
  private readonly anchors: TerrainAnchor[];
  private readonly chunks = new Map<string, THREE.Mesh>();

  private lastCenterX = Number.NaN;
  private lastCenterZ = Number.NaN;

  constructor(parent: THREE.Object3D, seed: number, anchors: TerrainAnchor[]) {
    this.parent = parent;
    this.anchors = anchors;
    this.noise = createNoise3D(mulberry32(seed));

    this.material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.95,
      metalness: 0,
      flatShading: false,
    });
    // Chunks are created lazily by the first update() call (the caller supplies
    // the starting position), so no work is done at a position we never visit.
  }

  /** Surface height (world Y) at world coordinates (x, z). */
  heightAt(x: number, z: number): number {
    const continent = this.noise(x * CONTINENT_FREQ, 0, z * CONTINENT_FREQ);
    const detail = this.noise(x * DETAIL_FREQ, 100, z * DETAIL_FREQ);
    let height = continent * CONTINENT_AMP + detail * DETAIL_AMP;

    // Blend in each anchor mound so landmarks stand on raised ground.
    for (const anchor of this.anchors) {
      const distance = Math.hypot(x - anchor.x, z - anchor.z);
      const t = Math.max(0, 1 - distance / anchor.radius);
      const blend = t * t * (3 - 2 * t); // smoothstep
      height = height * (1 - blend) + anchor.height * blend;
    }

    return height;
  }

  /** Add/remove chunks so the visible area follows the camera. */
  update(cameraPosition: THREE.Vector3): void {
    const centerX = Math.round(cameraPosition.x / CHUNK_SIZE);
    const centerZ = Math.round(cameraPosition.z / CHUNK_SIZE);

    if (centerX === this.lastCenterX && centerZ === this.lastCenterZ) {
      return;
    }
    this.lastCenterX = centerX;
    this.lastCenterZ = centerZ;

    const needed = new Set<string>();
    for (let dx = -VIEW_RADIUS; dx <= VIEW_RADIUS; dx++) {
      for (let dz = -VIEW_RADIUS; dz <= VIEW_RADIUS; dz++) {
        const cx = centerX + dx;
        const cz = centerZ + dz;
        const key = chunkKey(cx, cz);
        needed.add(key);
        if (!this.chunks.has(key)) {
          const chunk = this.buildChunk(cx, cz);
          this.chunks.set(key, chunk);
          this.parent.add(chunk);
        }
      }
    }

    // Drop chunks that drifted out of view.
    for (const [key, chunk] of this.chunks) {
      if (needed.has(key)) continue;
      this.parent.remove(chunk);
      chunk.geometry.dispose();
      this.chunks.delete(key);
    }
  }

  /** Remove every chunk (geometries are disposed). */
  dispose(): void {
    for (const chunk of this.chunks.values()) {
      this.parent.remove(chunk);
      chunk.geometry.dispose();
    }
    this.chunks.clear();
    this.material.dispose();
  }

  /** Build one terrain chunk mesh with heights and vertex colours. */
  private buildChunk(cx: number, cz: number): THREE.Mesh {
    const geometry = new THREE.PlaneGeometry(
      CHUNK_SIZE,
      CHUNK_SIZE,
      CHUNK_SEGMENTS,
      CHUNK_SEGMENTS,
    );
    geometry.rotateX(-Math.PI / 2);

    const position = geometry.getAttribute('position') as THREE.BufferAttribute;
    const colors = new Float32Array(position.count * 3);
    const color = new THREE.Color();
    const originX = cx * CHUNK_SIZE;
    const originZ = cz * CHUNK_SIZE;

    for (let i = 0; i < position.count; i++) {
      const worldX = originX + position.getX(i);
      const worldZ = originZ + position.getZ(i);
      const height = this.heightAt(worldX, worldZ);

      position.setY(i, height);

      this.colourForHeight(height, color);
      colors[i * 3 + 0] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }

    position.needsUpdate = true;
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.position.set(originX, 0, originZ);
    mesh.name = `chunk:${cx}:${cz}`;
    return mesh;
  }

  /** Pick a land colour from the surface height (no water anywhere). */
  private colourForHeight(height: number, out: THREE.Color): void {
    if (height < 2) {
      out.copy(COLOUR_LOW);
    } else if (height < 10) {
      out.copy(COLOUR_GRASS);
    } else if (height < 20) {
      out.copy(COLOUR_DARK);
    } else {
      out.copy(COLOUR_ROCK);
    }
  }
}

/** Stable cache key for a chunk coordinate. */
function chunkKey(cx: number, cz: number): string {
  return `${cx}:${cz}`;
}

/** Small deterministic PRNG (mulberry32) so terrain is reproducible. */
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
