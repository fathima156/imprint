import * as THREE from 'three';

/**
 * Kanchenjunga, Sikkim — the world's third highest mountain and the name that
 * gives the demo its working title. Modelled as a great snow massif: a ridge
 * line of summits over a broad rock base.
 *
 * SCALE: 1 unit = 1 metre. The massif here rises ~1,150 m above its base
 * (stylised mountain relief). Base at y = 0.
 */
interface KanchenjungaPalette {
  snow: THREE.MeshStandardMaterial;
  rock: THREE.MeshStandardMaterial;
}

export function createKanchenjunga(): THREE.Group {
  const materials = createMaterials();
  const massif = new THREE.Group();
  massif.name = 'kanchenjunga';

  // --- Broad rock base shared by all the summits ---
  const base = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, 2),
    materials.rock,
  );
  base.scale.set(1500, 420, 1100);
  base.position.y = 210;
  base.rotation.set(-0.08, 0.4, 0.05);
  massif.add(base);

  // --- The summit ridge line (peaks in descending height) ---
  const summits: Array<[number, number, number, number, number, number]> = [
    // x, z, halfW, height, halfD, rock band (below snow)
    [0, 0, 560, 1150, 500, 260],
    [640, -140, 420, 880, 380, 220],
    [-520, 90, 460, 720, 420, 190],
    [240, 210, 330, 520, 300, 140],
    [-900, 250, 300, 380, 280, 120],
  ];
  for (const [x, z, halfW, height, halfD, rockY] of summits) {
    massif.add(createPeak(x, z, halfW, height, halfD, rockY, materials));
  }

  return massif;
}

/** A single faceted peak: rock at the base fading up into pure snow. */
function createPeak(
  x: number,
  z: number,
  halfW: number,
  height: number,
  halfD: number,
  rockY: number,
  materials: KanchenjungaPalette,
): THREE.Group {
  const peak = new THREE.Group();

  const rock = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, 1),
    materials.rock,
  );
  rock.scale.set(halfW, rockY, halfD);
  rock.position.set(x, rockY * 0.5, z);
  rock.rotation.set(0.12, x * 0.001, -0.15);
  peak.add(rock);

  const snow = new THREE.Mesh(
    new THREE.IcosahedronGeometry(1, 1),
    materials.snow,
  );
  snow.scale.set(halfW * 0.92, height - rockY, halfD * 0.92);
  snow.position.set(x, rockY + (height - rockY) * 0.5, z);
  snow.rotation.set(-0.08, x * 0.001, 0.1);
  peak.add(snow);

  return peak;
}

function createMaterials(): KanchenjungaPalette {
  return {
    snow: new THREE.MeshStandardMaterial({ color: 0xf6f8fb, roughness: 0.85 }),
    rock: new THREE.MeshStandardMaterial({ color: 0x5f6366, roughness: 1 }),
  };
}