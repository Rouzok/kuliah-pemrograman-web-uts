import { useEffect, useState } from 'react';

const action = 'min-h-9 rounded border border-company-accent/40 px-3 py-1 text-company-caption text-company-control-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-company-accent disabled:opacity-40';
export default function GlobeAircraftControls({ aircraft, activeId, selected, onSelect, onHover, onFocus, paused, onPause, status, onRetry }) {
  const [clock, setClock] = useState(Date.now);
  useEffect(() => {
    if (!status.error?.retryAt) return;
    const timer = setTimeout(() => setClock(Date.now()), Math.max(0, status.error.retryAt - Date.now()));
    return () => clearTimeout(timer);
  }, [status.error]);
  const active = aircraft.find((state) => state.icao24 === activeId);
  const text = (value) => (value == null ? '—' : value);
  const retryAt = status.error?.retryAt;
  return (
    <section
      aria-label="Live OpenSky aircraft"
      className="absolute bottom-8 left-1/2 z-10 w-[min(92%,340px)] -translate-x-1/2 rounded-md border border-company-accent/20 bg-company-globe/95 p-3 text-company-caption text-company-muted"
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          onFocus(false);
          onHover(null);
        }
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <strong className="text-company-detail-text">OpenSky · {aircraft.length} aircraft</strong>
        <button className={action} onClick={onPause} aria-pressed={paused}>
          {paused ? 'Resume rotation' : 'Pause rotation'}
        </button>
      </div>
      <p className="my-2" role="status">
        {status.pending
          ? 'Updating observations…'
          : status.error
            ? 'Updates paused. Previous observations may be stale.'
            : status.meta
              ? aircraft.length
                ? 'Reported positions · updates every 30 seconds'
                : 'No visible airborne aircraft in this coverage.'
              : 'Loading aircraft coverage…'}
      </p>
      {!status.webgl && <p className="my-2 text-amber-200">3D view unavailable. Aircraft controls remain available.</p>}
      {status.meta && (
        <p className="my-1" title={status.meta.fetchedAt}>
          Retrieved: {new Date(status.meta.fetchedAt).toISOString().slice(11, 19)} UTC
        </p>
      )}
      {status.error && (
        <div role="alert" className="my-2 text-amber-200">
          <p>{status.error.message}</p>
          {retryAt > clock && <p>Retry after {new Date(retryAt).toISOString()}.</p>}
          <button className={`${action} mt-2`} disabled={retryAt > clock || status.pending} onClick={onRetry}>
            Retry coverage
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-1.5" aria-label="Aircraft selector">
        {aircraft.map((state) => (
          <button
            key={state.icao24}
            className={action}
            aria-pressed={selected === state.icao24}
            onMouseEnter={() => onHover(state.icao24)}
            onMouseLeave={() => onHover(null)}
            onFocus={() => {
              onFocus(true);
              onHover(state.icao24);
            }}
            onBlur={() => {
              onFocus(false);
              onHover(null);
            }}
            onClick={() => onSelect(selected === state.icao24 ? null : state.icao24)}
          >
            {state.callsign || state.icao24}
          </button>
        ))}
      </div>
      {active && (
        <div className="absolute bottom-full left-0 mb-2 max-h-36 w-full overflow-y-auto rounded-md border border-company-accent/30 bg-company-globe/98 p-3 shadow-lg" aria-label="Aircraft details">
          <div className="flex items-center justify-between">
            <strong className="text-company-detail-text">{active.callsign || active.icao24}</strong>
            <button
              className={action}
              onClick={() => {
                onSelect(null);
                onHover(null);
              }}
            >
              Close
            </button>
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
            {[
              ['ICAO24', active.icao24],
              ['Country', active.origin_country],
              ['Altitude (ft)', active.baro_altitude == null ? null : Math.round(active.baro_altitude / 0.3048)],
              ['Ground speed (kt)', active.velocity == null ? null : Math.round((active.velocity * 3600) / 1852)],
              ['Position observed (UTC)', active.time_position == null ? null : new Date(active.time_position * 1000).toISOString()],
            ].map(([label, value]) => (
              <div key={label} className="break-words">
                <dt>{label}</dt>
                <dd className="text-company-detail-text">{text(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      <p className="mt-2 mb-0 text-company-meta">Schematic globe · demo airport · shared OpenSky credits</p>
    </section>
  );
}
