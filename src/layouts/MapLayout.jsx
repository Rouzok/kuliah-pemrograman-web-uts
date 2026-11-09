import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import FlightMap from '../components/map/FlightMap';
import { useFlightUpdates } from '../components/map/useFlightUpdates';

/**
 * MapLayout (Task-12, Task-13)
 *
 * Requirements fulfilled:
 * - F-02: Map display with active markers and heading rotation
 * - F-03: 30-second automatic update loop, pause offline/hidden, explicit retry
 * - F-06: Selection centers valid coordinates
 * - F-07: Escape key, close button, or route switch clears selection
 * - NF-05: Single source of live viewport records, no redundant ticks
 */
export default function MapLayout() {
  const [mapInstance, setMapInstance] = useState(null);
  const [selectedIcao24, setSelectedIcao24] = useState(null);
  const location = useLocation();
  const navigate = useNavigate();

  // 30-second live update loop
  const { flights, meta, isPending, isStale, error, refresh } = useFlightUpdates({
    mapInstance,
    enabled: true,
  });

  // Select aircraft and center map on valid coordinates (F-06)
  const handleSelectFlight = (aircraft) => {
    if (aircraft?.icao24) {
      setSelectedIcao24(aircraft.icao24);
      if (location.pathname !== '/map' && location.pathname !== '/map/') {
        navigate('/map');
      }
      if (
        mapInstance &&
        Number.isFinite(aircraft.longitude) &&
        Number.isFinite(aircraft.latitude)
      ) {
        mapInstance.flyTo({
          center: [aircraft.longitude, aircraft.latitude],
          essential: true,
          speed: 1.2,
        });
      }
    }
  };

  // Navigating away from /map (e.g. to /map/airports or /map/saved) clears flight selection (F-06, F-07)
  useEffect(() => {
    const isFlightRoute = location.pathname === '/map' || location.pathname === '/map/';
    if (!isFlightRoute) {
      setSelectedIcao24(null);
    }
  }, [location.pathname]);

  // Deselect on Escape (F-07)
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setSelectedIcao24(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const outletContext = {
    flights,
    meta,
    isPending,
    isStale,
    error,
    refresh,
    selectedIcao24,
    setSelectedIcao24,
    onSelectFlight: handleSelectFlight,
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-slate-900">
      {/* LAYER 1: Full-screen Interactive Map with Markers */}
      <main className="absolute inset-0 z-0 bg-slate-950">
        <FlightMap
          flights={flights}
          selectedIcao24={selectedIcao24}
          onSelectFlight={handleSelectFlight}
          onMapReady={setMapInstance}
        />
      </main>

      {/* Status Overlay Widget (Top-Right under controls) */}
      <div className="absolute right-14 top-4 z-10 flex items-center gap-2 pointer-events-auto">
        <div className="flex items-center gap-2.5 rounded-xl border border-slate-800/90 bg-slate-900/95 px-3 py-1.5 shadow-2xl backdrop-blur-md text-xs text-slate-300">
          <span
            className={`h-2 w-2 rounded-full ${
              isPending
                ? 'bg-amber-400 animate-pulse'
                : error || isStale
                ? 'bg-red-400'
                : 'bg-teal-400 animate-pulse'
            }`}
          />
          <span className="font-medium text-slate-200">
            {flights.length} Pesawat
          </span>
          {error ? (
            <span className="text-red-400 font-semibold">(Error)</span>
          ) : isStale ? (
            <span className="text-amber-400 font-semibold">(Stale)</span>
          ) : null}
          <button
            type="button"
            onClick={() => refresh(true)}
            disabled={isPending}
            className="ml-1 rounded bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-teal-300 hover:bg-slate-700 hover:text-teal-200 disabled:opacity-50 transition"
            title="Perbarui data penerbangan sekarang"
          >
            {isPending ? 'Memuat…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* LAYER 2: Floating Sidebar */}
      <div className="absolute left-0 top-0 z-10 h-full pointer-events-none">
        <div className="h-full pointer-events-auto">
          <Sidebar outletContext={outletContext} />
        </div>
      </div>
    </div>
  );
}
