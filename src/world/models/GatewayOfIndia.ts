import * as THREE from 'three';
import { createArchGeometry, createChhatri } from './parts';

/**
 * Gateway of India, Mumbai — the basalt arch memorial on the waterfront.
 *
 * SCALE: 1 unit = 1 metre. The monument is ~26 m high: a great central arch
 * flanked by two smaller arched wings, a cornice and a domed crown.
 *
 * Base at y = 0 so it can be dropped onto the ground.
 */

interface GatewayPalette {
  stone: THREE.MeshStandardMaterial;
  stoneDark: THREE.MeshStandardMaterial;
  recess: THREE.MeshStandardMaterial;
}

export function createGatewayOfIndia(): THREE.Group {
  const materials = createMaterials();
  const gateway = new THREE.Group();
  gateway.name = 'gateway-of-india';

  // --- Plinth ---
  const plinth = new THREE.Mesh(
    new THREE.BoxGeometry(21, 3, 10),
    materials.stoneDark,
  );
  plinth.position.y = 1.5;
  gateway.add(plinth);

  const floorY = 3;

  // --- Central arch: two piers and a barrel-vaulted top ---
  const pierGeometry = new THREE.BoxGeometry(2.2, 18, 6);
  for (const x of [-3.4, 3.4]) {
    const pier = new THREE.Mesh(pierGeometry, materials.stone);
    pier.position.set(x, floorY + 9, 0);
    gateway.add(pier);
  }

  const archTop = new THREE.Mesh(
    new THREE.CylinderGeometry(3.4, 3.4, 2.2, 24, 1, false, 0, Math.PI),
    materials.stone,
  );
  archTop.rotation.z = Math.PI / 2;
  archTop.position.set(0, floorY + 18, 0);
  gateway.add(archTop);

  // A dark recessed arch face reads the central opening from the front.
  const recess = new THREE.Mesh(
    createArchGeometry(8, 15, 0.9),
    materials.recess,
  );
  recess.position.set(0, floorY, 0.5);
  gateway.add(recess);

  // --- Two smaller flanking wings with their own arches ---
  const wingGeometry = new THREE.BoxGeometry(5, 16, 6);
  const wingCentres: Array<[number, number]> = [
    [-8.5, 0],
    [8.5, 0],
  ];
  for (const [x] of wingCentres) {
    const wing = new THREE.Mesh(wingGeometry, materials.stone);
    wing.position.set(x, floorY + 8, 0);
    gateway.add(wing);

    const wingArch = new THREE.Mesh(
      createArchGeometry(3.6, 8, 0.7),
      materials.recess,
    );
    wingArch.position.set(x, floorY, 2.6);
    gateway.add(wingArch);
  }

  // --- Cornice band ---
  const cornice = new THREE.Mesh(
    new THREE.BoxGeometry(17, 1, 8.4),
    materials.stoneDark,
  );
  cornice.position.set(0, floorY + 20.5, 0);
  gateway.add(cornice);

  // --- Small domed chhatris on the parapet and a larger central dome ---
  for (const [x] of wingCentres) {
    const chhatri = createChhatri(materials.stone, materials.stoneDark);
    chhatri.scale.setScalar(1.2);
    chhatri.position.set(x, floorY + 21, 0);
    gateway.add(chhatri);
  }

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(2.6, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    materials.stoneDark,
  );
  dome.scale.y = 1.4;
  dome.position.set(0, floorY + 21.5, 0);
  gateway.add(dome);

  const finial = new THREE.Mesh(new THREE.ConeGeometry(0.4, 2, 10), materials.stoneDark);
  finial.position.set(0, floorY + 25, 0);
  gateway.add(finial);

  return gateway;
}

function createMaterials(): GatewayPalette {
  return {
    stone: new THREE.MeshStandardMaterial({ color: 0x91897e, roughness: 0.85 }),
    stoneDark: new THREE.MeshStandardMaterial({ color: 0x70685f, roughness: 0.9 }),
    recess: new THREE.MeshStandardMaterial({ color: 0x3a342e, roughness: 0.95 }),
  };
}