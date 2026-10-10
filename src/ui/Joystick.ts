/**
 * A small on-screen analogue stick for touch movement.
 *
 * Emits a normalised vector where x is right (+) / left (-) and y is down (+) /
 * up (-), each in the range -1..1. The world viewer feeds this into its free-fly
 * controller so phones can move without a keyboard.
 *
 * The control only handles its own pointer events, so dragging the stick never
 * rotates the camera. It is hidden by CSS on devices with a fine pointer (mouse).
 */

export type JoystickListener = (x: number, y: number) => void;

/** Radius (px) the knob can travel from the centre. */
const KNOB_RANGE = 48;

export class Joystick {
  readonly element: HTMLElement;

  private readonly knob: HTMLElement;
  private readonly listener: JoystickListener;
  private activePointerId: number | null = null;

  constructor(listener: JoystickListener) {
    this.listener = listener;

    this.element = document.createElement('div');
    this.element.className = 'joystick';
    this.element.setAttribute('aria-hidden', 'true');

    this.knob = document.createElement('div');
    this.knob.className = 'joystick__knob';
    this.element.append(this.knob);

    this.element.addEventListener('pointerdown', this.onPointerDown);
    this.element.addEventListener('pointermove', this.onPointerMove);
    this.element.addEventListener('pointerup', this.onPointerUp);
    this.element.addEventListener('pointercancel', this.onPointerUp);
  }

  /** Remove listeners (the element itself is removed by the caller). */
  dispose(): void {
    this.element.removeEventListener('pointerdown', this.onPointerDown);
    this.element.removeEventListener('pointermove', this.onPointerMove);
    this.element.removeEventListener('pointerup', this.onPointerUp);
    this.element.removeEventListener('pointercancel', this.onPointerUp);
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    this.activePointerId = event.pointerId;
    this.element.setPointerCapture(event.pointerId);
    this.update(event);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) return;
    this.update(event);
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.activePointerId) return;
    this.activePointerId = null;
    if (this.element.hasPointerCapture(event.pointerId)) {
      this.element.releasePointerCapture(event.pointerId);
    }
    this.reset();
  };

  /** Map a pointer position to a clamped vector and move the knob. */
  private update(event: PointerEvent): void {
    const rect = this.element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    let dx = event.clientX - centerX;
    let dy = event.clientY - centerY;

    const distance = Math.hypot(dx, dy);
    if (distance > KNOB_RANGE) {
      dx = (dx / distance) * KNOB_RANGE;
      dy = (dy / distance) * KNOB_RANGE;
    }

    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    this.listener(dx / KNOB_RANGE, dy / KNOB_RANGE);
  }

  private reset(): void {
    this.knob.style.transform = 'translate(0px, 0px)';
    this.listener(0, 0);
  }
}
