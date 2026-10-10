import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { Place } from '../data/places';
import { persistName, signedNames } from '../db/names';
import { createNamePlaque } from './NamePlaque';
import { getLandmarkModel } from './models';
import { SceneFactory } from './SceneFactory';
import { SceneView, disposeObjectTree } from './SceneView';

/** Sky / background colour, shared with the world view. */
const SKY_COLOR = 0x9ec9f0;

/**
 * The single-place view, opened by tapping a landmark in the world.
 *
 * If the place has a detailed architectural model (registered in
 * `models/index.ts`) it is shown; otherwise the procedural stone from
 * SceneFactory is used. Either way `content` is the object carvings will be
 * attached to in a later prompt.
 *
 * Movement here uses OrbitControls (orbit/zoom around the monument), unlike the
 * free-fly world view.
 */
export class PlaceViewer extends SceneView {
  /** The place this viewer renders. Public so callers can read it back. */
  readonly place: Place;

  /** Root object for the place's content (model group or stone mesh). */
  readonly content: THREE.Object3D;

  private orbit: OrbitControls | null = null;

  /** The carved names currently displayed on this monument. */
  private plaque: {
    group: THREE.Group;
    textures: THREE.CanvasTexture[];
  } | null = null;

  /** Set when the camera should glide in to the carved name. */
  private focusTo: { camera: THREE.Vector3; target: THREE.Vector3 } | null =
    null;

  constructor(container: HTMLElement, place: Place) {
    super(container, {
      background: SKY_COLOR,
      cameraPosition: [0, 6, 34],
      lighting: 'day',
    });

    this.place = place;
    this.content = this.buildContent(place);
    this.scene.add(this.content);

    // Show any names already written on this monument.
    const saved = signedNames.get(place.id);
    if (saved && saved.length > 0) {
      this.redrawPlaque(saved);
    }
  }

  /**
   * Write a name on the monument. Names are appended, never replaced, and the
   * in-memory list plus the database are updated immediately.
   */
  writeName(name: string): void {
    const trimmed = name.trim();
    if (!trimmed) return;
    // Update the in-memory cache and persist to the database (Supabase/local).
    persistName(this.place.id, trimmed);
    this.redrawPlaque(signedNames.get(this.place.id) ?? []);
    // After saving, glide the camera in so the new name is right in front of you.
    this.focusOnPlaque();
  }

  /** Rebuild the carved-name quads for the given list of names. */
  private redrawPlaque(names: string[]): void {
    if (this.plaque) {
      this.content.remove(this.plaque.group);
      disposeObjectTree(this.plaque.group);
      for (const texture of this.plaque.textures) texture.dispose();
      this.plaque = null;
    }

    if (names.length > 0 && this.content.children.length > 0) {
      this.plaque = createNamePlaque(
        names,
        this.content,
        this.renderer.capabilities.getMaxAnisotropy(),
      );
      this.content.add(this.plaque.group);
    }
  }

  /**
   * Aim the camera straight at the most recently written name, close enough to
   * read it. Called after saving (and when reopening a place that already has
   * names). The move is smoothed frame-by-frame in `updateControls`.
   */
  private focusOnPlaque(): void {
    if (!this.plaque || !this.orbit) return;

    const children = this.plaque.group.children;
    // Each name uses four wall quads, so the last name's +z plaque is 4 from the
    // end; that's the freshest one to show.
    const mesh = (children[Math.max(0, children.length - 4)] ?? children[0]) as
      | THREE.Mesh
      | undefined;
    if (!mesh) return;
    const world = mesh.getWorldPosition(new THREE.Vector3());
    const normal = new THREE.Vector3(0, 0, 1)
      .applyQuaternion(mesh.getWorldQuaternion(new THREE.Quaternion()))
      .normalize();
    const width = (mesh.userData.bandWidth as number | undefined) ?? 2;
    const distance = THREE.MathUtils.clamp(width * 1.7, 1.2, 12);

    const camera = world
      .clone()
      .addScaledVector(normal, distance)
      .add(new THREE.Vector3(0, distance * 0.12, 0));

    this.focusTo = { camera, target: world };
  }

  /** Stop rendering; also frees the carved-name textures, if any. */
  override dispose(): void {
    if (this.plaque) {
      for (const texture of this.plaque.textures) texture.dispose();
    }
    super.dispose();
  }

  /** Build the content for a place: detailed model if available, else stone. */
  private buildContent(place: Place): THREE.Object3D {
    const factory = getLandmarkModel(place.id);
    if (factory) {
      return factory();
    }

    // The procedural stone (with its ground disc) lives in a temporary scene;
    // move its children into a group we own.
    const bundle = SceneFactory.create(place);
    const group = new THREE.Group();
    group.name = `stone:${place.id}`;
    for (const child of [...bundle.scene.children]) {
      group.add(child);
    }
    return group;
  }

  /** Create orbit controls, then frame the camera on the monument. */
  protected override setupControls(): void {
    this.orbit = new OrbitControls(this.camera, this.canvas);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.08;
    this.orbit.enablePan = false;
    // Brisk zoom so a quick scroll/pinch dives right in to inspect carvings.
    this.orbit.zoomSpeed = 4;
    this.orbit.minPolarAngle = 0.15;
    this.orbit.maxPolarAngle = Math.PI - 0.35;
    this.frameCameraToContent();

    // If this monument already has a name (returning to a place), show it.
    if (this.plaque) {
      this.focusOnPlaque();
    }
  }

  protected override updateControls(deltaSeconds: number): void {
    const orbit = this.orbit;
    if (!orbit) return;

    // Smoothly glide towards the carved name when a focus is pending.
    if (this.focusTo) {
      const k = 1 - Math.pow(0.0005, Math.min(deltaSeconds, 0.1));
      this.camera.position.lerp(this.focusTo.camera, k);
      orbit.target.lerp(this.focusTo.target, k);
      if (this.camera.position.distanceTo(this.focusTo.camera) < 0.05) {
        this.camera.position.copy(this.focusTo.camera);
        orbit.target.copy(this.focusTo.target);
        this.focusTo = null;
      }
    }

    orbit.update();
  }

  protected override disposeControls(): void {
    this.orbit?.dispose();
    this.orbit = null;
  }

  /** Point the camera at the content and set sensible zoom limits. */
  private frameCameraToContent(): void {
    const orbit = this.orbit;
    if (!orbit) return;

    const box = new THREE.Box3().setFromObject(this.content);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 0.5 || 1;

    const fovRadians = (this.camera.fov * Math.PI) / 180;
    const distance = (radius / Math.tan(fovRadians / 2)) * 1.7;

    this.camera.position.set(center.x, center.y + radius * 0.3, center.z + distance);
    this.camera.lookAt(center);

    orbit.target.copy(center);
    // Allow zooming right in (down to ~15 cm) so tiny carved details are
    // inspectable; the camera's near plane is 5 cm.
    orbit.minDistance = 0.15;
    orbit.maxDistance = radius * 10;
    orbit.update();
  }
}
