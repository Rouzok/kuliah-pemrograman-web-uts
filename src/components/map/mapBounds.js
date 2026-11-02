import { INDONESIA_BBOX } from './mapConfig.js';

/**
 * Splits bounding box if it crosses the antimeridian (+/- 180 deg longitude).
 * OpenSky /api/flights requires west < east and each in -180..180.
 *
 * @param {number} south
 * @param {number} west
 * @param {number} north
 * @param {number} east
 * @returns {Array<[number, number, number, number]>}
 */
export function splitAntimeridianBounds(south, west, north, east) {
  // Clamp latitudes to valid geographic range [-90, 90]
  const clampedSouth = Math.max(-90, Math.min(90, south));
  const clampedNorth = Math.max(-90, Math.min(90, north));

  if (clampedSouth >= clampedNorth) {
    return [INDONESIA_BBOX];
  }

  // Normalize longitudes into [-180, 180]
  let normWest = ((((west + 180) % 360) + 360) % 360) - 180;
  let normEast = ((((east + 180) % 360) + 360) % 360) - 180;

  // Handle case where viewport spans 360 degrees or whole world
  if (east - west >= 360) {
    return [[clampedSouth, -180, clampedNorth, 180]];
  }

  // If east < west, the viewport crosses the antimeridian
  if (normEast < normWest) {
    return [
      [clampedSouth, normWest, clampedNorth, 180],
      [clampedSouth, -180, clampedNorth, normEast],
    ];
  }

  return [[clampedSouth, normWest, clampedNorth, normEast]];
}

/**
 * Extracts current viewport bounding boxes from MapLibre map instance.
 * Automatically handles antimeridian crossing by splitting into 1 or 2 boxes.
 *
 * @param {import('maplibre-gl').Map|null} map
 * @returns {Array<[number, number, number, number]>}
 */
export function getViewportBounds(map) {
  if (!map || typeof map.getBounds !== 'function') {
    return [INDONESIA_BBOX];
  }

  try {
    const bounds = map.getBounds();
    if (!bounds) return [INDONESIA_BBOX];

    const south = bounds.getSouth();
    const west = bounds.getWest();
    const north = bounds.getNorth();
    const east = bounds.getEast();

    if (![south, west, north, east].every(Number.isFinite)) {
      return [INDONESIA_BBOX];
    }

    return splitAntimeridianBounds(south, west, north, east);
  } catch {
    return [INDONESIA_BBOX];
  }
}

/**
 * Comparator to determine which observation is fresher.
 */
function freshness(a, b) {
  return (
    (b.time_position ?? -1) - (a.time_position ?? -1) ||
    (b.last_contact ?? -1) - (a.last_contact ?? -1) ||
    a.icao24.localeCompare(b.icao24)
  );
}

/**
 * Merges multiple lists of aircraft states, deduplicating by icao24
 * and retaining the freshest record.
 *
 * @param {Array<Array<object>>} groups
 * @returns {Array<object>}
 */
export function mergeAircraftStates(groups) {
  const states = new Map();
  for (const state of groups.flat()) {
    if (!state || !state.icao24) continue;
    const previous = states.get(state.icao24);
    if (!previous || freshness(state, previous) < 0) {
      states.set(state.icao24, state);
    }
  }
  return [...states.values()];
}

