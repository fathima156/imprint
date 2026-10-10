/**
 * Geospatial helpers.
 *
 * The world is metre-accurate: **1 world unit = 1 metre**. This module converts
 * real latitude/longitude into local world metres (so places sit at their true
 * distances from each other) and measures great-circle distances between
 * coordinates. Later prompts will compare the phone's GPS position with a
 * Place's real coordinates to decide whether carving is unlocked.
 */

/** Mean radius of the Earth in metres (IUGG mean radius). */
const EARTH_RADIUS_M = 6371008.8;

/** A latitude/longitude pair in decimal degrees. */
export interface LatLng {
  latitude: number;
  longitude: number;
}

/** Convert degrees to radians. */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** A position on the flat world plane, in metres. */
export interface WorldPoint {
  /** Easting in metres (+x = east). */
  x: number;
  /** Northing in metres, negated for the world plane (+z = south). */
  z: number;
}

/**
 * Project a real latitude/longitude onto the flat world plane, in metres,
 * relative to `origin`.
 *
 * Uses an equirectangular projection scaled by the cosine of the origin
 * latitude — accurate enough over a few thousand kilometres and, crucially,
 * keeps the relative distances between our places true. North becomes -z and
 * east becomes +x so the world reads like a map from above.
 */
export function latLngToWorld(
  latitude: number,
  longitude: number,
  origin: LatLng,
): WorldPoint {
  const refLat = toRadians(origin.latitude);
  const x = EARTH_RADIUS_M * toRadians(longitude - origin.longitude) * Math.cos(refLat);
  const z = -EARTH_RADIUS_M * toRadians(latitude - origin.latitude);
  return { x, z };
}

/**
 * Great-circle distance between two latitude/longitude points, in metres.
 *
 * Uses the haversine formula, which is accurate enough for our use case
 * (unlocking a place within a radius of tens to thousands of metres).
 *
 * @param lat1 Latitude of point 1 in decimal degrees.
 * @param lng1 Longitude of point 1 in decimal degrees.
 * @param lat2 Latitude of point 2 in decimal degrees.
 * @param lng2 Longitude of point 2 in decimal degrees.
 * @returns Distance in metres.
 */
export function haversine(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_M * c;
}

/**
 * True when the point (lat, lng) lies within `radiusM` metres of the target.
 *
 * This is the rule the app will use to decide if a visitor is "at" a place
 * and therefore allowed to carve. Kept here so the check is testable and
 * reusable instead of being duplicated in the UI.
 */
export function isWithinRadius(
  lat: number,
  lng: number,
  targetLat: number,
  targetLng: number,
  radiusM: number,
): boolean {
  return haversine(lat, lng, targetLat, targetLng) <= radiusM;
}
