import * as THREE from 'three';
import type { Place } from '../data/places';
import { WORLD_ORIGIN } from '../data/places';
import { latLngToWorld } from '../lib/geo';
import { getLandmarkModel } from './models';
import { createNamePlaque } from './NamePlaque';
import { signedNames } from '../db/names';
import { createStone } from './stone';
import { InfiniteTerrain, type TerrainAnchor } from './terrain';

/**
 * Assembles the virtual world: an endless terrain plus one landmark per place.
 *
 * SCALE: the world is metre-accurate (1 unit = 1 metre). Each place is placed at
 * its true latitude/longitude relative to `WORLD_ORIGIN`, so the distances
 * between landmarks are their real-world distances. Because those can be
 * millions of metres, **everything lives under a single `contentRoot` group**;
 * the viewer offsets that group by the negative of the camera position each
 * frame (a floating origin) so geometry near the viewer always keeps
 * centimetre precision.
 *
 * Every place sits on an "anchor" mound raised from the terrain, so landmarks
 * are never floating. Some places (the Taj Mahal, Amber Fort, Hampi) use
 * hand-built architectural models; the rest use a procedural stone marker.
 */

/** Deterministic world seed — change to reshape the whole landscape. */
const WORLD_SEED = 20261010;

/** How tall (metres) a floating name label is, so it is readable from afar. */
const LABEL_HEIGHT_M = 14;

/** Terrain mound shaped under each landmark (radius and peak height, metres). */
interface AnchorShape {
  radius: number;
  height: number;
}

/** Per-place mounds, in metres. Hero monuments get their own hills. */
const ANCHOR_SHAPES: Record<string, AnchorShape> = {
  'taj-mahal': { radius: 240, height: 24 },
  'amber-fort': { radius: 340, height: 90 }, // the fort sits on a rocky hill
  hampi: { radius: 280, height: 46 },
  // Mountain places: big, gently rising highland so the modelled peaks sit on
  // real ground instead of floating above tiny mounds.
  kanchenjunga: { radius: 16000, height: 1500 },
  'rohtang-pass': { radius: 5000, height: 1200 },
  'konark-sun-temple': { radius: 300, height: 30 },
};

/** Mounds for mountain hikes that don't have a hand-built anchor shape. */
const HIKE_ANCHOR: AnchorShape = { radius: 900, height: 320 };
/** Default mound for everything else. */
const DEFAULT_ANCHOR: AnchorShape = { radius: 180, height: 26 };

export interface WorldLandmark {
  place: Place;
  /** Root object for this landmark (a model group or a stone). */
  root: THREE.Object3D;
  /** A good spot to place the camera when fast-travelling here. */
  viewPosition: THREE.Vector3;
  /** The point to look at when fast-travelling here. */
  viewTarget: THREE.Vector3;
}

export interface World {
  /** Group holding all world geometry; the viewer offsets it (floating origin). */
  contentRoot: THREE.Object3D;
  landmarks: WorldLandmark[];
  /** Terrain surface height (world Y, metres) at (x, z). */
  heightAt(x: number, z: number): number;
  /** Stream terrain chunks around the given viewer position (world metres). */
  update(viewerPosition: THREE.Vector3): void;
  /** Release terrain resources. */
  dispose(): void;
}

/** Build the world (terrain + landmarks) into `scene`. */
export function createWorld(scene: THREE.Scene, places: Place[]): World {
  // One group holds the whole world so the viewer can float the origin.
  const contentRoot = new THREE.Group();
  contentRoot.name = 'world-content';
  scene.add(contentRoot);

  const positions = new Map<string, { x: number; z: number }>();
  for (const place of places) {
    positions.set(
      place.id,
      latLngToWorld(place.latitude, place.longitude, WORLD_ORIGIN),
    );
  }

  // A raised mound under each landmark so it stands on its own hill.
  const anchors: TerrainAnchor[] = places.map((place) => {
    const position = positions.get(place.id) as { x: number; z: number };
    const shape = anchorShapeFor(place);
    return { x: position.x, z: position.z, ...shape };
  });

  const terrain = new InfiniteTerrain(contentRoot, WORLD_SEED, anchors);

  const landmarks: WorldLandmark[] = [];
  for (const place of places) {
    const position = positions.get(place.id) as { x: number; z: number };
    const groundY = terrain.heightAt(position.x, position.z);

    const root = buildLandmark(place);
    root.position.set(position.x, groundY, position.z);
    contentRoot.add(root);

    const { viewPosition, viewTarget } = frameLandmark(root, groundY);
    landmarks.push({ place, root, viewPosition, viewTarget });
  }

  return {
    contentRoot,
    landmarks,
    heightAt: (x, z) => terrain.heightAt(x, z),
    update: (viewerPosition) => terrain.update(viewerPosition),
    dispose: () => terrain.dispose(),
  };
}

/** Choose the mound shape for a place (by id, then by type). */
function anchorShapeFor(place: Place): AnchorShape {
  const named = ANCHOR_SHAPES[place.id];
  if (named) return named;
  if (place.type === 'hike') return HIKE_ANCHOR;
  return DEFAULT_ANCHOR;
}

/** Build a landmark root: a detailed model if we have one, else a stone. */
function buildLandmark(place: Place): THREE.Object3D {
  const root = new THREE.Group();
  root.name = `landmark:${place.id}`;

  const factory = getLandmarkModel(place.id);
  let content: THREE.Object3D;

  if (factory) {
    content = factory();
  } else {
    // A metre-scale stone marker (~12 m across), resting on the ground.
    const stone = createStone(place.seed);
    stone.scale.setScalar(12);
    const bounds = new THREE.Box3().setFromObject(stone);
    stone.position.y = -bounds.min.y;
    content = stone;
  }
  root.add(content);

  // Any name already written on this monument this session shows in the world
  // too, so marks are visible while you fly around — not only in the viewer.
  const written = signedNames.get(place.id);
  if (written && written.length > 0) {
    const plaque = createNamePlaque(written, content, 8);
    content.add(plaque.group);
  }

  // Float the label just above whatever content we placed.
  const bounds = new THREE.Box3().setFromObject(content);
  const label = createLabel(place.name);
  label.position.y = bounds.max.y + LABEL_HEIGHT_M * 0.8;
  root.add(label);

  return root;
}

/**
 * Work out where to park the camera when fast-travelling to a landmark: in
 * front of and above it, far enough back that the whole thing fits in view.
 */
function frameLandmark(
  root: THREE.Object3D,
  groundY: number,
): { viewPosition: THREE.Vector3; viewTarget: THREE.Vector3 } {
  const box = new THREE.Box3().setFromObject(root);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  const span = Math.max(size.x, size.y, size.z, 10);
  const target = new THREE.Vector3(center.x, groundY + size.y * 0.45, center.z);
  // Huge landmarks (the mountain models) must not push the camera out past the
  // fog, so the viewing distance is capped.
  const distance = Math.min(span * 2.2 + 40, 320);
  const offset = new THREE.Vector3(0, 0.5, 1).normalize().multiplyScalar(distance);

  return { viewPosition: target.clone().add(offset), viewTarget: target };
}

/**
 * A camera-facing label drawn to a 2D canvas and used as a sprite texture.
 * Sprites always face the camera, so names stay readable from any angle.
 */
function createLabel(text: string): THREE.Sprite {
  const fontSize = 44;
  const padding = 24;

  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('2D canvas context is not available');
  }

  const font = `600 ${fontSize}px system-ui, -apple-system, sans-serif`;
  context.font = font;
  const textWidth = context.measureText(text).width;

  canvas.width = Math.ceil(textWidth + padding * 2);
  canvas.height = fontSize + padding * 2;

  // Resizing the canvas resets the context, so re-apply the font.
  context.font = font;

  context.fillStyle = 'rgba(14, 17, 22, 0.72)';
  roundRect(context, 0, 0, canvas.width, canvas.height, 18);
  context.fill();

  context.fillStyle = '#eef2f8';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
  });

  const sprite = new THREE.Sprite(material);

  // Keep labels a similar on-screen size regardless of text length.
  const height = LABEL_HEIGHT_M;
  const aspect = canvas.width / canvas.height;
  sprite.scale.set(height * aspect, height, 1);
  sprite.name = `label:${text}`;

  return sprite;
}

/** Trace a rounded-rectangle path on a 2D context. */
function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}
