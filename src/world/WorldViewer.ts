import * as THREE from 'three';
import type { Place } from '../data/places';
import { FreeFlyControls } from './FreeFlyControls';
import { SceneView } from './SceneView';
import { createWorld, type World, type WorldLandmark } from './WorldScene';

/** Called when the user taps a landmark in the world. */
export type PlacePickHandler = (place: Place) => void;

/** Sky / fog colour for the open world. */
const SKY_COLOR = 0x9ec9f0;

/**
 * The open-world view: an endless all-land green landscape you fly through,
 * with all ten landmarks placed at their true real-world positions.
 *
 * SCALE: 1 unit = 1 metre, and places are up to ~1,500 km apart. To keep
 * centimetre precision at those distances, all world geometry lives under a
 * single `contentRoot` group whose position is set to `-cameraPosition` every
 * frame (a floating origin); the camera itself stays at the origin in rendered
 * space. See `syncOrigin()`.
 *
 * Navigation is a first-person free-fly camera (see FreeFlyControls): drag to
 * look, WASD / joystick to move, scroll / pinch to zoom right down to a few
 * centimetres. Terrain streams around the camera each frame. A tap opens the
 * landmark under the finger; `travelTo()` fast-travels between places.
 */
export class WorldViewer extends SceneView {
  private readonly world: World;
  private readonly onSelect: PlacePickHandler;
  private fly: FreeFlyControls | null = null;

  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private pointerDownX = 0;
  private pointerDownY = 0;
  private pointerDownTime = 0;

  constructor(
    container: HTMLElement,
    places: Place[],
    onSelect: PlacePickHandler,
  ) {
    super(container, {
      background: SKY_COLOR,
      // Fog fades terrain out just before the streamed chunks end.
      fog: { color: SKY_COLOR, near: 150, far: 480 },
      cameraPosition: [0, 200, 600],
      cameraTarget: [0, 0, 0],
      lighting: 'day',
    });

    this.onSelect = onSelect;
    this.world = createWorld(this.scene, places);
  }

  /** The places available to fast-travel to, in display order. */
  getPlaces(): Place[] {
    return this.world.landmarks.map((entry) => entry.place);
  }

  /** Movement from the on-screen joystick: x right, y down (both -1..1). */
  setMoveInput(x: number, y: number): void {
    this.fly?.setMoveInput(x, y);
  }

  /** Current viewer position in world metres, or null before controls exist. */
  getPosition(): { x: number; z: number } | null {
    if (!this.fly) return null;
    return { x: this.fly.position.x, z: this.fly.position.z };
  }

  /** Fast-travel the camera to a place by id, framing the whole landmark. */
  travelTo(placeId: string): void {
    const landmark = this.world.landmarks.find(
      (entry) => entry.place.id === placeId,
    );
    if (!landmark || !this.fly) return;

    this.fly.setPosition(
      landmark.viewPosition.x,
      landmark.viewPosition.y,
      landmark.viewPosition.z,
    );
    this.fly.lookAt(landmark.viewTarget);
    this.world.update(this.fly.position);
    this.syncOrigin();
  }

  /** Create the first-person controller and spawn at the first place. */
  protected override setupControls(): void {
    this.fly = new FreeFlyControls(this.camera, this.canvas, {
      // Fast enough to travel between places that are kilometres apart.
      speed: 150,
      sprintMultiplier: 7,
      getGroundHeight: (x, z) => this.world.heightAt(x, z),
      groundClearance: 1.7,
    });

    const first = this.world.landmarks[0];
    if (first) {
      this.travelTo(first.place.id);
    }
  }

  protected override updateControls(deltaSeconds: number): void {
    if (!this.fly) return;
    this.fly.update(deltaSeconds);
    this.syncOrigin();
    this.world.update(this.fly.position);
  }

  protected override disposeControls(): void {
    this.fly?.dispose();
    this.fly = null;
  }

  /**
   * Floating origin: push the world group the opposite way to the viewer and
   * keep the camera at the origin, so nearby geometry is always near (0,0,0).
   */
  private syncOrigin(): void {
    if (!this.fly) return;
    this.world.contentRoot.position.copy(this.fly.position).negate();
    this.camera.position.set(0, 0, 0);
  }

  /** Attach tap handling once the canvas exists. */
  override mount(): void {
    super.mount();
    const canvas = this.canvas;
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointerup', this.handlePointerUp);
  }

  /** Stop terrain streaming and detach listeners before the base teardown. */
  override dispose(): void {
    const canvas = this.canvas;
    canvas.removeEventListener('pointerdown', this.handlePointerDown);
    canvas.removeEventListener('pointerup', this.handlePointerUp);

    this.world.dispose();
    super.dispose();
  }

  private readonly handlePointerDown = (event: PointerEvent): void => {
    this.pointerDownX = event.clientX;
    this.pointerDownY = event.clientY;
    this.pointerDownTime = performance.now();
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    const moved = Math.hypot(
      event.clientX - this.pointerDownX,
      event.clientY - this.pointerDownY,
    );
    const elapsed = performance.now() - this.pointerDownTime;

    // A quick, near-stationary pointer is a tap; anything else is a look/move.
    if (moved > 8 || elapsed > 600) return;
    this.pickAt(event);
  };

  /** Raycast from the tap position and open the landmark that was hit. */
  private pickAt(event: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const roots = this.world.landmarks.map((entry) => entry.root);
    const hit = this.raycaster.intersectObjects(roots, true)[0];
    if (!hit) return;

    const landmark = this.findLandmark(hit.object);
    if (landmark) {
      this.onSelect(landmark.place);
    }
  }

  /** Walk up the hit object's parents to find its registered landmark. */
  private findLandmark(object: THREE.Object3D): WorldLandmark | null {
    let current: THREE.Object3D | null = object;
    while (current) {
      const match = this.world.landmarks.find((entry) => entry.root === current);
      if (match) return match;
      current = current.parent;
    }
    return null;
  }
}
