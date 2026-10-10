import * as THREE from 'three';
import { createArchGeometry, createChhatri } from './parts';

/**
 * Charminar, Hyderabad — the 16th-century mosque with a double gallery and four
 * soaring minarets over the four great archways of the base.
 *
 * SCALE: 1 unit = 1 metre. The whole monument is ~56 m tall; each minaret is
 * ~48.7 m. Base at y = 0.
 */

interface CharminarPalette {
  granite: THREE.MeshStandardMaterial;
  graniteDark: THREE.MeshStandardMaterial;
  lime: THREE.MeshStandardMaterial;
  recess: THREE.MeshStandardMaterial;
}

export function createCharminar(): THREE.Group {
  const materials = createMaterials();
  const charminar = new THREE.Group();
  charminar.name = 'charminar';

  // --- Corinthian-style base with four archways ---
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(18, 8, 18),
    materials.granite,
  );
  base.position.y = 4;
  charminar.add(base);

  const faces: number[] = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  for (const angle of faces) {
    const pivot = new THREE.Group();
    pivot.rotation.y = angle;
    const arch = new THREE.Mesh(
      createArchGeometry(8, 8, 0.8),
      materials.recess,
    );
    arch.position.set(0, 0, 8.6);
    pivot.add(arch);
    charminar.add(pivot);
  }

  // --- First gallery floor with balance balconies ---
  const gallery1 = new THREE.Mesh(
    new THREE.BoxGeometry(16, 6, 16),
    materials.granite,
  );
  gallery1.position.y = 11;
  charminar.add(gallery1);

  // --- Second gallery floor with arched windows ---
  const gallery2 = new THREE.Mesh(
    new THREE.BoxGeometry(14, 5, 14),
    materials.graniteDark,
  );
  gallery2.position.y = 16.5;
  charminar.add(gallery2);

  // A ring of small arches around the second gallery.
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const win = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 4, 0.5),
      materials.recess,
    );
    win.position.set(
      Math.cos(angle) * 7.3,
      16.5,
      Math.sin(angle) * 7.3,
    );
    win.rotation.y = -angle;
    charminar.add(win);
  }

  // --- Central dome and finial (top at ~56 m) ---
  const domeBase = 21.5;
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(5, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    materials.graniteDark,
  );
  dome.position.y = domeBase;
  charminar.add(dome);

  const finial = new THREE.Mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 6, 8),
    materials.lime,
  );
  finial.position.y = domeBase + 7;
  charminar.add(finial);
  const finialBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 12, 10),
    materials.lime,
  );
  finialBall.position.y = domeBase + 10.2;
  charminar.add(finialBall);

  // --- Four ~48.7 m minarets at the corners ---
  const minaretOffset = 8;
  for (const [sx, sz] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ]) {
    const minaret = createMinaret(materials);
    minaret.position.set(sx * minaretOffset, 0, sz * minaretOffset);
    charminar.add(minaret);
  }

  return charminar;
}

/** A slender 48.7 m minaret with two bracketed balconies and a small crown. */
function createMinaret(materials: CharminarPalette): THREE.Group {
  const minaret = new THREE.Group();
  const height = 48.7;

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 1.4, height, 18),
    materials.granite,
  );
  shaft.position.y = height / 2;
  minaret.add(shaft);

  for (const balconyY of [18, 34]) {
    const balcony = new THREE.Mesh(
      new THREE.CylinderGeometry(1.7, 1.9, 0.8, 18),
      materials.lime,
    );
    balcony.position.y = balconyY;
    minaret.add(balcony);
  }

  const crown = createChhatri(materials.graniteDark, materials.lime);
  crown.scale.setScalar(0.8);
  crown.position.y = height;
  minaret.add(crown);

  return minaret;
}

function createMaterials(): CharminarPalette {
  return {
    granite: new THREE.MeshStandardMaterial({ color: 0xb9a58a, roughness: 0.9 }),
    graniteDark: new THREE.MeshStandardMaterial({ color: 0x977f61, roughness: 0.92 }),
    lime: new THREE.MeshStandardMaterial({ color: 0xecead4, roughness: 0.7 }),
    recess: new THREE.MeshStandardMaterial({ color: 0x3a332a, roughness: 0.95 }),
  };
}