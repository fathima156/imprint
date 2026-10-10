import * as THREE from 'three';
import { createArchGeometry, createChhatri, createOnionDomeGeometry } from './parts';

/**
 * A stylised but architecturally recognisable Taj Mahal, built from Three.js
 * primitives (boxes, cylinders, a lathed onion dome and extruded arches).
 *
 * SCALE: 1 unit = 1 metre. Dimensions follow the real monument:
 *   - overall height to the tip of the finial ~ 73 m,
 *   - marble plinth ~ 42 m square,
 *   - ~ 40 m minarets at the corners of the plinth.
 * (Proportions are approximated for a real-time model.)
 *
 * The model is built with its base at y = 0 so callers can drop it straight
 * onto the ground.
 */

/** Shared marble colours for one model instance. */
interface MarblePalette {
  marble: THREE.MeshStandardMaterial;
  marbleDark: THREE.MeshStandardMaterial;
  recess: THREE.MeshStandardMaterial;
}

/** Create the model. Returns a group whose origin is the centre of the base. */
export function createTajMahal(): THREE.Group {
  const materials = createMaterials();
  const taj = new THREE.Group();
  taj.name = 'taj-mahal';

  // --- Plinth (the raised marble platform everything stands on) ---
  const plinthSize = 42;
  const plinthHeight = 1.5;
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(plinthSize, plinthHeight, plinthSize),
    materials.marbleDark,
  );
  plinth.position.y = plinthHeight / 2;
  taj.add(plinth);

  // --- Main building ---
  const bodyWidth = 25;
  const bodyHeight = 33;
  const bodyBase = plinthHeight;
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(bodyWidth, bodyHeight, bodyWidth),
    materials.marble,
  );
  body.position.y = bodyBase + bodyHeight / 2;
  taj.add(body);

  const roofY = bodyBase + bodyHeight; // top of the main block (~34.5 m)

  // --- Great arches (iwans) on all four faces ---
  addFaceArches(taj, bodyWidth, bodyBase, materials);

  // --- Drum + central onion dome ---
  const drum = new THREE.Mesh(
    new THREE.CylinderGeometry(6.2, 6.6, 3, 40),
    materials.marble,
  );
  drum.position.y = roofY + 1.5;
  taj.add(drum);

  const domeBase = roofY + 3;
  const dome = new THREE.Mesh(createOnionDomeGeometry(), materials.marble);
  // Unit dome is ~8.6 tall with a 4.8 base radius: stretch to ~24 m tall and a
  // ~8 m base radius (≈ 18 m across, close to the real ~17.7 m).
  dome.scale.set(8 / 4.8, 24 / 8.6, 8 / 4.8);
  dome.position.y = domeBase;
  taj.add(dome);

  const finial = createFinial(materials);
  finial.position.y = domeBase + 24;
  taj.add(finial);

  // --- Four chhatris around the dome, on the roof corners ---
  const roofCorners: Array<[number, number]> = [
    [8.5, 8.5],
    [8.5, -8.5],
    [-8.5, 8.5],
    [-8.5, -8.5],
  ];
  for (const [x, z] of roofCorners) {
    const chhatri = createChhatri(materials.marble, materials.marbleDark);
    chhatri.scale.setScalar(1.5); // ~6 m tall pavilions
    chhatri.position.set(x, roofY, z);
    taj.add(chhatri);
  }

  // --- Four ~40 m minarets at the plinth corners ---
  const minaretOffset = 19;
  for (const [x, z] of roofCorners) {
    const minaret = createMinaret(materials);
    minaret.position.set(
      x > 0 ? minaretOffset : -minaretOffset,
      plinthHeight,
      z > 0 ? minaretOffset : -minaretOffset,
    );
    taj.add(minaret);
  }

  // --- Garden terrace in front of the building (no water) ---
  const terrace = new THREE.Mesh(
    new THREE.BoxGeometry(20, 0.4, 26),
    materials.marbleDark,
  );
  terrace.position.set(0, 0.2, 26);
  taj.add(terrace);

  return taj;
}

/** Fresh materials so each instance can be disposed independently. */
function createMaterials(): MarblePalette {
  return {
    marble: new THREE.MeshStandardMaterial({
      color: 0xf3f0e8,
      roughness: 0.55,
      metalness: 0.0,
    }),
    marbleDark: new THREE.MeshStandardMaterial({
      color: 0xd8d2c4,
      roughness: 0.65,
      metalness: 0.0,
    }),
    recess: new THREE.MeshStandardMaterial({
      color: 0x2b2620,
      roughness: 0.9,
      metalness: 0.0,
    }),
  };
}

/** A tapering ~40 m minaret with balconies and a small domed crown. Base y = 0. */
function createMinaret(materials: MarblePalette): THREE.Group {
  const minaret = new THREE.Group();
  const height = 40;

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(1.3, 1.7, height, 24),
    materials.marble,
  );
  shaft.position.y = height / 2;
  minaret.add(shaft);

  for (const balconyY of [12, 24, 36]) {
    const balcony = new THREE.Mesh(
      new THREE.CylinderGeometry(2.4, 2.4, 0.7, 24),
      materials.marbleDark,
    );
    balcony.position.y = balconyY;
    minaret.add(balcony);
  }

  const crown = createChhatri(materials.marble, materials.marbleDark);
  crown.scale.setScalar(1.6);
  crown.position.y = height;
  minaret.add(crown);

  return minaret;
}

/** The pointed ~11 m finial (with spheres and a crescent) on top of the dome. */
function createFinial(materials: MarblePalette): THREE.Group {
  const finial = new THREE.Group();

  const pole = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 5, 8),
    materials.marbleDark,
  );
  pole.position.y = 2.5;
  finial.add(pole);

  const balls: Array<[number, number]> = [
    [0.9, 0.85],
    [2.9, 0.65],
    [4.7, 0.5],
  ];
  for (const [y, radius] of balls) {
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(radius, 16, 12),
      materials.marble,
    );
    ball.position.y = y;
    finial.add(ball);
  }

  const crescent = new THREE.Mesh(
    new THREE.TorusGeometry(1.2, 0.16, 8, 24),
    materials.marble,
  );
  crescent.position.y = 5.6;
  finial.add(crescent);

  return finial;
}

/**
 * Add a large pointed-arch recess (iwan) to each of the building's four faces.
 * The arch is a dark extruded slab sitting just proud of the marble face.
 */
function addFaceArches(
  parent: THREE.Group,
  bodyWidth: number,
  bodyBase: number,
  materials: MarblePalette,
): void {
  const half = bodyWidth / 2;
  const archWidth = 12;
  const archHeight = 22;

  // Build the arch once on the +Z face, then rotate a pivot for each face.
  const faces: number[] = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  for (const angle of faces) {
    const pivot = new THREE.Group();
    pivot.rotation.y = angle;

    const arch = new THREE.Mesh(
      createArchGeometry(archWidth, archHeight, 0.6),
      materials.recess,
    );
    arch.position.set(0, bodyBase, half - 0.3);
    pivot.add(arch);

    parent.add(pivot);
  }
}
