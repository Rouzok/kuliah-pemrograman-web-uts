/**
 * Marker utilities for rendering aircraft icons on MapLibre GL 5 (Task-12).
 * Fulfills:
 * - F-02: Valid actual coordinates, true_track heading rotation, no invalid markers
 * - F-06: Click to select aircraft
 * - NF-08: Visual clarity, responsive dark theme styling
 */

/**
 * Validates if an aircraft object has coordinates eligible for a map marker.
 *
 * @param {object|null} aircraft
 * @returns {boolean}
 */
export function canCreateMarker(aircraft) {
  if (!aircraft || typeof aircraft !== 'object') return false;
  const { longitude, latitude } = aircraft;
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return false;
  return longitude >= -180 && longitude <= 180 && latitude >= -90 && latitude <= 90;
}

/**
 * Extracts and normalizes true_track heading degree (0 to 360).
 *
 * @param {object|null} aircraft
 * @returns {number}
 */
export function getAircraftHeading(aircraft) {
  if (aircraft && Number.isFinite(aircraft.true_track)) {
    return ((aircraft.true_track % 360) + 360) % 360;
  }
  return 0;
}

/**
 * Returns trimmed callsign or falls back to icao24.
 *
 * @param {object|null} aircraft
 * @returns {string}
 */
export function getAircraftDisplayName(aircraft) {
  if (aircraft?.callsign && typeof aircraft.callsign === 'string' && aircraft.callsign.trim().length > 0) {
    return aircraft.callsign.trim();
  }
  return aircraft?.icao24 ? aircraft.icao24.toLowerCase() : '—';
}

/**
 * Creates a DOM element representing an aircraft marker.
 *
 * @param {object} aircraft
 * @param {boolean} isSelected
 * @param {Function} [onClick]
 * @returns {HTMLElement}
 */
export function createAirplaneMarkerElement(aircraft, isSelected = false, onClick) {
  const el = document.createElement('div');
  el.className = 'aircraft-marker-container group relative cursor-pointer select-none';
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
  el.setAttribute('aria-label', `Pesawat ${getAircraftDisplayName(aircraft)}`);

  const isOnGround = Boolean(aircraft.on_ground);
  const color = isSelected ? '#38bdf8' : isOnGround ? '#94a3b8' : '#2dd4bf';

  el.innerHTML = `
    <div class="aircraft-icon-wrapper transition-transform duration-300 ease-out hover:scale-125 ${
      isSelected ? 'scale-125' : ''
    }">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        width="${isSelected ? '28' : '22'}"
        height="${isSelected ? '28' : '22'}"
        fill="${color}"
        style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.8));"
      >
        <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
      </svg>
      ${
        isSelected
          ? '<span class="absolute -inset-1 rounded-full border border-sky-400 animate-ping opacity-60"></span>'
          : ''
      }
    </div>
    <div class="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-slate-900/90 px-1.5 py-0.5 text-[10px] font-medium text-slate-200 opacity-0 shadow border border-slate-700/80 transition-opacity group-hover:opacity-100">
      ${getAircraftDisplayName(aircraft)}
    </div>
  `;

  if (onClick) {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick(aircraft);
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        onClick(aircraft);
      }
    });
  }

  return el;
}

