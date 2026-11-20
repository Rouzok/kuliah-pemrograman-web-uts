import { describe, expect, test } from 'bun:test';
import { getViewportBounds, mergeAircraftStates, splitAntimeridianBounds } from './mapBounds.js';
import { INDONESIA_BBOX } from './mapConfig.js';

describe('Map bounds and antimeridian handling', () => {
  test('getViewportBounds returns fallback INDONESIA_BBOX when map is null or lacks bounds', () => {
    const result = getViewportBounds(null);
    expect(result).toEqual([INDONESIA_BBOX]);
  });

  test('getViewportBounds extracts and clamps coordinates from map instance', () => {
    const mockMap = {
      getBounds: () => ({
        getSouth: () => -8.5,
        getWest: () => 105.0,
        getNorth: () => -5.2,
        getEast: () => 112.5,
      }),
    };
    const result = getViewportBounds(mockMap);
    expect(result).toEqual([[-8.5, 105.0, -5.2, 112.5]]);
  });

  test('splitAntimeridianBounds splits viewport crossing 180 longitude into two boxes', () => {
    // West 170, East -170 (across antimeridian)
    const boxes = splitAntimeridianBounds(-10, 170, 10, -170);
    expect(boxes.length).toBe(2);
    expect(boxes[0]).toEqual([-10, 170, 10, 180]);
    expect(boxes[1]).toEqual([-10, -180, 10, -170]);
  });

  test('mergeAircraftStates deduplicates aircraft by icao24 and keeps the freshest observation', () => {
    const aircraftA1 = {
      icao24: 'abc123',
      callsign: 'GA123',
      time_position: 1000,
      last_contact: 1010,
    };
    const aircraftA2 = {
      icao24: 'abc123',
      callsign: 'GA123_NEW',
      time_position: 1050,
      last_contact: 1060,
    };
    const aircraftB = {
      icao24: 'def456',
      callsign: 'SJY456',
      time_position: 1020,
      last_contact: 1030,
    };

    const merged = mergeAircraftStates([[aircraftA1, aircraftB], [aircraftA2]]);
    expect(merged.length).toBe(2);
    const planeA = merged.find((p) => p.icao24 === 'abc123');
    expect(planeA.callsign).toBe('GA123_NEW');
    expect(planeA.time_position).toBe(1050);
  });
});

