import * as THREE from 'three';
import { createArchGeometry, createChhatri } from './parts';

/**
 * Amber Fort (Amer Fort), Jaipur — a Rajput hill fort. The model captures its
 * signature elements:
 *   - a walled complex on a ~100 x 60 m stone platform (the hill comes from the
 *     terrain — see WorldScene's anchor mound),
 *   - crenellated rampart walls with round bastion towers,
 *   - the multi-storey palace with rows of arched openings,
 *   - a roof line of domed pavilions (chhatris).
 *
 * SCALE: 1 unit = 1 metre. The fort is enormous in reality (kilometres of
 * walls); this is a faithful-scale model of the central palace complex.
 * Base at y = 0.
 */

interface SandstonePalette {
  sandstone: THREE.MeshStandardMaterial;
  sandstoneDark: THREE.MeshStandardMaterial;
  marble: THREE.MeshStandardMaterial;
  recess: THREE.MeshStandardMaterial;
  garden: THREE.MeshStandardMaterial;
}

export function createAmberFort(): THREE.Group {
  const materials = createMaterials();
  const fort = new THREE.Group();
  fort.name = 'amber-fort';

  const platformHeight = 3;
  const halfWidth = 50;
  const halfDepth = 30;

  // --- Stone platform the whole complex stands on ---
  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(halfWidth * 2, platformHeight, halfDepth * 2),
    materials.sandstoneDark,
  );
  platform.position.y = platformHeight / 2;
  fort.add(platform);

  const floorY = platformHeight;

  // --- Rampart walls with merlons, and round bastions at the corners ---
  addRamparts(fort, halfWidth, halfDepth, floorY, materials);
  for (const x of [-halfWidth + 3, halfWidth - 3]) {
    for (const z of [-halfDepth + 3, halfDepth - 3]) {
      const bastion = createBastion(materials);
      bastion.position.set(x, floorY, z);
      fort.add(bastion);
    }
  }

  // --- Main palace block toward the back of the courtyard ---
  const palaceWidth = 40;
  const palaceDepth = 24;
  const palaceHeight = 25;
  const palaceZ = -6;
  const palace = new THREE.Mesh(
    new THREE.BoxGeometry(palaceWidth, palaceHeight, palaceDepth),
    materials.sandstone,
  );
  palace.position.set(0, floorY + palaceHeight / 2, palaceZ);
  fort.add(palace);

  const palaceTop = floorY + palaceHeight;

  // Rows of arched windows on the front face (the Sheesh Mahal frontage).
  addWindowRows(fort, palaceWidth, palaceZ + palaceDepth / 2, floorY, materials);

  // A white-marble band under the roof line.
  const cornice = new THREE.Mesh(
    new THREE.BoxGeometry(palaceWidth + 1.2, 1.4, palaceDepth + 1.2),
    materials.marble,
  );
  cornice.position.set(0, palaceTop - 0.7, palaceZ);
  fort.add(cornice);

  // --- Domed chhatris along the palace roof ---
  const chhatriSpots: Array<[number, number]> = [
    [-12, palaceZ - 7],
    [12, palaceZ - 7],
    [-12, palaceZ + 7],
    [12, palaceZ + 7],
  ];
  for (const [x, z] of chhatriSpots) {
    const chhatri = createChhatri(materials.marble, materials.sandstoneDark);
    chhatri.scale.setScalar(2.0); // ~8 m pavilions
    chhatri.position.set(x, palaceTop, z);
    fort.add(chhatri);
  }

  // --- Courtyard garden in front of the palace (no water) ---
  const garden = new THREE.Mesh(
    new THREE.BoxGeometry(halfWidth * 2 - 8, 0.4, halfDepth - 4),
    materials.garden,
  );
  garden.position.set(0, floorY + 0.2, 10);
  fort.add(garden);

  // A paved sandstone walkway leading up to the palace.
  const walkway = new THREE.Mesh(
    new THREE.BoxGeometry(20, 0.5, 10),
    materials.sandstone,
  );
  walkway.position.set(0, floorY + 0.3, 14);
  fort.add(walkway);

  return fort;
}

function createMaterials(): SandstonePalette {
  return {
    sandstone: new THREE.MeshStandardMaterial({ color: 0xe6d3a3, roughness: 0.85 }),
    sandstoneDark: new THREE.MeshStandardMaterial({ color: 0xcdb27a, roughness: 0.9 }),
    marble: new THREE.MeshStandardMaterial({ color: 0xf3efe4, roughness: 0.6 }),
    recess: new THREE.MeshStandardMaterial({ color: 0x3a3128, roughness: 0.95 }),
    garden: new THREE.MeshStandardMaterial({ color: 0x6f9a4e, roughness: 0.95 }),
  };
}

/** Four walls around the platform, each topped with a row of merlons. */
function addRamparts(
  parent: THREE.Group,
  halfWidth: number,
  halfDepth: number,
  floorY: number,
  materials: SandstonePalette,
): void {
  const wallHeight = 8;
  const wallY = floorY + wallHeight / 2;
  const thickness = 2.5;

  const walls: Array<[number, number, number, number]> = [
    // width, depth, x, z
    [halfWidth * 2, thickness, 0, -halfDepth],
    [halfWidth * 2, thickness, 0, halfDepth],
    [thickness, halfDepth * 2, -halfWidth, 0],
    [thickness, halfDepth * 2, halfWidth, 0],
  ];

  for (const [width, depth, x, z] of walls) {
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(width, wallHeight, depth),
      materials.sandstoneDark,
    );
    wall.position.set(x, wallY, z);
    parent.add(wall);

    // Merlons (battlements) spaced along the wall top.
    const along = width > depth ? width : depth;
    const count = Math.max(2, Math.floor(along / 5));
    const step = along / count;
    const topY = floorY + wallHeight + 1;
    for (let i = 0; i < count; i++) {
      const offset = -along / 2 + step * (i + 0.5);
      const merlon = new THREE.Mesh(
        new THREE.BoxGeometry(
          width > depth ? step * 0.5 : thickness,
          2,
          width > depth ? thickness : step * 0.5,
        ),
        materials.sandstone,
      );
      merlon.position.set(
        width > depth ? x + offset : x,
        topY,
        width > depth ? z : z + offset,
      );
      parent.add(merlon);
    }
  }
}

/** A round bastion tower with a domed crown. Base at y = 0. */
function createBastion(materials: SandstonePalette): THREE.Group {
  const bastion = new THREE.Group();
  const height = 16;

  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(6, 7, height, 24),
    materials.sandstoneDark,
  );
  tower.position.y = height / 2;
  bastion.add(tower);

  const crown = createChhatri(materials.sandstone, materials.sandstoneDark);
  crown.scale.setScalar(2.4);
  crown.position.y = height;
  bastion.add(crown);

  return bastion;
}

/** Two rows of dark pointed-arch windows on the palace's front face. */
function addWindowRows(
  parent: THREE.Group,
  palaceWidth: number,
  faceZ: number,
  floorY: number,
  materials: SandstonePalette,
): void {
  const columns = 4;
  const spacing = palaceWidth / (columns + 1);
  const archGeometry = createArchGeometry(2.6, 5, 0.6);

  for (const row of [0, 1]) {
    const y = floorY + 6 + row * 9;
    for (let c = 1; c <= columns; c++) {
      const arch = new THREE.Mesh(archGeometry, materials.recess);
      arch.position.set(-palaceWidth / 2 + spacing * c, y, faceZ + 0.1);
      parent.add(arch);
    }
  }
}
