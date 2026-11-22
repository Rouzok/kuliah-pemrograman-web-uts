import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { getAirports } from '../api/client.js';

function hasValidCoords(airport) {
  const lat = airport?.latitude;
  const lng = airport?.longitude;
  return (
    typeof lat === 'number' &&
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    typeof lng === 'number' &&
    Number.isFinite(lng) &&
    lng >= -180 &&
    lng <= 180
  );
}

export default function Airports() {
  const outletContext = useOutletContext() ?? {};
  const {
    selectedAirport,
    onLocateAirport,
    setSelectedIcao24,
  } = outletContext;

  const [airports, setAirports] = useState([]);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isStale, setIsStale] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState('');

  useEffect(() => {
    if (typeof setSelectedIcao24 === 'function') {
      setSelectedIcao24(null);
    }
  }, [setSelectedIcao24]);

  const loadAirports = useCallback(async (signal) => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await getAirports({}, { signal });
      if (signal?.aborted) return;
      const list = Array.isArray(res?.data) ? res.data : [];
      setAirports(list);
      setFetchedAt(res?.meta?.fetchedAt ?? new Date().toISOString());
      setIsStale(false);
    } catch (err) {
      if (err?.name === 'AbortError' || signal?.aborted) return;
      setErrorMsg(err?.message || 'Gagal memuat daftar bandara.');
      setIsStale(true);
    } finally {
      if (!signal?.aborted) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadAirports(controller.signal);
    return () => controller.abort();
  }, [loadAirports]);

  const countries = useMemo(() => {
    const set = new Set();
    for (const item of airports) {
      if (typeof item?.country === 'string' && item.country.trim()) {
        set.add(item.country.trim());
      }
    }
    return [...set].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [airports]);

  const filteredAirports = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return airports
      .filter((item) => {
        if (selectedCountry && item.country !== selectedCountry) {
          return false;
        }
        if (!q) return true;
        const nameMatch = typeof item.name === 'string' && item.name.toLowerCase().includes(q);
        const iataMatch = typeof item.iata === 'string' && item.iata.toLowerCase().includes(q);
        const icaoMatch = typeof item.icao === 'string' && item.icao.toLowerCase().includes(q);
        return nameMatch || iataMatch || icaoMatch;
      })
      .sort((a, b) => {
        const aName = typeof a?.name === 'string' && a.name.trim() ? a.name.trim() : null;
        const bName = typeof b?.name === 'string' && b.name.trim() ? b.name.trim() : null;
        if (!aName && !bName) return 0;
        if (!aName) return 1;
        if (!bName) return -1;
        return aName.localeCompare(bName, undefined, { sensitivity: 'base' });
      });
  }, [airports, searchQuery, selectedCountry]);

  const hasActiveFilter = Boolean(searchQuery.trim() || selectedCountry);
  const hasExistingData = airports.length > 0;

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCountry('');
  };

  return (
    <div className="flex h-full flex-col bg-slate-900/95 text-slate-100">
      <div className="border-b border-slate-800 p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-base font-semibold text-white">Direktori Bandara</h1>
            <p className="text-xs text-slate-400">
              {isLoading && !hasExistingData
                ? 'Memuat data bandara…'
                : `${filteredAirports.length} cocok dari ${airports.length} bandara termuat`}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500">
              Cakupan sesuai data yang dikembalikan server dari AirportsAPI (bukan total global penuh).
              {fetchedAt ? ` Diambil: ${fetchedAt}` : ''}
            </p>
          </div>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="shrink-0 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-slate-700 hover:text-white transition"
            >
              Reset
            </button>
          )}
        </div>

        <div className="space-y-2">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama, IATA, atau ICAO…"
              aria-label="Cari bandara"
              className="w-full rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-1.5 pr-8 text-xs text-slate-100 placeholder-slate-500 focus:border-teal-400 focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Hapus pencarian bandara"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            )}
          </div>

          <select
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            aria-label="Filter negara"
            className="w-full rounded-lg border border-slate-700/80 bg-slate-950/80 px-3 py-1.5 text-xs text-slate-100 focus:border-teal-400 focus:outline-none"
          >
            <option value="">Semua Negara</option>
            {countries.map((country) => (
              <option key={country} value={country}>
                {country}
              </option>
            ))}
          </select>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="rounded-lg border border-red-900/60 bg-red-950/40 p-2.5 text-xs text-red-200 space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span>
                {errorMsg}
                {isStale && hasExistingData ? ' Menampilkan data tersimpan (stale).' : ''}
              </span>
              <button
                type="button"
                onClick={() => loadAirports()}
                disabled={isLoading}
                className="shrink-0 rounded bg-red-600/80 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-red-500 disabled:opacity-50 transition"
              >
                {isLoading ? 'Memuat…' : 'Coba Lagi'}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-auto p-3">
        {isLoading && !hasExistingData ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-6 text-center text-xs text-slate-400">
            Sedang memuat daftar bandara…
          </div>
        ) : !hasExistingData && errorMsg ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-6 text-center text-xs text-slate-400">
            Data bandara belum tersedia. Gunakan tombol Coba Lagi di atas untuk memuat ulang.
          </div>
        ) : filteredAirports.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-6 text-center text-xs text-slate-400 space-y-2">
            <p>
              {hasActiveFilter
                ? 'Tidak ada bandara yang cocok dengan pencarian atau filter negara saat ini.'
                : 'Direktori bandara kosong.'}
            </p>
            {hasActiveFilter && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-700 transition"
              >
                Bersihkan Filter
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-auto max-h-full rounded-lg border border-slate-800">
            <table className="w-full text-left border-collapse text-xs text-slate-300">
              <thead className="sticky top-0 z-10 bg-slate-900/95 backdrop-blur border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="p-2 font-semibold">Bandara</th>
                  <th className="p-2 font-semibold">IATA</th>
                  <th className="p-2 font-semibold">ICAO</th>
                  <th className="p-2 font-semibold">Negara</th>
                  <th className="p-2 font-semibold">Koordinat</th>
                  <th className="p-2 font-semibold text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredAirports.map((airport, idx) => {
                  const locatable = hasValidCoords(airport);
                  const isActive =
                    selectedAirport &&
                    selectedAirport.id &&
                    airport.id &&
                    selectedAirport.id === airport.id;
                  const displayName =
                    typeof airport?.name === 'string' && airport.name.trim()
                      ? airport.name.trim()
                      : 'Unknown';
                  const displayIata = airport?.iata || '—';
                  const displayIcao = airport?.icao || '—';
                  const displayCountry =
                    typeof airport?.country === 'string' && airport.country.trim()
                      ? airport.country.trim()
                      : 'Unknown';
                  const coordReason = 'Koordinat tidak tersedia atau tidak valid';

                  return (
                    <tr
                      key={airport.id || `${displayName}-${idx}`}
                      className={`transition-colors ${
                        isActive ? 'bg-teal-950/30' : 'hover:bg-slate-800/50'
                      }`}
                    >
                      <td className="p-2 font-medium text-slate-100">
                        {displayName}
                      </td>
                      <td className="p-2 font-mono text-teal-300">
                        {displayIata}
                      </td>
                      <td className="p-2 font-mono text-slate-300">
                        {displayIcao}
                      </td>
                      <td className="p-2 text-slate-400">
                        {displayCountry}
                      </td>
                      <td className="p-2 font-mono text-[11px] text-slate-400">
                        {locatable
                          ? `${airport.latitude.toFixed(3)}, ${airport.longitude.toFixed(3)}`
                          : coordReason}
                      </td>
                      <td className="p-2 text-right">
                        <button
                          type="button"
                          disabled={!locatable || typeof onLocateAirport !== 'function'}
                          onClick={() => locatable && onLocateAirport?.(airport)}
                          aria-label={
                            locatable
                              ? `Locate ${displayName}`
                              : `Locate ${displayName} tidak tersedia: ${coordReason}`
                          }
                          title={
                            locatable
                              ? `Pusatkan peta ke ${displayName}`
                              : coordReason
                          }
                          className="rounded-md border border-teal-500/40 bg-teal-500/15 px-2.5 py-1 text-[11px] font-medium text-teal-200 hover:bg-teal-500/25 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900 disabled:text-slate-500 focus-visible:outline-2 focus-visible:outline-teal-400 transition"
                        >
                          Locate
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}