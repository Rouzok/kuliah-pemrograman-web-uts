import { describe, expect, test } from 'bun:test';
import {
  INDONESIA_CENTER,
  INDONESIA_ZOOM,
  INDONESIA_BBOX,
  TILE_PROVIDERS,
  DEFAULT_STYLE,
  isValidCoordinate,
  formatAttribution,
} from './mapConfig.js';

describe('Map configuration for Task-02', () => {
  test('INDONESIA_CENTER uses valid [longitude, latitude] within Indonesia bounds', () => {
    const [lng, lat] = INDONESIA_CENTER;
    expect(typeof lng).toBe('number');
    expect(typeof lat).toBe('number');
    expect(Number.isFinite(lng)).toBe(true);
    expect(Number.isFinite(lat)).toBe(true);
    // Longitude Indonesia: ~95 to ~141
    expect(lng).toBeGreaterThanOrEqual(95);
    expect(lng).toBeLessThanOrEqual(141);
    // Latitude Indonesia: ~-10 to ~6
    expect(lat).toBeGreaterThanOrEqual(-10);
    expect(lat).toBeLessThanOrEqual(6);
  });

  test('INDONESIA_ZOOM is within overview level (4 to 6)', () => {
    expect(typeof INDONESIA_ZOOM).toBe('number');
    expect(INDONESIA_ZOOM).toBeGreaterThanOrEqual(4);
    expect(INDONESIA_ZOOM).toBeLessThanOrEqual(6);
  });

  test('INDONESIA_BBOX matches project specification [south, west, north, east]', () => {
    const [south, west, north, east] = INDONESIA_BBOX;
    expect(south).toBe(-10);
    expect(west).toBe(95);
    expect(north).toBe(6);
    expect(east).toBe(141);
  });

  test('TILE_PROVIDERS defines permitted alternatives with attribution', () => {
    expect(TILE_PROVIDERS.cartoDark).toBeDefined();
    expect(TILE_PROVIDERS.cartoDark.attribution).toContain('OpenStreetMap');
    expect(TILE_PROVIDERS.cartoDark.attribution).toContain('CARTO');
    expect(TILE_PROVIDERS.cartoDark.style).toBeDefined();

    expect(TILE_PROVIDERS.osm).toBeDefined();
    expect(TILE_PROVIDERS.osm.attribution).toContain('OpenStreetMap');
    expect(TILE_PROVIDERS.osm.style).toBeDefined();

    expect(TILE_PROVIDERS.demotiles).toBeDefined();
    expect(TILE_PROVIDERS.demotiles.attribution).toBeDefined();
    expect(TILE_PROVIDERS.demotiles.style).toBeDefined();
  });

  test('DEFAULT_STYLE is valid and has visible attribution', () => {
    expect(DEFAULT_STYLE).toBeDefined();
    expect(typeof DEFAULT_STYLE.attribution).toBe('string');
    expect(DEFAULT_STYLE.attribution.length).toBeGreaterThan(0);
    expect(DEFAULT_STYLE.style).toBeDefined();
  });

  test('isValidCoordinate validates latitude and longitude ranges', () => {
    expect(isValidCoordinate(118.0, -2.5)).toBe(true);
    expect(isValidCoordinate(0, 0)).toBe(true);
    expect(isValidCoordinate(null, 10)).toBe(false);
    expect(isValidCoordinate(118, undefined)).toBe(false);
    expect(isValidCoordinate(NaN, 5)).toBe(false);
    expect(isValidCoordinate(190, 0)).toBe(false); // lng > 180
    expect(isValidCoordinate(100, -95)).toBe(false); // lat < -90
  });

  test('formatAttribution returns non-empty string', () => {
    expect(formatAttribution(TILE_PROVIDERS.cartoDark)).toContain('CARTO');
    expect(formatAttribution()).toContain('OpenStreetMap');
  });
});

