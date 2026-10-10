import { WORLD_ORIGIN, type Place } from '../data/places';
import { latLngToWorld } from '../lib/geo';

/**
 * A scrollable top-down map of the whole world.
 *
 * The open world is first-person and its places are up to ~1,500 km apart, so
 * flying between landmarks by hand is impractical. This overlay draws every
 * landmark at its true relative position on a pannable/zoomable canvas: drag to
 * scroll the map, scroll/pinch to zoom, and tap a marker to fly there.
 *
 * Coordinates are world metres (1 unit = 1 metre) from `latLngToWorld`, with
 * north up and +z (south) drawn downward — the same layout as the 3D world.
 */

interface Marker {
  id: string;
  name: string;
  x: number;
  z: number;
}

export interface WorldMapOptions {
  places: Place[];
  /** Current viewer position in world metres, for the "you are here" dot. */
  getPosition: () => { x: number; z: number } | null;
  /** Called when a marker is tapped; the id of the chosen place. */
  onPick: (placeId: string) => void;
}

/** Screen hit radius (px) around a marker for taps. */
const HIT_RADIUS = 22;

export class WorldMap {
  readonly element: HTMLDivElement;

  private readonly markers: Marker[];
  private readonly getPosition: () => { x: number; z: number } | null;
  private readonly onPick: (placeId: string) => void;

  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;

  /** View transform: world centre and pixels-per-metre. */
  private center = { x: 0, z: 0 };
  private scale = 1;

  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pinchDistance = 0;
  private dragMoved = 0;
  private readonly resizeObserver: ResizeObserver;
  private frame = 0;

  constructor(options: WorldMapOptions) {
    this.getPosition = options.getPosition;
    this.onPick = options.onPick;
    this.markers = options.places.map((place) => {
      const world = latLngToWorld(
        place.latitude,
        place.longitude,
        WORLD_ORIGIN,
      );
      return { id: place.id, name: place.name, x: world.x, z: world.z };
    });

    this.element = document.createElement('div');
    this.element.className = 'world-map';

    const header = document.createElement('div');
    header.className = 'world-map__header';
    const title = document.createElement('span');
    title.className = 'world-map__title';
    title.textContent = 'Map — drag to scroll, scroll to zoom, tap a marker to fly';
    const fit = document.createElement('button');
    fit.type = 'button';
    fit.className = 'btn world-map__fit';
    fit.textContent = 'Fit all';
    fit.addEventListener('click', () => this.fit());
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'btn world-map__close';
    close.textContent = 'Close';
    close.addEventListener('click', () => this.hide());
    header.append(title, fit, close);

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'world-map__canvas';
    this.ctx = this.canvas.getContext('2d') as CanvasRenderingContext2D;

    this.element.append(header, this.canvas);

    this.attachPointerHandlers();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.element);
  }

  /** Show the overlay and begin redrawing. */
  show(): void {
    this.element.classList.add('world-map--open');
    this.fit();
    this.loop();
  }

  /** Hide the overlay. */
  hide(): void {
    this.element.classList.remove('world-map--open');
    if (this.frame) cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  get isOpen(): boolean {
    return this.element.classList.contains('world-map--open');
  }

  dispose(): void {
    this.hide();
    this.resizeObserver.disconnect();
  }

  /** Fit every marker into view. */
  private fit(): void {
    const xs = this.markers.map((m) => m.x);
    const zs = this.markers.map((m) => m.z);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minZ = Math.min(...zs);
    const maxZ = Math.max(...zs);
    this.center = { x: (minX + maxX) / 2, z: (minZ + maxZ) / 2 };

    const w = this.canvas.clientWidth || 1;
    const h = this.canvas.clientHeight || 1;
    const spanX = Math.max(maxX - minX, 1);
    const spanZ = Math.max(maxZ - minZ, 1);
    this.scale = Math.min((w * 0.78) / spanX, (h * 0.78) / spanZ);
    this.render();
  }

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = this.element.clientWidth;
    const h = this.element.clientHeight;
    this.canvas.width = Math.max(1, Math.round(w * dpr));
    this.canvas.height = Math.max(1, Math.round(h * dpr));
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private loop = (): void => {
    if (!this.isOpen) return;
    this.render();
    this.frame = requestAnimationFrame(this.loop);
  };

  private worldToScreen(x: number, z: number): { x: number; y: number } {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    return {
      x: (x - this.center.x) * this.scale + w / 2,
      y: (z - this.center.z) * this.scale + h / 2,
    };
  }

  private screenToWorld(sx: number, sy: number): { x: number; z: number } {
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    return {
      x: (sx - w / 2) / this.scale + this.center.x,
      z: (sy - h / 2) / this.scale + this.center.z,
    };
  }

  private zoomAt(sx: number, sy: number, factor: number): void {
    const before = this.screenToWorld(sx, sy);
    this.scale = Math.min(Math.max(this.scale * factor, 1e-6), 5);
    const after = this.screenToWorld(sx, sy);
    this.center.x += before.x - after.x;
    this.center.z += before.z - after.z;
  }

  private localPoint(event: { clientX: number; clientY: number }): {
    x: number;
    y: number;
  } {
    const rect = this.canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  private attachPointerHandlers(): void {
    const canvas = this.canvas;

    canvas.addEventListener('pointerdown', (event) => {
      canvas.setPointerCapture(event.pointerId);
      this.pointers.set(event.pointerId, this.localPoint(event));
      this.dragMoved = 0;
      if (this.pointers.size === 2) this.pinchDistance = this.pinchSpread();
    });

    canvas.addEventListener('pointermove', (event) => {
      const previous = this.pointers.get(event.pointerId);
      if (!previous) return;
      const point = this.localPoint(event);
      this.pointers.set(event.pointerId, point);

      if (this.pointers.size === 1) {
        // Single pointer: scroll the map.
        const dx = point.x - previous.x;
        const dy = point.y - previous.y;
        this.dragMoved += Math.hypot(dx, dy);
        this.center.x -= dx / this.scale;
        this.center.z -= dy / this.scale;
      } else if (this.pointers.size === 2) {
        // Two pointers: pinch to zoom around their midpoint.
        const distance = this.pinchSpread();
        if (this.pinchDistance > 0 && distance > 0) {
          const mid = this.pinchMidpoint();
          this.zoomAt(mid.x, mid.y, distance / this.pinchDistance);
        }
        this.pinchDistance = distance;
        this.dragMoved += 999; // a pinch is never a tap
      }
    });

    const end = (event: PointerEvent) => {
      const wasSingle = this.pointers.size === 1;
      const start = this.pointers.get(event.pointerId);
      this.pointers.delete(event.pointerId);
      if (this.pointers.size < 2) this.pinchDistance = 0;
      if (this.pointers.size === 0 && wasSingle && start && this.dragMoved < 8) {
        this.pickAt(start.x, start.y);
      }
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);

    canvas.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        const point = this.localPoint(event);
        this.zoomAt(point.x, point.y, Math.exp(-event.deltaY * 0.0015));
      },
      { passive: false },
    );
  }

  /** Distance between the two active pointers. */
  private pinchSpread(): number {
    const points = [...this.pointers.values()];
    if (points.length < 2) return 0;
    return Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
  }

  /** Midpoint between the two active pointers. */
  private pinchMidpoint(): { x: number; y: number } {
    const points = [...this.pointers.values()];
    return {
      x: (points[0].x + points[1].x) / 2,
      y: (points[0].y + points[1].y) / 2,
    };
  }

  /** Open the marker nearest the tap, if any is close enough. */
  private pickAt(sx: number, sy: number): void {
    let best: Marker | null = null;
    let bestDistance = HIT_RADIUS;
    for (const marker of this.markers) {
      const point = this.worldToScreen(marker.x, marker.z);
      const distance = Math.hypot(point.x - sx, point.y - sy);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = marker;
      }
    }
    if (best) {
      this.onPick(best.id);
      this.hide();
    }
  }

  private render(): void {
    const ctx = this.ctx;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    if (w === 0 || h === 0) return;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#0b0e13';
    ctx.fillRect(0, 0, w, h);

    this.drawGrid(w, h);

    const position = this.getPosition();

    // Markers.
    for (const marker of this.markers) {
      const point = this.worldToScreen(marker.x, marker.z);
      ctx.beginPath();
      ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#f0c674';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(11, 14, 19, 0.9)';
      ctx.stroke();

      ctx.font = '600 12px system-ui, -apple-system, sans-serif';
      ctx.fillStyle = '#eef2f8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(marker.name, point.x, point.y + 10);
    }

    // "You are here" dot.
    if (position) {
      const point = this.worldToScreen(position.x, position.z);
      ctx.beginPath();
      ctx.arc(point.x, point.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#5ad0a0';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#0b0e13';
      ctx.stroke();
    }
  }

  private drawGrid(w: number, h: number): void {
    // A light graticule every 500 km, so the map reads as a real-world scale.
    const spacingWorld = 500_000;
    const spacingPx = spacingWorld * this.scale;
    if (spacingPx < 24) return;

    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(238, 242, 248, 0.06)';
    ctx.lineWidth = 1;
    const originX = this.worldToScreen(0, 0).x % spacingPx;
    const originY = this.worldToScreen(0, 0).y % spacingPx;
    for (let x = originX; x <= w; x += spacingPx) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = originY; y <= h; y += spacingPx) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  }
}
