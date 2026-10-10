import * as THREE from 'three';

/**
 * TinkerSpace Calicut — the community makerspace at the Institute of Palliative
 * Medicine (IPM), near Medical College, Kozhikode (Keralam).
 *
 * SCALE: 1 unit = 1 metre. A modest single-storey workshop block ~7 m tall, with
 * flat walls on all four sides so visitors' names can be carved on every face.
 *
 * Base at y = 0 so it can be dropped onto the ground. Its `name` matches the
 * place id, which the carving code uses to ray-cast the walls.
 */

interface TinkerPalette {
  concrete: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  accent: THREE.MeshStandardMaterial;
  glass: THREE.MeshStandardMaterial;
}

const WIDTH = 14;
const DEPTH = 10;
const HEIGHT = 7;
const WALL_THICKNESS = 0.5;

export function createTinkerSpaceCalicut(): THREE.Group {
  const materials = createMaterials();
  const building = new THREE.Group();
  building.name = 'tinkerspace-calicut';

  // --- Ground slab ---
  const slab = new THREE.Mesh(
    new THREE.BoxGeometry(WIDTH + 2, 0.5, DEPTH + 2),
    materials.dark,
  );
  slab.position.y = 0.25;
  building.add(slab);

  // --- Main hall (its four faces are the carving walls) ---
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(WIDTH, HEIGHT, DEPTH),
    materials.concrete,
  );
  body.position.y = 0.5 + HEIGHT / 2;
  building.add(body);

  // --- Facade band that carries the TinkerSpace sign ---
  const band = new THREE.Mesh(
    new THREE.BoxGeometry(WIDTH + 0.1, 1.1, 0.3),
    materials.accent,
  );
  band.position.set(0, 0.5 + HEIGHT - 0.55, DEPTH / 2 + 0.05);
  building.add(band);

  // --- Glazed entrance on the front (+z) face ---
  const door = new THREE.Mesh(
    new THREE.BoxGeometry(5, 3.4, 0.3),
    materials.glass,
  );
  door.position.set(-3.5, 0.5 + 1.7, DEPTH / 2 + 0.05);
  building.add(door);

  // --- Ribbon windows along the front, behind the sign band ---
  const windowGeometry = new THREE.BoxGeometry(3, 2.2, 0.3);
  for (let i = 0; i < 3; i++) {
    const window = new THREE.Mesh(windowGeometry, materials.glass);
    window.position.set(1.5 + i * 4, 0.5 + 4, DEPTH / 2 + 0.05);
    building.add(window);
  }

  // --- Side windows (+x and -x faces) ---
  const sideWindowGeometry = new THREE.BoxGeometry(0.3, 2.2, 3);
  for (const z of [-2.5, 2.5]) {
    for (const x of [-WIDTH / 2 - 0.05, WIDTH / 2 + 0.05]) {
      const window = new THREE.Mesh(sideWindowGeometry, materials.glass);
      window.position.set(x, 0.5 + 4, z);
      building.add(window);
    }
  }

  // --- Flat roof with a parapet rim ---
  const roof = new THREE.Mesh(
    new THREE.BoxGeometry(WIDTH, 0.4, DEPTH),
    materials.dark,
  );
  roof.position.y = 0.5 + HEIGHT + 0.2;
  building.add(roof);

  const parapetHeight = 0.8;
  const parapetY = 0.5 + HEIGHT + 0.4 + parapetHeight / 2;
  const parapetLong = new THREE.BoxGeometry(WIDTH, parapetHeight, WALL_THICKNESS);
  for (const z of [-DEPTH / 2, DEPTH / 2]) {
    const wall = new THREE.Mesh(parapetLong, materials.concrete);
    wall.position.set(0, parapetY, z);
    building.add(wall);
  }
  const parapetShort = new THREE.BoxGeometry(WALL_THICKNESS, parapetHeight, DEPTH);
  for (const x of [-WIDTH / 2, WIDTH / 2]) {
    const wall = new THREE.Mesh(parapetShort, materials.concrete);
    wall.position.set(x, parapetY, 0);
    building.add(wall);
  }

  // --- Roof clutter: a utility unit and a mast ---
  const utility = new THREE.Mesh(
    new THREE.BoxGeometry(2.5, 1.2, 2),
    materials.dark,
  );
  utility.position.set(3.5, 0.5 + HEIGHT + 1, -2);
  building.add(utility);

  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.08, 0.08, 4, 8),
    materials.dark,
  );
  mast.position.set(-4, 0.5 + HEIGHT + 2.4, 2.5);
  building.add(mast);

  return building;
}

function createMaterials(): TinkerPalette {
  return {
    concrete: new THREE.MeshStandardMaterial({ color: 0xd6d2c8, roughness: 0.9 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x4a4f55, roughness: 0.85 }),
    accent: new THREE.MeshStandardMaterial({ color: 0x1f9d8f, roughness: 0.6 }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x2b3d4a,
      roughness: 0.25,
      metalness: 0.4,
    }),
  };
}
