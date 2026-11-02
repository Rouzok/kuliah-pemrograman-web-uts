import { describe, expect, test } from 'bun:test';
import { canCreateMarker, getAircraftHeading, getAircraftDisplayName } from './markerUtils.js';

describe('Marker utilities (Task-12)', () => {
  test('canCreateMarker requires finite coordinates within valid ranges', () => {
    expect(canCreateMarker({ longitude: 106.8, latitude: -6.2 })).toBe(true);
    expect(canCreateMarker({ longitude: null, latitude: -6.2 })).toBe(false);
    expect(canCreateMarker({ longitude: 106.8, latitude: null })).toBe(false);
    expect(canCreateMarker({ longitude: 195, latitude: -6.2 })).toBe(false);
    expect(canCreateMarker({ longitude: 106.8, latitude: -95 })).toBe(false);
    expect(canCreateMarker(null)).toBe(false);
  });

  test('getAircraftHeading defaults to 0 when true_track is null or not finite', () => {
    expect(getAircraftHeading({ true_track: 185.5 })).toBe(185.5);
    expect(getAircraftHeading({ true_track: null })).toBe(0);
    expect(getAircraftHeading({})).toBe(0);
  });

  test('getAircraftDisplayName uses trimmed callsign with fallback to icao24', () => {
    expect(getAircraftDisplayName({ callsign: '  CTV427  ', icao24: '8a04a7' })).toBe('CTV427');
    expect(getAircraftDisplayName({ callsign: null, icao24: '8a04a7' })).toBe('8a04a7');
    expect(getAircraftDisplayName({ callsign: '', icao24: '8a04a7' })).toBe('8a04a7');
  });
});

