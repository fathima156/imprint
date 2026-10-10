import * as THREE from 'three';

/**
 * Reusable building blocks shared by the hand-modelled monuments.
 *
 * Keeping these in one place means the Taj Mahal, Amber Fort and Hampi all
 * speak the same architectural vocabulary (domes, arches, pavilions) without
 * duplicating geometry code.
 */

/**
 * A bulbous onion dome swept from a 2D profile with LatheGeometry.
 * Origin at the base; total height ~8.6 units. Scale per use as needed.
 */
export function createOnionDomeGeometry(): THREE.LatheGeometry {
  const profile: THREE.Vector2[] = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(4.8, 0.0),
    new THREE.Vector2(5.5, 1.0),
    new THREE.Vector2(5.3, 2.6),
    new THREE.Vector2(4.1, 4.5),
    new THREE.Vector2(2.4, 6.2),
    new THREE.Vector2(1.0, 7.4),
    new THREE.Vector2(0.4, 8.2),
    new THREE.Vector2(0.0, 8.6),
  ];
  return new THREE.LatheGeometry(profile, 48);
}

/**
 * An extruded pointed (ogee) arch, used for doorways and window openings.
 * Origin at the centre of its base; extrudes along +Z by `depth`.
 */
export function createArchGeometry(
  width: number,
  height: number,
  depth = 0.5,
): THREE.ExtrudeGeometry {
  const halfWidth = width / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth, 0);
  shape.lineTo(halfWidth, 0);
  shape.lineTo(halfWidth, height * 0.45);
  shape.quadraticCurveTo(halfWidth * 0.7, height * 0.92, 0, height);
  shape.quadraticCurveTo(-halfWidth * 0.7, height * 0.92, -halfWidth, height * 0.45);
  shape.closePath();

  return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
}

/**
 * A small domed pavilion (chhatri), ~4 units tall, with its base at y = 0.
 * `body` is the main marble/sandstone material, `trim` the darker accents.
 */
export function createChhatri(
  body: THREE.Material,
  trim: THREE.Material,
): THREE.Group {
  const chhatri = new THREE.Group();

  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(1.4, 1.4, 0.4, 16),
    trim,
  );
  base.position.y = 0.2;
  chhatri.add(base);

  const pillarGeometry = new THREE.CylinderGeometry(0.12, 0.12, 1.7, 8);
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const pillar = new THREE.Mesh(pillarGeometry, body);
    pillar.position.set(Math.cos(angle) * 1.15, 1.25, Math.sin(angle) * 1.15);
    chhatri.add(pillar);
  }

  const canopy = new THREE.Mesh(
    new THREE.CylinderGeometry(1.5, 1.5, 0.2, 16),
    trim,
  );
  canopy.position.y = 2.2;
  chhatri.add(canopy);

  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1.4, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    body,
  );
  dome.position.y = 2.3;
  dome.scale.y = 1.25;
  chhatri.add(dome);

  const finial = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.6, 8), body);
  finial.position.y = 4.0;
  chhatri.add(finial);

  return chhatri;
}
