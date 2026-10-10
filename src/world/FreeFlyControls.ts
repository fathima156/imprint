import * as THREE from 'three';

/**
 * A first-person "free fly" camera controller — the feel of moving through the
 * world rather than orbiting a single object.
 *
 * The world is metre-scale and can span millions of metres, so this controller
 * keeps a separate *logical* position (`position`) in true world metres. The
 * camera object itself is left at the origin; the caller offsets the whole
 * scene by `-position` each frame (floating origin), which preserves
 * centimetre precision near the viewer no matter how far from the origin we are.
 *
 * Input:
 *   - Mouse / one-finger drag ...... look around
 *   - W A S D or arrow keys ........ move (forward/back/strafe along the view)
 *   - Shift ........................ sprint
 *   - Mouse wheel / pinch .......... zoom (field of view)
 *   - setMoveInput(x, y) ........... move vector from an on-screen joystick
 *
 * An optional `getGroundHeight` callback keeps the camera above the terrain,
 * so you travel along the surface instead of sinking through it.
 */

export interface FreeFlyConfig {
  /** Base movement speed in metres per second. Default 40. */
  speed?: number;
  /** Speed multiplier while Shift is held. Default 3. */
  sprintMultiplier?: number;
  /** Look sensitivity in radians per pixel. Default 0.0032. */
  lookSpeed?: number;
  /** Field-of-view zoom limits in degrees. Default 3..80 (3° can read cm text). */
  minFov?: number;
  maxFov?: number;
  /** Pinch-to-zoom rate. Higher = faster. Default 5. */
  pinchSensitivity?: number;
  /** Mouse-wheel zoom rate (degrees per wheel unit). Default 0.22. */
  wheelZoomSpeed?: number;
  /** Optional terrain height sampler used to keep the camera above ground. */
  getGroundHeight?: (x: number, z: number) => number;
  /** Eye clearance kept above the ground, in metres. Default 1.7. */
  groundClearance?: number;
}

/** Keys that move the camera (KeyboardEvent.code values). */
const FORWARD_KEYS = ['KeyW', 'ArrowUp'];
const BACK_KEYS = ['KeyS', 'ArrowDown'];
const LEFT_KEYS = ['KeyA', 'ArrowLeft'];
const RIGHT_KEYS = ['KeyD', 'ArrowRight'];
const SPRINT_KEYS = ['ShiftLeft', 'ShiftRight'];
/** Keys we swallow so the page does not scroll while flying. */
const CAPTURED_KEYS = [
  ...FORWARD_KEYS,
  ...BACK_KEYS,
  ...LEFT_KEYS,
  ...RIGHT_KEYS,
];

export class FreeFlyControls {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly element: HTMLElement;

  /** Logical viewer position in true world metres (the floating origin). */
  readonly position: THREE.Vector3;

  private readonly speed: number;
  private readonly sprintMultiplier: number;
  private readonly lookSpeed: number;
  private readonly minFov: number;
  private readonly maxFov: number;
  private readonly pinchSensitivity: number;
  private readonly wheelZoomSpeed: number;
  private readonly getGroundHeight?: (x: number, z: number) => number;
  private readonly groundClearance: number;

  private yaw = 0;
  private pitch = 0;

  private readonly keys = new Set<string>();
  private readonly moveInput = new THREE.Vector2();

  /** Active pointers, mapped to their last position (for look / pinch). */
  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinchStartDistance = 0;
  private pinchStartFov = 0;

  constructor(
    camera: THREE.PerspectiveCamera,
    element: HTMLElement,
    config: FreeFlyConfig = {},
  ) {
    this.camera = camera;
    this.element = element;
    this.speed = config.speed ?? 40;
    this.sprintMultiplier = config.sprintMultiplier ?? 3;
    this.lookSpeed = config.lookSpeed ?? 0.0032;
    this.minFov = config.minFov ?? 1.2;
    this.maxFov = config.maxFov ?? 80;
    this.pinchSensitivity = config.pinchSensitivity ?? 5;
    this.wheelZoomSpeed = config.wheelZoomSpeed ?? 0.22;
    this.getGroundHeight = config.getGroundHeight;
    this.groundClearance = config.groundClearance ?? 1.7;

    // The logical position starts where the camera was placed; the camera is
    // then parked at the origin because the caller renders relative to us.
    this.position = camera.position.clone();
    camera.position.set(0, 0, 0);

    // Start looking in whatever direction the camera was already pointing.
    const euler = new THREE.Euler().setFromQuaternion(
      this.camera.quaternion,
      'YXZ',
    );
    this.yaw = euler.y;
    this.pitch = euler.x;

    element.addEventListener('pointerdown', this.onPointerDown);
    element.addEventListener('pointermove', this.onPointerMove);
    element.addEventListener('pointerup', this.onPointerUp);
    element.addEventListener('pointercancel', this.onPointerUp);
    element.addEventListener('wheel', this.onWheel, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  /** Movement from an external joystick: x = right, y = down (both -1..1). */
  setMoveInput(x: number, y: number): void {
    this.moveInput.set(x, y);
  }

  /** Move the logical viewer to a new true-world position (metres). */
  setPosition(x: number, y: number, z: number): void {
    this.position.set(x, y, z);
  }

  /** Point the view at a world-space target (used after fast-travel). */
  lookAt(target: THREE.Vector3): void {
    const matrix = new THREE.Matrix4().lookAt(this.position, target, this.camera.up);
    const euler = new THREE.Euler().setFromRotationMatrix(matrix, 'YXZ');
    this.yaw = euler.y;
    this.pitch = THREE.MathUtils.clamp(euler.x, -1.45, 1.45);
  }

  /** Advance the camera: apply orientation, movement and ground clamping. */
  update(deltaSeconds: number): void {
    this.camera.quaternion.setFromEuler(
      new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'),
    );

    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    const right = new THREE.Vector3()
      .crossVectors(forward, this.camera.up)
      .normalize();

    const move = new THREE.Vector3();
    if (this.isDown(FORWARD_KEYS)) move.add(forward);
    if (this.isDown(BACK_KEYS)) move.sub(forward);
    if (this.isDown(RIGHT_KEYS)) move.add(right);
    if (this.isDown(LEFT_KEYS)) move.sub(right);
    move.addScaledVector(forward, -this.moveInput.y);
    move.addScaledVector(right, this.moveInput.x);

    if (move.lengthSq() > 0) {
      move.normalize();
      const sprint = this.isDown(SPRINT_KEYS) ? this.sprintMultiplier : 1;
      this.position.addScaledVector(move, this.speed * sprint * deltaSeconds);
    }

    // Keep the camera above the ground so we travel across the surface.
    if (this.getGroundHeight) {
      const floor =
        this.getGroundHeight(this.position.x, this.position.z) +
        this.groundClearance;
      if (this.position.y < floor) {
        this.position.y = floor;
      }
    }
  }

  /** Remove every listener. */
  dispose(): void {
    this.element.removeEventListener('pointerdown', this.onPointerDown);
    this.element.removeEventListener('pointermove', this.onPointerMove);
    this.element.removeEventListener('pointerup', this.onPointerUp);
    this.element.removeEventListener('pointercancel', this.onPointerUp);
    this.element.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.pointers.clear();
    this.keys.clear();
  }

  private isDown(codes: string[]): boolean {
    return codes.some((code) => this.keys.has(code));
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    this.element.setPointerCapture(event.pointerId);
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.pointers.size === 2) {
      this.pinchStartDistance = this.pointerDistance();
      this.pinchStartFov = this.camera.fov;
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    const previous = this.pointers.get(event.pointerId);
    if (!previous) return;

    // Two pointers => pinch to zoom; one pointer => look around.
    if (this.pointers.size === 1) {
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      this.yaw -= dx * this.lookSpeed;
      this.pitch -= dy * this.lookSpeed;
      this.pitch = THREE.MathUtils.clamp(this.pitch, -1.45, 1.45);
    }

    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (this.pointers.size === 2) {
      const distance = this.pointerDistance();
      if (distance > 0 && this.pinchStartDistance > 0) {
        // Exaggerate the raw pinch ratio so zoom reacts faster to finger travel.
        const ratio = Math.pow(
          this.pinchStartDistance / distance,
          this.pinchSensitivity,
        );
        this.applyFov(this.pinchStartFov * ratio);
      }
    }
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    this.pointers.delete(event.pointerId);
    if (this.element.hasPointerCapture(event.pointerId)) {
      this.element.releasePointerCapture(event.pointerId);
    }
    if (this.pointers.size < 2) {
      this.pinchStartDistance = 0;
    }
  };

  private readonly onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.applyFov(this.camera.fov + event.deltaY * this.wheelZoomSpeed);
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.target instanceof HTMLInputElement) return;
    this.keys.add(event.code);
    if (CAPTURED_KEYS.includes(event.code)) {
      event.preventDefault();
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private applyFov(fov: number): void {
    this.camera.fov = THREE.MathUtils.clamp(fov, this.minFov, this.maxFov);
    this.camera.updateProjectionMatrix();
  }

  private pointerDistance(): number {
    const points = [...this.pointers.values()];
    if (points.length < 2) return 0;
    return Math.hypot(
      points[0].x - points[1].x,
      points[0].y - points[1].y,
    );
  }
}
