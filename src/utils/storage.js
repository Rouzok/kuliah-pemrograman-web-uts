import { normalizeFlightParams } from '../api/validation.js';
const STORAGE_KEY = 'skytrace_saved_flights';
const storageError = () => new Error('Penyimpanan lokal tidak tersedia atau rusak. Bookmark tidak diubah.');
export function getSavedFlights() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    if (!Array.isArray(data)) throw storageError();
    return data.filter((item) => item && typeof item === 'object' && typeof item.id === 'string');
  } catch {
    throw storageError();
  }
}
function persist(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    throw storageError();
  }
  window.dispatchEvent(new Event('bookmarksUpdated'));
  return items;
}
export function saveFlight(flight) {
  const code = normalizeFlightParams({ icao24: flight?.icao24 ?? (flight?.identifierType === 'icao24' ? flight.code : undefined) }).icao24;
  const bookmark = { id: `icao24:${code}`, code, identifierType: 'icao24' };
  if (typeof flight.callsign === 'string') bookmark.callsign = flight.callsign.trim();
  const current = getSavedFlights();
  if (current.some((item) => item.identifierType === 'icao24' && typeof item.code === 'string' && item.code.trim().toLowerCase() === code)) return current;
  return persist([...current, bookmark]);
}
export function removeFlight(id) {
  return persist(getSavedFlights().filter((item) => item.id !== id));
}
export function isFlightSaved(id) {
  return getSavedFlights().some((item) => item.id === id);
}
