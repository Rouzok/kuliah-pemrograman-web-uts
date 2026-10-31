import { useState } from 'react';
import { saveFlight, removeFlight, isFlightSaved } from '../utils/storage';

export default function FlightItem({ flight, onSelect }) {
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(() => { try { return isFlightSaved(flight.id); } catch { return false; } });
  const legacy = flight.identifierType !== 'icao24';
  function toggle(event) {
    event.stopPropagation();
    try {
      if (saved) removeFlight(flight.id);
      else saveFlight(flight);
      setSaved(!saved);
      setError(null);
    } catch (failure) { setError(failure.message); }
  }
  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-800/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h4 className="break-all text-sm font-semibold text-slate-200">{flight.callsign || flight.code || flight.flight_iata || flight.flight_icao || flight.id}</h4>
          <p className="text-xs text-slate-400">{legacy ? 'Legacy bookmark: simpan ulang dari data OpenSky.' : `ICAO24: ${flight.code}`}</p>
        </div>
        <div className="flex gap-2">
          {onSelect && <button onClick={() => onSelect(flight)} className="rounded-md bg-sky-600 px-3 py-2 text-xs text-white focus-visible:outline-2">Open</button>}
          <button onClick={toggle} disabled={legacy && !saved} aria-label={saved ? 'Remove saved aircraft' : 'Save aircraft'}
            className="rounded-md px-3 py-2 text-xs text-teal-300 focus-visible:outline-2 disabled:opacity-50">
            {saved ? 'Remove' : 'Save'}
          </button>
        </div>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-amber-300">{error}</p>}
    </div>
  );
}
