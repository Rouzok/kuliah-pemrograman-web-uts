/**
 * Map configuration for the Flight Tracker map (MapLibre GL 5).
 * Adheres to functional requirements:
 * - F-02: Initial view around Indonesia, valid coordinates
 * - NF-08: Permitted tiles/style with visible attribution, coordinate convention [lng, lat]
 */

// Initial center around central Indonesia [longitude, latitude]
export const INDONESIA_CENTER = [118.0149, -2.5489];

// Initial overview zoom level covering the archipelago
export const INDONESIA_ZOOM = 4.8;

// Indonesia bounding box [south, west, north, east] as defined in requirements.md
export const INDONESIA_BBOX = [-10, 95, 6, 141];

/**
 * Permitted tile providers and style configurations.
 * Each provider includes proper legal attribution.
 */
export const TILE_PROVIDERS = {
  // Primary / Default: CARTO Dark Matter (Vector style without raster API-key watermark)
  cartoDark: {
    name: 'CARTO Dark Matter',
    attribution: '© OpenStreetMap contributors © CARTO',
    style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  },

  // Alternative 1: OpenStreetMap Standard Raster
  osm: {
    name: 'OpenStreetMap Standard',
    attribution: '© OpenStreetMap contributors',
    style: {
      version: 8,
      sources: {
        'osm-tiles': {
          type: 'raster',
          tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors',
        },
      },
      layers: [
        {
          id: 'osm-layer',
          type: 'raster',
          source: 'osm-tiles',
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
  },

  // Alternative 2: MapLibre Official Demo Vector Style
  demotiles: {
    name: 'MapLibre Demo Tiles',
    attribution: '© MapLibre © OpenStreetMap contributors',
    style: 'https://demotiles.maplibre.org/style.json',
  },
};

// Default style to use for Flight Tracker
export const DEFAULT_STYLE = TILE_PROVIDERS.cartoDark;

/**
 * Validates finite geographic coordinates.
 * In MapLibre GL, longitude is -180..180 and latitude is -90..90.
 * Zero is a valid coordinate.
 *
 * @param {number|null|undefined} lng - Longitude in degrees
 * @param {number|null|undefined} lat - Latitude in degrees
 * @returns {boolean}
 */
export function isValidCoordinate(lng, lat) {
  if (lng === null || lng === undefined || lat === null || lat === undefined) {
    return false;
  }
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
    return false;
  }
  return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
}

/**
 * Returns formatted plain-text attribution for the given provider.
 *
 * @param {{ attribution?: string }} [provider]
 * @returns {string}
 */
export function formatAttribution(provider = DEFAULT_STYLE) {
  return provider?.attribution || '© OpenStreetMap contributors';
}

/**
 * Checks whether WebGL is supported in the current browser environment.
 * Standard cross-browser fallback check for NF-11.
 *
 * @returns {boolean}
 */
export function isWebGLSupported() {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}
