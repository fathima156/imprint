import type { Group } from 'three';
import { createAmberFort } from './AmberFort';
import { createCharminar } from './Charminar';
import { createGatewayOfIndia } from './GatewayOfIndia';
import { createHampi } from './Hampi';
import { createKanchenjunga } from './Kanchenjunga';
import { createKonarkSunTemple } from './KonarkSunTemple';
import { createQutubMinar } from './QutubMinar';
import { createRohtangPass } from './RohtangPass';
import { createTajMahal } from './TajMahal';
import { createTinkerSpaceCalicut } from './TinkerSpaceCalicut';

/** Builds a detailed landmark model, origin at the centre of its base. */
export type LandmarkModelFactory = () => Group;

/**
 * Places that have a hand-built model instead of the generic procedural stone.
 * Add entries here as more places get modelled.
 */
const MODELS: Record<string, LandmarkModelFactory> = {
  'taj-mahal': createTajMahal,
  'amber-fort': createAmberFort,
  hampi: createHampi,
  'qutub-minar': createQutubMinar,
  'gateway-of-india': createGatewayOfIndia,
  charminar: createCharminar,
  'konark-sun-temple': createKonarkSunTemple,
  'rohtang-pass': createRohtangPass,
  kanchenjunga: createKanchenjunga,
  'tinkerspace-calicut': createTinkerSpaceCalicut,
};

/** Returns a model factory for a place id, or null if it uses the stone. */
export function getLandmarkModel(placeId: string): LandmarkModelFactory | null {
  return MODELS[placeId] ?? null;
}