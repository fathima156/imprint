import * as THREE from 'three';

/**
 * Qutub Minar, Delhi — the world's tallest brick minaret.
 *
 * SCALE: 1 unit = 1 metre. The real tower is ~72.5 m tall, tapering from a
 * ~14.7 m base diameter to ~2.9 m at the top, with five fluted storeys and
 * projecting balconies. This model captures that silhouette.
 *
 * Base at y = 0 so it can be dropped onto the ground.
 */

interface MinarPalette {
  red: THREE.MeshStandardMaterial;
  redDark: THREE.MeshStandardMaterial;
  marble: THREE.MeshStandardMaterial;
}

export function createQutubMinar(): THREE.Group {
  const materials = createMaterials();
  const minar = new THREE.Group();
  minar.name = 'qutub-minar';

  // --- Circular plinth ---
  const plinth = new THREE.Mesh(
    new THREE.CylinderGeometry(8, 8.4, 2.2, 32),
    materials.redDark,
  );
  plinth.position.y = 1.1;
  minar.add(plinth);

  // --- The five tapering storeys, with balconies between them ---
  const storeyHeights = [14, 13, 12, 11, 10]; // total 60 m
  const taper = 0.8;
  let radius = 7.4;
  let y = 2.2;

  for (let i = 0; i < storeyHeights.length; i++) {
    const height = storeyHeights[i];
    const topRadius = radius * taper;

    const storey = new THREE.Mesh(
      new THREE.CylinderGeometry(topRadius, radius, height, 32),
      i % 2 === 0 ? materials.red : materials.redDark,
    );
    storey.position.y = y + height / 2;
    minar.add(storey);

    y += height;
    radius = topRadius;

    // Balcony ring (skip the wrap against the dome).
    if (i < storeyHeights.length - 1) {
      const balcony = new THREE.Mesh(
        new THREE.CylinderGeometry(radius + 1.2, radius + 1.9, 0.9, 32),
        materials.marble,
      );
      balcony.position.y = y + 0.45;
      minar.add(balcony);
      y += 0.9;
    }
  }

  // --- Dome and finial crown ---
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(2.2, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    materials.redDark,
  );
  dome.position.y = y;
  minar.add(dome);

  const finial = new THREE.Mesh(
    new THREE.ConeGeometry(0.5, 6, 12),
    materials.marble,
  );
  finial.position.y = y + 6.5;
  minar.add(finial);

  return minar;
}

function createMaterials(): MinarPalette {
  return {
    red: new THREE.MeshStandardMaterial({ color: 0xc2704f, roughness: 0.9 }),
    redDark: new THREE.MeshStandardMaterial({ color: 0xa0553a, roughness: 0.95 }),
    marble: new THREE.MeshStandardMaterial({ color: 0xe6e0d0, roughness: 0.6 }),
  };
}