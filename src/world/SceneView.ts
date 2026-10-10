import * as THREE from 'three';

/**
 * Shared plumbing for any full-screen Three.js view.
 *
 * It owns the renderer, scene, camera, lighting, resize handling and the render
 * loop, and frees everything on dispose().
 *
 * Camera control is delegated to subclasses through three hooks:
 *   setupControls()          — create your controller (runs inside mount())
 *   updateControls(delta)    — called every frame
 *   disposeControls()        — release it (runs inside dispose())
 *
 * They run during mount()/dispose() (not the constructor) so subclass fields
 * are fully initialised by the time they run.
 */

/** Simple tuple so camera positions stay strongly typed. */
export type Vec3 = [number, number, number];

/** Preset lighting rigs. `day` is a bright outdoor sun for the open world. */
export type LightingPreset = 'default' | 'day';

export interface FogConfig {
  color: number;
  near: number;
  far: number;
}

export interface SceneViewConfig {
  /** Scene background colour (hex). */
  background: number;
  /** Initial camera position. */
  cameraPosition: Vec3;
  /** Point the camera looks at initially (defaults to the origin). */
  cameraTarget?: Vec3;
  /** Tone-mapping exposure (defaults to 1.1). */
  exposure?: number;
  /** Which lighting rig to use. Defaults to 'default'. */
  lighting?: LightingPreset;
  /** Optional distance fog (mainly for the open world). */
  fog?: FogConfig;
}

export abstract class SceneView {
  protected readonly container: HTMLElement;
  protected readonly renderer: THREE.WebGLRenderer;
  protected readonly scene: THREE.Scene;
  protected readonly camera: THREE.PerspectiveCamera;

  private readonly lighting: LightingPreset;
  private readonly resizeObserver: ResizeObserver;
  private animationFrameId = 0;
  private mounted = false;
  private previousTime = 0;

  constructor(container: HTMLElement, config: SceneViewConfig) {
    this.container = container;
    this.lighting = config.lighting ?? 'default';

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(config.background);
    if (config.fog) {
      this.scene.fog = new THREE.Fog(
        config.fog.color,
        config.fog.near,
        config.fog.far,
      );
    }

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      // The world is metre-scale and spans huge distances; a logarithmic depth
      // buffer keeps depth precision usable so you can inspect carvings that
      // are only a few centimetres tall without z-fighting.
      logarithmicDepthBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = config.exposure ?? 1.1;

    // Annotated so the tuple spread below stays strongly typed.
    const targetArray: Vec3 = config.cameraTarget ?? [0, 0, 0];
    const target = new THREE.Vector3(...targetArray);

    // Near plane is tiny (5 cm) so you can zoom right up to a surface to carve
    // or read a few-centimetre-tall signature; far plane is large enough to see
    // across kilometres.
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.05, 20000);
    this.camera.position.set(...config.cameraPosition);
    this.camera.lookAt(target);

    this.addLighting();

    this.resizeObserver = new ResizeObserver(() => this.resize());
  }

  /** Attach the canvas, create controls and start rendering. */
  mount(): void {
    if (this.mounted) return;
    this.mounted = true;

    this.setupControls();

    this.container.appendChild(this.renderer.domElement);
    this.resizeObserver.observe(this.container);
    this.resize();
    this.previousTime = performance.now();
    this.animationFrameId = requestAnimationFrame(this.animate);
  }

  /** Stop rendering and release every GPU resource owned by this view. */
  dispose(): void {
    if (!this.mounted) return;
    this.mounted = false;

    cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = 0;

    this.disposeControls();
    this.resizeObserver.disconnect();
    disposeObjectTree(this.scene);
    this.renderer.dispose();
    this.renderer.domElement.parentElement?.removeChild(this.renderer.domElement);
  }

  /** Override to create the camera controller. Runs inside mount(). */
  protected setupControls(): void {
    // No controls by default.
  }

  /** Override to advance the camera controller. Runs every frame. */
  protected updateControls(_deltaSeconds: number): void {
    // No-op by default.
  }

  /** Override to release the camera controller. Runs inside dispose(). */
  protected disposeControls(): void {
    // Nothing to release by default.
  }

  /** Override to animate content. Called once per frame with seconds elapsed. */
  protected onFrame(_deltaSeconds: number): void {
    // No-op by default.
  }

  /** Access the DOM element the renderer draws into (for listeners). */
  protected get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  /** Apply the lighting rig chosen by the config. */
  private addLighting(): void {
    if (this.lighting === 'day') {
      // Bright outdoor light: blue sky bounce from above, green from the land.
      const hemisphere = new THREE.HemisphereLight(0xcfe8ff, 0x4a7a3f, 0.95);
      const sun = new THREE.DirectionalLight(0xfff2d0, 2.2);
      sun.position.set(60, 120, 40);
      this.scene.add(hemisphere, sun);
      return;
    }

    // Default: warm key light plus soft ambient fill, tuned for stone.
    const ambient = new THREE.AmbientLight(0x8ea0c0, 0.6);
    const key = new THREE.DirectionalLight(0xffd9a0, 1.7);
    key.position.set(6, 9, 5);
    const rim = new THREE.DirectionalLight(0x7f9dff, 0.5);
    rim.position.set(-6, 3, -6);
    this.scene.add(ambient, key, rim);
  }

  /** Match the renderer/camera to the container's pixel size. */
  private resize(): void {
    const width = this.container.clientWidth || 1;
    const height = this.container.clientHeight || 1;

    this.renderer.setSize(width, height);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /** Render loop. A bound field so the same reference can be cancelled. */
  private readonly animate = (): void => {
    this.animationFrameId = requestAnimationFrame(this.animate);

    const now = performance.now();
    const deltaSeconds = (now - this.previousTime) / 1000;
    this.previousTime = now;

    this.onFrame(deltaSeconds);
    this.updateControls(deltaSeconds);
    this.renderer.render(this.scene, this.camera);
  };
}

/**
 * Recursively dispose geometries, materials and sprite textures under a scene
 * root. Prevents GPU memory leaks when switching between views.
 */
export function disposeObjectTree(root: THREE.Object3D): void {
  root.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      const material = object.material;
      const entries = Array.isArray(material) ? material : [material];
      for (const entry of entries) {
        // Free texture maps too (e.g. the carved-name canvas texture).
        const mapped = entry as THREE.Material & { map?: THREE.Texture | null };
        mapped.map?.dispose();
        entry.dispose();
      }
    } else if (object instanceof THREE.Sprite) {
      object.material.map?.dispose();
      object.material.dispose();
    }
  });
}
