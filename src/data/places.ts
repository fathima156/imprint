/**
 * The places shown in the virtual world — ten famous monuments and mountain
 * spots in India, plus TinkerSpace Calicut.
 *
 * This is static placeholder data for now. Later these will come from the
 * database (Supabase) together with the carved names for each place. The
 * coordinates are approximate and MUST be verified before the demo.
 *
 * SCALE: the world is metre-accurate (1 unit = 1 metre) and every place is
 * positioned at its true latitude/longitude, so the distances between them are
 * their real-world distances (see `latLngToWorld` in ../lib/geo.ts).
 */

import type { LatLng } from '../lib/geo';

/**
 * Reference point the flat world is centred on — roughly the centre of India,
 * chosen to keep every place's metre coordinate as small as possible. All
 * places are projected relative to this point.
 */
export const WORLD_ORIGIN: LatLng = {
  latitude: 24.5,
  longitude: 79.0,
};

/** Broad category of a place, used for labelling and (later) carve radius. */
export type PlaceType = 'monument' | 'palace' | 'hike' | 'rock';

export interface Place {
  /** Stable identifier, also used as the primary key in the database. */
  id: string;
  /** Human-readable name shown in the UI. */
  name: string;
  /** Category of the place. */
  type: PlaceType;
  /** Latitude in decimal degrees. */
  latitude: number;
  /** Longitude in decimal degrees. */
  longitude: number;
  /** Radius in metres within which carving is unlocked. */
  radiusM: number;
  /** Deterministic seed for the procedural stone (same seed = same shape). */
  seed: number;
}

/**
 * Ten famous Indian places: monuments, palaces and mountain spots.
 *
 * NOTE: every latitude/longitude below is approximate.
 * // TODO verify — confirm each coordinate and radius before the demo.
 */
export const PLACES: Place[] = [
  {
    id: 'taj-mahal',
    name: 'Taj Mahal',
    type: 'monument',
    latitude: 27.1751, // TODO verify
    longitude: 78.0421, // TODO verify
    radiusM: 150,
    seed: 1001,
  },
  {
    id: 'amber-fort',
    name: 'Amber Fort',
    type: 'palace',
    latitude: 26.9855, // TODO verify
    longitude: 75.8513, // TODO verify
    radiusM: 200,
    seed: 1002,
  },
  {
    id: 'qutub-minar',
    name: 'Qutub Minar',
    type: 'monument',
    latitude: 28.5245, // TODO verify
    longitude: 77.1855, // TODO verify
    radiusM: 120,
    seed: 1003,
  },
  {
    id: 'gateway-of-india',
    name: 'Gateway of India',
    type: 'monument',
    latitude: 18.922, // TODO verify
    longitude: 72.8347, // TODO verify
    radiusM: 120,
    seed: 1004,
  },
  {
    id: 'charminar',
    name: 'Charminar',
    type: 'monument',
    latitude: 17.3616, // TODO verify
    longitude: 78.4747, // TODO verify
    radiusM: 120,
    seed: 1005,
  },
  {
    id: 'konark-sun-temple',
    name: 'Konark Sun Temple',
    type: 'monument',
    latitude: 19.8876, // TODO verify
    longitude: 86.0945, // TODO verify
    radiusM: 150,
    seed: 1006,
  },
  {
    id: 'hampi',
    name: 'Hampi',
    type: 'rock',
    latitude: 15.335, // TODO verify
    longitude: 76.46, // TODO verify
    radiusM: 500,
    seed: 1007,
  },
  {
    id: 'rohtang-pass',
    name: 'Rohtang Pass',
    type: 'hike',
    latitude: 32.3716, // TODO verify
    longitude: 77.2476, // TODO verify
    radiusM: 1500,
    seed: 1009,
  },
  {
    id: 'kanchenjunga',
    name: 'Kanchenjunga',
    type: 'hike',
    latitude: 27.7025, // TODO verify
    longitude: 88.1475, // TODO verify
    radiusM: 3000,
    seed: 1010,
  },
  {
    id: 'tinkerspace-calicut',
    name: 'TinkerSpace Calicut',
    type: 'monument',
    // From Plus Code 7RHV+8M Kozhikode, Keralam (IPM, near Medical College).
    latitude: 11.2783,
    longitude: 75.8442,
    radiusM: 100,
    seed: 1011,
  },
];
