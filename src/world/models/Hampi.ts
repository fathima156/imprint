import * as THREE from 'three';

/**
 * Hampi — the Vijayanagara ruins (Karnataka), recognisable by two icons:
 *   - the tall pyramidal **gopuram** (gateway tower) of Virupaksha Temple,
 *   - the granite **Stone Chariot** of the Vittala Temple complex.
 *
 * SCALE: 1 unit = 1 metre. The Virupaksha gopuram is ~50 m tall and the Stone
 * Chariot ~5 m, matching the real monuments.
 *
 * Scattered granite boulders complete the scene. Built from primitives; base at
 * y = 0 so it can be dropped onto the ground.
 */

interface GranitePalette {
  stone: THREE.MeshStandardMaterial;
  stoneDark: THREE.MeshStandardMaterial;
  trim: THREE.MeshStandardMaterial;
}

export function createHampi(): THREE.Group {
  const materials = createMaterials();
  const hampi = new THREE.Group();
  hampi.name = 'hampi';

  hampi.add(createGopuram(materials));

  const chariot = createStoneChariot(materials);
  chariot.position.set(26, 0, 14);
  chariot.rotation.y = -0.5;
  hampi.add(chariot);

  for (const boulder of createBoulders(materials.stone)) {
    hampi.add(boulder);
  }

  return hampi;
}

function createMaterials(): GranitePalette {
  return {
    stone: new THREE.MeshStandardMaterial({ color: 0x9a8f80, roughness: 0.98 }),
    stoneDark: new THREE.MeshStandardMaterial({ color: 0x776c60, roughness: 1.0 }),
    trim: new THREE.MeshStandardMaterial({ color: 0x2f2922, roughness: 0.95 }),
  };
}

/** The tiered ~50 m gateway tower (gopuram), base at y = 0. */
function createGopuram(materials: GranitePalette): THREE.Group {
  const gopuram = new THREE.Group();
  gopuram.name = 'gopuram';

  // Solid plinth at the foot of the tower.
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(22, 14, 22),
    materials.stoneDark,
  );
  base.position.y = 7;
  gopuram.add(base);

  // Stepped, tapering tiers.
  const tiers = 6;
  let width = 20;
  let depth = 20;
  let y = 14;
  const tierHeight = 5;
  for (let i = 0; i < tiers; i++) {
    const tier = new THREE.Mesh(
      new THREE.BoxGeometry(width, tierHeight, depth),
      materials.stone,
    );
    tier.position.y = y + tierHeight / 2;
    gopuram.add(tier);

    // A thin band between tiers for definition.
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.6, 0.5, depth + 0.6),
      materials.stoneDark,
    );
    band.position.y = y;
    gopuram.add(band);

    y += tierHeight;
    width *= 0.9;
    depth *= 0.9;
  }

  // Barrel-vault roof capping the tower (a half-cylinder lying along X).
  const roofRadius = depth / 2;
  const roof = new THREE.Mesh(
    new THREE.CylinderGeometry(roofRadius, roofRadius, width, 24, 1, false, 0, Math.PI),
    materials.stone,
  );
  roof.rotation.z = Math.PI / 2;
  roof.position.y = y;
  gopuram.add(roof);

  // Finials (kalasha) along the ridge.
  const finialGeometry = new THREE.SphereGeometry(0.6, 12, 10);
  for (let i = -2; i <= 2; i++) {
    const finial = new THREE.Mesh(finialGeometry, materials.stoneDark);
    finial.position.set((i * width) / 5, y + roofRadius, 0);
    gopuram.add(finial);
  }

  return gopuram;
}

/** The Stone Chariot: a miniature granite shrine on wheels. Base y = 0, ~5 m. */
function createStoneChariot(materials: GranitePalette): THREE.Group {
  const chariot = new THREE.Group();
  chariot.name = 'stone-chariot';

  const platform = new THREE.Mesh(
    new THREE.BoxGeometry(4, 0.6, 3),
    materials.stoneDark,
  );
  platform.position.y = 0.3;
  chariot.add(platform);

  // Four great stone wheels, one pair per side.
  const wheelGeometry = new THREE.CylinderGeometry(1.2, 1.2, 0.4, 24);
  for (const x of [-2, 2]) {
    for (const z of [-1.1, 1.1]) {
      const wheel = new THREE.Mesh(wheelGeometry, materials.stoneDark);
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 1.0, z);
      chariot.add(wheel);
    }
  }

  // Columned pavilion.
  const pillarGeometry = new THREE.BoxGeometry(0.35, 1.8, 0.35);
  for (const x of [-1.2, 1.2]) {
    for (const z of [-0.9, 0.9]) {
      const pillar = new THREE.Mesh(pillarGeometry, materials.stone);
      pillar.position.set(x, 1.5, z);
      chariot.add(pillar);
    }
  }

  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.4, 2.2),
    materials.stone,
  );
  roof.position.y = 2.5;
  chariot.add(roof);

  // Small tower over the shrine.
  const towerBase = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1.4, 1.6),
    materials.stone,
  );
  towerBase.position.y = 3.4;
  chariot.add(towerBase);

  const towerTop = new THREE.Mesh(
    new THREE.BoxGeometry(1.0, 1.2, 1.0),
    materials.stoneDark,
  );
  towerTop.position.y = 4.7;
  chariot.add(towerTop);

  const finial = new THREE.Mesh(
    new THREE.SphereGeometry(0.25, 10, 8),
    materials.stone,
  );
  finial.position.y = 5.4;
  chariot.add(finial);

  return chariot;
}

/** A scatter of granite boulders (2–5 m across), hand-placed for a ruin look. */
function createBoulders(material: THREE.Material): THREE.Mesh[] {
  const layout: Array<[number, number, number, number]> = [
    // x, z, radius, vertical squash
    [-20, -16, 3.0, 0.7],
    [18, -22, 3.6, 0.75],
    [-30, 8, 2.6, 0.65],
    [26, 20, 3.2, 0.8],
    [-14, 26, 2.4, 0.6],
    [32, -8, 3.8, 0.7],
    [6, -30, 2.8, 0.75],
  ];

  return layout.map(([x, z, radius, squash]) => {
    const boulder = new THREE.Mesh(
      new THREE.IcosahedronGeometry(radius, 1),
      material,
    );
    boulder.position.set(x, radius * squash * 0.6, z);
    boulder.scale.set(1, squash, 1);
    boulder.rotation.set(radius, radius * 2, radius * 0.5);
    return boulder;
  });
}
