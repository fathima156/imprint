import * as THREE from 'three';

/**
 * Rohtang Pass, Himachal Pradesh — a high Himalayan pass: two snow-capped
 * ridges flanking a saddle, with the famous mountain road climbing over it.
 *
 * SCALE: 1 unit = 1 metre. Ridges here rise ~140 m above the pass floor
 * (mountain scale, stylised). Base at y = 0.
 */
interface RohtangPalette {
  rock: THREE.MeshStandardMaterial;
  snow: THREE.MeshStandardMaterial;
  road: THREE.MeshStandardMaterial;
}

export function createRohtangPass(): THREE.Group {
  const materials = createMaterials();
  const pass = new THREE.Group();
  pass.name = 'rohtang-pass';

  // --- A broad snow-streaked saddle floor between the ridges ---
  const floor = new THREE.Mesh(
    new THREE.CylinderGeometry(90, 95, 8, 40),
    materials.snow,
  );
  floor.position.y = 2.5;
  pass.add(floor);

  // --- Two flanking rock ridges with snow caps ---
  pass.add(createRidge(-150, 22, 80, 75, 60, materials));
  pass.add(createRidge(160, -34, 95, 90, 65, materials));

  // --- The mountain road climbing over the pass ---
  pass.add(createRoad(materials.road));

  return pass;
}

/** A single rocky ridge, roughly ellipsoidal, with a patch of snow on top. */
function createRidge(
  x: number,
  z: number,
  halfW: number,
  height: number,
  halfD: number,
  materials: RohtangPalette,
): THREE.Group {
  const ridge = new THREE.Group();

  const rock = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, 1),
    materials.rock,
  );
  rock.scale.set(halfW, height, halfD);
  rock.position.set(x, height * 0.5, z);
  rock.rotation.set(0.15, x * 0.004, 0.2);
  ridge.add(rock);

  const snow = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, 1),
    materials.snow,
  );
  snow.scale.set(halfW * 0.85, height * 0.4, halfD * 0.85);
  snow.position.set(x, height * 1.15, z);
  snow.rotation.set(-0.15, x * 0.002, -0.1);
  ridge.add(snow);

  return ridge;
}

/**
 * The famous Manali–Leh road: a grey ribbon rising off the pass floor and
 * switchbacking up one ridge.
 */
function createRoad(roadMaterial: THREE.Material): THREE.Group {
  const road = new THREE.Group();
  road.name = 'road';

  const segment = (a: THREE.Vector3, b: THREE.Vector3, width = 6): THREE.Mesh => {
    const direction = new THREE.Vector3().subVectors(b, a);
    const length = direction.length();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.4, length),
      roadMaterial,
    );
    const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
    mesh.position.copy(mid);
    mesh.lookAt(b);
    mesh.rotateX(Math.PI / 2);
    return mesh;
  };

  // Straight across the pass floor ...
  road.add(segment(new THREE.Vector3(-95, 3, 20), new THREE.Vector3(95, 4, -10)));

  // ... then switchbacks up the eastern ridge.
  road.add(segment(new THREE.Vector3(95, 4, -10), new THREE.Vector3(128, 24, -34)));
  road.add(segment(new THREE.Vector3(128, 24, -34), new THREE.Vector3(108, 52, -52)));
  road.add(segment(new THREE.Vector3(108, 52, -52), new THREE.Vector3(150, 84, -60)));

  return road;
}

function createMaterials(): RohtangPalette {
  return {
    rock: new THREE.MeshStandardMaterial({ color: 0x6b7070, roughness: 1 }),
    snow: new THREE.MeshStandardMaterial({ color: 0xf4f8fb, roughness: 0.9 }),
    road: new THREE.MeshStandardMaterial({ color: 0x4a4d50, roughness: 1 }),
  };
}