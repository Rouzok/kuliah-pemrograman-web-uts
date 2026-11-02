// Utilitas pemformatan data OpenSky untuk Flight Tracker (Member 3)

export const metersToFeet = (value) => (Number.isFinite(value) ? value / 0.3048 : null);
export const metersPerSecondToKnots = (value) => (Number.isFinite(value) ? (value * 3600) / 1852 : null);
export const groundState = (value) => (value === true ? 'Ground (reported)' : value === false ? 'Airborne' : 'Unknown');

// Konversi altitude dari meter ke feet (OpenSky baro_altitude / geo_altitude)
export function formatAltitude(meters) {
  if (meters === null || meters === undefined || isNaN(meters)) return '—';
  const feet = Math.round(meters / 0.3048);
  return `${feet.toLocaleString()} ft`;
}

// Konversi kecepatan dari m/s ke knots (OpenSky velocity)
export function formatSpeed(ms) {
  if (ms === null || ms === undefined || isNaN(ms)) return '—';
  const knots = Math.round((ms * 3600) / 1852);
  return `${knots} kts`;
}

// Format callsign dengan fallback ke icao24
export function formatCallsign(callsign, icao24) {
  if (callsign && callsign.trim() !== '') return callsign.trim();
  return icao24 ? icao24.toLowerCase() : '—';
}

// Format status penerbangan OpenSky berdasarkan on_ground (true = Ground, false = Airborne)
export function formatFlightStatus(onGround) {
  if (onGround === true) return 'On ground';
  if (onGround === false) return 'Airborne';
  return 'Unknown';
}