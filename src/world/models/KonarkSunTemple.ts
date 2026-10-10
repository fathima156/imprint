import * as THREE from 'three';

/**
 * Konark Sun Temple, Odisha — the Sun Temple of Surya, a chariot with carved
 * stone wheels, pulled by horses, crowned by a stepped tower.
 *
 * SCALE: 1 unit = 1 metre. The surviving main tower is ~39 m tall and the
 * temple is famous for its serried ranks of ~3 m stone wheels along the
 * platform sides. This model captures the chariot silhouette: a plinth,
 * twelve wheels per side, the stepped shikhara tower and the horses.
 *
 * Base at y = 0.
 */

interface KonarkPalette {
  stone: THREE.MeshStandardMaterial;
  stoneDark: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
}

export function createKonarkSunTemple(): THREE.Group {
  const materials = createMaterials();
  const temple = new THREE.Group();
  temple.name = 'konark-sun-temple';

  const plinthHeight = 6;
  const plinthWidth = 56;
  const plinthDepth = 28;

  // --- Plinth (the chariot platform) ---
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(plinthWidth, plinthHeight, plinthDepth),
    materials.stoneDark,
  );
  plinth.position.y = plinthHeight / 2;
  temple.add(plinth);

  // --- Twelve great wheels along each long side (24 in total) ---
  const wheel = new THREE.CylinderGeometry(1.7, 1.7, 0.6, 24);
  const wheelBaseY = plinthHeight + 1.5;
  const columns = 12;
  const spacing = plinthWidth / (columns + 1);
  for (let c = 1; c <= columns; c++) {
    const x = -plinthWidth / 2 + spacing * c;
    for (const zSide of [-(plinthDepth / 2) - 0.2, plinthDepth / 2 + 0.2]) {
      const mesh = new THREE.Mesh(wheel, materials.stone);
      mesh.rotation.z = Math.PI / 2;
      mesh.position.set(x, wheelBaseY, zSide);
      temple.add(mesh);
    }
  }

  // --- The stepped shikhara tower (~39 m) on the platform ---
  const towerBase = plinthHeight;
  const tiers = 5;
  const tierHeight = 6.6;
  let width = 20;
  let depth = 20;
  let y = towerBase;
  for (let i = 0; i < tiers; i++) {
    const tier = new THREE.Mesh(
      new THREE.BoxGeometry(width, tierHeight, depth),
      i === 0 ? materials.stoneDark : materials.stone,
    );
    tier.position.y = y + tierHeight / 2;
    temple.add(tier);
    y += tierHeight;
    width *= 0.88;
    depth *= 0.88;
  }

  // Crown boss (kalasha) on the top.
  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(1.6, 16, 12),
    materials.trim,
  );
  crown.position.y = y + 1.2;
  temple.add(crown);

  // --- Seven stylised horses pulling the chariot out the front ---
  for (let i = 0; i < 7; i++) {
    const horse = createHorse(materials);
    horse.position.set(-21 + i * 7, plinthHeight, plinthDepth / 2 + 6);
    horse.rotation.y = i % 2 === 0 ? -0.35 : 0.35;
    temple.add(horse);
  }

  return temple;
}

/** A simple stylised leaping horse, ~4 m long. Origin at its centre. */
function createHorse(materials: KonarkPalette): THREE.Group {
  const horse = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(3, 1.2, 1.1),
    materials.stone,
  );
  body.position.y = 2;
  horse.add(body);

  const neck = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 1.6, 0.9),
    materials.stone,
  );
  neck.position.set(1.3, 3.2, 0);
  neck.rotation.z = 0.6;
  horse.add(neck);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.9, 0.5, 0.9),
    materials.stone,
  );
  head.position.set(2.2, 3.2, 0);
  horse.add(head);

  for (const [x, y, z] of [
    [1.4, 1.2, 0.6],
    [-1.4, 1.2, 0.6],
    [1.4, 1.2, -0.6],
    [-1.4, 1.2, -0.6],
  ]) {
    const leg = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, 1.4, 0.35),
      materials.stoneDark,
    );
    leg.position.set(x, y, z);
    horse.add(leg);
  }

  return horse;
}

function createMaterials(): KonarkPalette {
  return {
    stone: new THREE.MeshStandardMaterial({ color: 0x8d7a5e, roughness: 0.95 }),
    stoneDark: new THREE.MeshStandardMaterial({ color: 0x6f5f47, roughness: 1.0 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x4a3d2c, roughness: 0.95 }),
  };
}