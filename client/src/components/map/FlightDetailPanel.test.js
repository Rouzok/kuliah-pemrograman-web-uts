import { describe, expect, test } from 'bun:test';
import { resolveAircraftDetails } from './FlightDetailPanel.jsx';
import { metersToFeet, metersPerSecondToKnots, groundState } from '../../utils/aircraft.js';

describe('FlightDetailPanel logic (Task-14)', () => {
  const sampleAircraft = {
    icao24: '8a04a7',
    callsign: 'CTV427',
    origin_country: 'Indonesia',
    time_position: 1793634317,
    last_contact: 1793634345,
    longitude: 106.695,
    latitude: -6.122,
    baro_altitude: 1000, // 1000m -> ~3281 ft
    geo_altitude: 1050,
    velocity: 100, // 100 m/s -> ~194 kt
    true_track: 248.5,
    vertical_rate: -3.5,
    on_ground: false,
  };

  test('resolveAircraftDetails finds matching aircraft in viewport flights', () => {
    const flights = [sampleAircraft, { icao24: '123456', callsign: 'OTHER' }];
    const result = resolveAircraftDetails('8a04a7', flights, null);

    expect(result.aircraft).toBeDefined();
    expect(result.aircraft.callsign).toBe('CTV427');
    expect(result.isMissingFromSnapshot).toBe(false);
  });

  test('resolveAircraftDetails handles case-insensitive ICAO24 queries', () => {
    const flights = [sampleAircraft];
    const result = resolveAircraftDetails('8A04A7', flights, null);

    expect(result.aircraft).toBeDefined();
    expect(result.aircraft.icao24).toBe('8a04a7');
  });

  test('resolveAircraftDetails falls back to lastKnownAircraft when absent from current snapshot', () => {
    const flights = [{ icao24: '123456', callsign: 'OTHER' }]; // 8a04a7 is absent
    const lastKnown = sampleAircraft;

    const result = resolveAircraftDetails('8a04a7', flights, lastKnown);

    expect(result.aircraft).toBeDefined();
    expect(result.aircraft.icao24).toBe('8a04a7');
    expect(result.isMissingFromSnapshot).toBe(true);
  });

  test('resolveAircraftDetails returns null aircraft when no record exists anywhere', () => {
    const flights = [];
    const result = resolveAircraftDetails('unknown1', flights, null);

    expect(result.aircraft).toBeNull();
    expect(result.isMissingFromSnapshot).toBe(true);
  });

  test('converts altitudes and speed to aviation units without precision errors', () => {
    // 1000 meters = 1000 / 0.3048 = 3280.84 ft -> rounded
    const ft = metersToFeet(sampleAircraft.baro_altitude);
    expect(Math.round(ft)).toBe(3281);

    // 100 m/s = 100 * 3600 / 1852 = 194.384... kt
    const kt = metersPerSecondToKnots(sampleAircraft.velocity);
    expect(Math.round(kt)).toBe(194);

    // Null or undefined conversion returns null
    expect(metersToFeet(null)).toBeNull();
    expect(metersPerSecondToKnots(undefined)).toBeNull();
  });

  test('groundState distinguishes Airborne, Ground, and Unknown according to NF-05/F-16', () => {
    expect(groundState(false)).toBe('Airborne');
    expect(groundState(true)).toBe('Ground (reported)');
    expect(groundState(null)).toBe('Unknown');
    expect(groundState(undefined)).toBe('Unknown');
  });
});
