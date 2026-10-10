import * as THREE from 'three';

/**
 * "Write your name on the monument" — the Layover Marks signature feature.
 *
 * Each name is rendered onto a high-resolution canvas texture and mapped onto a
 * small double-sided quad stuck to **each of the four wall sides** of the
 * monument's model (found by ray-casting), partway up the wall rather than down
 * on the foundation. Names stack vertically so every visitor's mark stays on the
 * wall, one above the next. The canvas is far larger than the world-space quad,
 * so the lettering stays crisp when you zoom right in; in world metres the name
 * is small — a carved name, not a billboard.
 *
 * Storage of written names lives in `../db/names` (Supabase or IndexedDB).
 */

/** Canvas / texture size. The quad is ~8x smaller, so 1px ~ 1mm on a 4 m name. */
const CANVAS_W = 2048;
const CANVAS_H = 256;

/**
 * Fraction of the monument's height where names are carved: above the
 * foundation (the bottom ~15%) and below the very top. Names spread across this
 * band so several of them stack up the wall.
 */
const WALL_BOTTOM = 0.3;
const WALL_TOP = 0.72;

/** Upper bound on rendered names per place, to bound texture memory. */
const MAX_NAMES = 24;

/** World-space width of each name band, metres. Kept modest — a carved name. */
function bandWidth(wallWidth: number): number {
  return THREE.MathUtils.clamp(wallWidth * 0.22, 1.2, 6);
}

/** Render an engraved-style name into a canvas. */
function drawName(canvas: HTMLCanvasElement, text: string): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // Sizes shrink so any name fits on one line.
  let px = 150;
  ctx.font = `italic 800 ${px}px Georgia, 'Times New Roman', serif`;
  while (ctx.measureText(text).width > CANVAS_W * 0.92 && px > 24) {
    px *= 0.9;
    ctx.font = `italic 800 ${px}px Georgia, 'Times New Roman', serif`;
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const x = CANVAS_W / 2;
  const y = CANVAS_H / 2;

  // Carved look: dark lettering with a light catch-edge on the top-left.
  ctx.fillStyle = 'rgba(18, 20, 26, 0.95)';
  ctx.fillText(text, x, y);
  ctx.strokeStyle = 'rgba(18, 20, 26, 0.9)';
  ctx.lineWidth = 2;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.fillText(text, x + 1.5, y - 1.5);
}

/** A wall to carve on: an outward direction and the lateral axis to spread over. */
interface WallSide {
  outward: THREE.Vector3;
  lateralAxis: 'x' | 'z';
}

/** +z, -z, +x, -x — the four wall faces. */
const WALL_SIDES: WallSide[] = [
  { outward: new THREE.Vector3(0, 0, 1), lateralAxis: 'x' },
  { outward: new THREE.Vector3(0, 0, -1), lateralAxis: 'x' },
  { outward: new THREE.Vector3(1, 0, 0), lateralAxis: 'z' },
  { outward: new THREE.Vector3(-1, 0, 0), lateralAxis: 'z' },
];

/** Height fraction (0..1) for the i-th of `count` stacked names. */
function heightFraction(index: number, count: number): number {
  if (count <= 1) return (WALL_BOTTOM + WALL_TOP) / 2;
  return WALL_BOTTOM + (WALL_TOP - WALL_BOTTOM) * ((index + 0.5) / count);
}

/**
 * Find a wall point on one side by ray-casting inward from outside it, at the
 * given height fraction. Returns world-space point + outward surface normal.
 */
function probeWall(
  content: THREE.Object3D,
  box: THREE.Box3,
  side: WallSide,
  yFraction: number,
): { point: THREE.Vector3; normal: THREE.Vector3 } {
  const min = box.min;
  const max = box.max;
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());

  const axis: 'x' | 'z' = side.outward.z !== 0 ? 'z' : 'x';
  const sign = side.outward[axis] > 0 ? 1 : -1;
  const outside = (sign > 0 ? max[axis] : min[axis]) + sign * 2;
  const lateralCenter = side.lateralAxis === 'x' ? center.x : center.z;
  const halfLateral = (side.lateralAxis === 'x' ? size.x : size.z) / 2;

  const height = Math.max(1, size.y);
  const targetY = min.y + height * yFraction;
  const scanLow = min.y + height * Math.max(WALL_BOTTOM, yFraction - 0.05);
  const scanHigh = min.y + height * Math.min(WALL_TOP, yFraction + 0.05);

  const dir = side.outward.clone().multiplyScalar(-1);
  const raycaster = new THREE.Raycaster();
  // Try the centre first, then wider lanes, so a gap straight ahead (e.g. the
  // Gateway of India's arch) doesn't defeat the probe.
  const lanes = [0, -0.3, 0.3, -0.55, 0.55];

  for (let step = 0; step <= 6; step++) {
    const y = scanLow + (scanHigh - scanLow) * (step / 6);
    for (const f of lanes) {
      const origin = new THREE.Vector3();
      origin[axis] = outside;
      origin.y = y;
      origin[side.lateralAxis] = lateralCenter + halfLateral * f;

      raycaster.set(origin, dir);
      const hits = raycaster.intersectObject(content, true);
      for (const hit of hits) {
        if (!hit.face) continue;
        const n = hit.face.normal
          .clone()
          .transformDirection(hit.object.matrixWorld);
        if (n.dot(side.outward) > 0.3) {
          return { point: hit.point.clone(), normal: n };
        }
      }
    }
  }

  // Fallback: the middle of that wall face at the requested height.
  const point = new THREE.Vector3(
    axis === 'x' ? (sign > 0 ? max.x : min.x) : lateralCenter,
    targetY,
    axis === 'z' ? (sign > 0 ? max.z : min.z) : lateralCenter,
  );
  return { point, normal: side.outward.clone() };
}

/**
 * Build a plaque group for a list of names: every name carved on all four walls,
 * stacked up the wall in order. The returned group's first child is the +z
 * plaque of the first name. `textures` are exposed for disposal.
 */
export function createNamePlaque(
  names: string[],
  content: THREE.Object3D,
  anisotropy = 16,
): { group: THREE.Group; textures: THREE.CanvasTexture[] } {
  const shown = names.slice(0, MAX_NAMES);

  content.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(content);
  const size = box.getSize(new THREE.Vector3());
  const invQuat = content.getWorldQuaternion(new THREE.Quaternion()).invert();

  const group = new THREE.Group();
  group.name = 'name-plaque';

  const textures: THREE.CanvasTexture[] = [];

  shown.forEach((text, index) => {
    const canvas = document.createElement('canvas');
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    drawName(canvas, text);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = anisotropy;
    textures.push(texture);

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      roughness: 0.9,
      depthWrite: false,
      // Nudge the name in front of the surface so it never z-fights or gets
      // swallowed by the monument wall it is written on.
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });

    const yFraction = heightFraction(index, shown.length);

    for (const side of WALL_SIDES) {
      const wallWidth = side.lateralAxis === 'x' ? size.x : size.z;
      const width = bandWidth(wallWidth);
      const plane = new THREE.PlaneGeometry(width, width * (CANVAS_H / CANVAS_W));
      const mesh = new THREE.Mesh(plane, material);
      mesh.name = 'carved-name';
      mesh.userData.bandWidth = width;

      const mount = probeWall(content, box, side, yFraction);
      const localPoint = content.worldToLocal(mount.point.clone());
      const localNormal = mount.normal.clone().applyQuaternion(invQuat).normalize();

      mesh.position.copy(localPoint).addScaledVector(localNormal, 0.08);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), localNormal);

      group.add(mesh);
    }
  });

  return { group, textures };
}
