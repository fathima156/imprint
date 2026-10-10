/**
 * Thin wrapper around the browser Geolocation API.
 *
 * The app uses this to know where the visitor physically is, so it can unlock
 * carving only when they are standing at a place (within its `radiusM`). It
 * keeps watching as the position drifts and notifies subscribers on every
 * change.
 *
 * NOTE: browsers only grant geolocation on a secure origin (HTTPS or
 * `localhost`). On a plain-HTTP LAN address the request fails — the "Simulate
 * location" demo toggle covers that case.
 */

import type { LatLng } from './geo';

export type LocationStatus =
  | 'idle'
  | 'locating'
  | 'active'
  | 'denied'
  | 'unavailable'
  | 'error';

/** A position fix, augmented with accuracy and time. */
export interface LocationFix extends LatLng {
  /** Estimated accuracy of the fix, in metres. */
  accuracyM: number;
  /** When the fix was recorded (ms since epoch). */
  timestamp: number;
}

export class LocationService {
  private watchId: number | null = null;
  private currentFix: LocationFix | null = null;
  private currentStatus: LocationStatus = 'idle';
  private readonly listeners = new Set<() => void>();

  /** The latest fix, or null if no position has been received yet. */
  get fix(): LocationFix | null {
    return this.currentFix;
  }

  /** Current status of the underlying geolocation watch. */
  get status(): LocationStatus {
    return this.currentStatus;
  }

  /**
   * Subscribe to changes. The listener fires immediately with the current
   * state, then again on every update. Returns an unsubscribe function.
   */
  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    listener();
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Begin watching the device position. Safe to call more than once. */
  start(): void {
    if (this.watchId !== null) return;

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.currentStatus = 'unavailable';
      this.emit();
      return;
    }

    this.currentStatus = this.currentFix ? 'active' : 'locating';
    this.emit();

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        this.currentFix = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyM: position.coords.accuracy,
          timestamp: position.timestamp,
        };
        this.currentStatus = 'active';
        this.emit();
      },
      (error) => {
        this.currentStatus =
          error.code === error.PERMISSION_DENIED ? 'denied' : 'error';
        this.emit();
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
  }

  /** Stop watching the device position. */
  stop(): void {
    if (
      this.watchId !== null &&
      typeof navigator !== 'undefined' &&
      navigator.geolocation
    ) {
      navigator.geolocation.clearWatch(this.watchId);
    }
    this.watchId = null;
    this.currentStatus = 'idle';
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
