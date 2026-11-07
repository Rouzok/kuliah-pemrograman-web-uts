import React, { useRef, useState, useEffect } from 'react';
import { metersToFeet, metersPerSecondToKnots, groundState } from '../../utils/aircraft.js';
import { isFlightSaved, saveFlight, removeFlight } from '../../utils/storage.js';

/**
 * Resolves aircraft record from the current viewport snapshot or retained last-known record.
 * Fulfills Task-14:
 * - Details from selected viewport record with OpenSky formatting/timestamps
 * - No per-tick enrichment / redundant network calls (NF-05)
 * - Stale summary retained when aircraft leaves snapshot
 */
export function resolveAircraftDetails(icao24, flights = [], lastKnownAircraft = null) {
  if (!icao24) return { aircraft: null, isMissingFromSnapshot: true };
  const normalized = icao24.trim().toLowerCase();
  const current = flights.find((f) => f.icao24 && f.icao24.toLowerCase() === normalized);

  if (current) {
    return { aircraft: current, isMissingFromSnapshot: false };
  }
  if (lastKnownAircraft && lastKnownAircraft.icao24 && lastKnownAircraft.icao24.toLowerCase() === normalized) {
    return { aircraft: lastKnownAircraft, isMissingFromSnapshot: true };
  }
  return { aircraft: null, isMissingFromSnapshot: true };
}

export default function FlightDetailPanel({
  icao24,
  flights = [],
  meta = null,
  isStale = false,
  onClose,
}) {
  const lastKnownRef = useRef(null);
  const [isSaved, setIsSaved] = useState(false);
  const closeButtonRef = useRef(null);

  const { aircraft: data, isMissingFromSnapshot } = resolveAircraftDetails(
    icao24,
    flights,
    lastKnownRef.current
  );

  // Update last known reference when current snapshot has the aircraft
  if (data && !isMissingFromSnapshot) {
    lastKnownRef.current = data;
  }

  // Check saved/bookmarked status
  const bookmarkId = icao24 ? `icao24:${icao24.toLowerCase()}` : '';
  useEffect(() => {
    if (bookmarkId) {
      setIsSaved(isFlightSaved(bookmarkId));
    }
  }, [bookmarkId]);

  // Focus close button on mount for accessibility (NF-04)
  useEffect(() => {
    closeButtonRef.current?.focus();
  }, [icao24]);

  const handleToggleBookmark = () => {
    if (!data && !icao24) return;
    try {
      if (isSaved) {
        removeFlight(bookmarkId);
        setIsSaved(false);
      } else {
        saveFlight({
          icao24: icao24.toLowerCase(),
          callsign: data?.callsign || undefined,
        });
        setIsSaved(true);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const text = (val) => (typeof val === 'string' || typeof val === 'number' ? val : '—');
  const code = icao24?.trim().toLowerCase() || '—';
  const callsign = data?.callsign ? data.callsign.trim() : null;

  return (
    <section
      aria-labelledby="selected-flight-heading"
      className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/90 p-4 text-sm text-slate-300 shadow-xl backdrop-blur-md"
    >
      {/* Header with Callsign/ICAO24, Bookmark, and Close */}
      <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 id="selected-flight-heading" className="text-lg font-bold text-teal-300">
              {callsign || code}
            </h2>
            {callsign && (
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[11px] font-mono text-slate-400">
                {code}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">{data?.origin_country || 'Asal tidak diketahui'}</p>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Bookmark Button (F-12) */}
          <button
            type="button"
            onClick={handleToggleBookmark}
            aria-label={isSaved ? 'Hapus bookmark pesawat' : 'Simpan bookmark pesawat'}
            className={`rounded-lg p-2 transition ${
              isSaved
                ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
            title={isSaved ? 'Tersimpan di Saved Aircraft' : 'Simpan ke Saved Aircraft'}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              fill={isSaved ? 'currentColor' : 'none'}
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
            </svg>
          </button>

          {/* Close Button (F-07) */}
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="Tutup detail penerbangan"
            className="rounded-lg bg-slate-800 p-2 text-slate-400 hover:bg-slate-700 hover:text-white transition"
            title="Tutup (Escape)"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256">
              <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Snapshot / Stale Status Alert */}
      {(isMissingFromSnapshot || isStale) && (
        <div role="status" className="rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-300 border border-amber-500/20">
          {isMissingFromSnapshot
            ? 'Pesawat saat ini di luar jangkauan snapshot terbaru. Ringkasan data terakhir tetap ditampilkan.'
            : 'Data koneksi usang; pembaruan radar otomatis dijeda.'}
        </div>
      )}

      {/* Detailed Measurements */}
      {data ? (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
          <div>
            <dt className="text-slate-500">Status Penyedia</dt>
            <dd className="font-medium text-slate-200">{groundState(data.on_ground)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Arah Terbang (Heading)</dt>
            <dd className="font-medium text-slate-200">{data.true_track !== null && data.true_track !== undefined ? `${data.true_track}°` : '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Ketinggian Barometrik</dt>
            <dd className="font-medium text-slate-200">{text(metersToFeet(data.baro_altitude))} ft</dd>
          </div>
          <div>
            <dt className="text-slate-500">Ketinggian Geometrik</dt>
            <dd className="font-medium text-slate-200">{text(metersToFeet(data.geo_altitude))} ft</dd>
          </div>
          <div>
            <dt className="text-slate-500">Kecepatan Darat</dt>
            <dd className="font-medium text-slate-200">{text(metersPerSecondToKnots(data.velocity))} kt</dd>
          </div>
          <div>
            <dt className="text-slate-500">Kecepatan Vertikal</dt>
            <dd className="font-medium text-slate-200">{data.vertical_rate !== null && data.vertical_rate !== undefined ? `${data.vertical_rate} m/s` : '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Latitude</dt>
            <dd className="font-mono text-slate-200">{text(data.latitude)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Longitude</dt>
            <dd className="font-mono text-slate-200">{text(data.longitude)}</dd>
          </div>
          <div className="col-span-2 border-t border-slate-800/80 pt-2 text-[11px]">
            <dt className="text-slate-500">Waktu Observasi Posisi (UTC)</dt>
            <dd className="font-mono text-slate-300">
              {data.time_position ? new Date(data.time_position * 1000).toISOString() : '—'}
            </dd>
          </div>
          <div className="col-span-2 text-[11px]">
            <dt className="text-slate-500">Kontak Terakhir (UTC)</dt>
            <dd className="font-mono text-slate-300">
              {data.last_contact ? new Date(data.last_contact * 1000).toISOString() : '—'}
            </dd>
          </div>
          {meta?.fetchedAt && (
            <div className="col-span-2 text-[11px]">
              <dt className="text-slate-500">Diambil dari Radar (UTC)</dt>
              <dd className="font-mono text-slate-300">{new Date(meta.fetchedAt).toISOString()}</dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="text-xs text-slate-400">
          Data rincian untuk pesawat {code} tidak tersedia di snapshot radar saat ini.
        </p>
      )}

      {/* Mandatory Disclaimer (F-16) */}
      <p className="border-t border-slate-800/80 pt-2 text-[10px] text-slate-500">
        Status Ground adalah laporan penyedia sensor OpenSky, bukan konfirmasi tiba di tujuan.
      </p>
    </section>
  );
}
