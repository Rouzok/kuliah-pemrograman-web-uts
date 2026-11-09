import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import { getFlight } from '../api/client.js';
import { metersToFeet, metersPerSecondToKnots, groundState } from '../utils/aircraft.js';
import FlightDetailPanel from '../components/map/FlightDetailPanel.jsx';

// === BAGIAN PENAMBAHAN TASK-10 (1): Impor Komponen FlightFilters ===
import FlightFilters from '../components/FlightFilters.jsx';

// === BAGIAN PENAMBAHAN TASK-09 (1): Impor Komponen FlightTable ===
import FlightTable from '../components/FlightTable.jsx';

// === BAGIAN PENAMBAHAN TASK-11 (1): Impor Komponen FlightColumnToggle ===
import FlightColumnToggle from '../components/FlightColumnToggle.jsx';

const buttonClass = 'rounded-md bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300 disabled:cursor-not-allowed disabled:opacity-50';

export default function Flights() {
  const location = useLocation();
  const outletContext = useOutletContext() || {};
  const {
    selectedIcao24,
    setSelectedIcao24,
    flights = [],
    meta,
    isPending = false,
    isStale = false,
    error = null,
    refresh,
    onSelectFlight,
  } = outletContext;

  const [clock, setClock] = useState(() => Date.now());

  // === BAGIAN PENAMBAHAN TASK-10 (2): State untuk Search Query & Status Filter ===
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // === BAGIAN PENAMBAHAN TASK-11 (2): State untuk Sembunyikan/Tampilkan Kolom Opsional ===
  const [visibleColumns, setVisibleColumns] = useState({});

  // Cooldown timer if error has retryAt (F-15)
  useEffect(() => {
    const retryAt = error?.retryAt;
    if (!retryAt || retryAt <= Date.now()) return;
    const timer = setTimeout(() => setClock(Date.now()), Math.min(retryAt - Date.now(), 2147483647));
    return () => clearTimeout(timer);
  }, [error, clock]);

  const isWaitingCooldown = Boolean(error?.retryAt && error.retryAt > clock);

  const hasSavedIntent = Boolean(location.state?.openSavedFlight);

  // A new navigation gets its own lifecycle, including repeated Open of the same code.
  if (hasSavedIntent) {
    return <SavedFlightLookup key={location.key} intent={location.state?.openSavedFlight} />;
  }

  const handleRetry = () => {
    setClock(Date.now());
    refresh?.(true);
  };

  // Task-14 & Task-21: If an aircraft is selected, render FlightDetailPanel with recovery support
  if (selectedIcao24) {
    return (
      <FlightDetailPanel
        icao24={selectedIcao24}
        flights={flights}
        meta={meta}
        isPending={isPending}
        isStale={isStale}
        error={error}
        onRefresh={handleRetry}
        onClose={() => setSelectedIcao24?.(null)}
      />
    );
  }

  // === BAGIAN PENAMBAHAN TASK-10 (3): Logika Filtering Data Berdasarkan Pencarian & Status ===
  const filteredFlights = flights.filter((flight) => {
    const query = searchQuery.toLowerCase().trim();
    const callsign = (flight.callsign || '').toLowerCase();
    const icao24 = (flight.icao24 || '').toLowerCase();
    const country = (flight.origin_country || '').toLowerCase();

    // Cek kecocokan search query pada callsign, icao24, atau negara
    const matchesSearch = !query || callsign.includes(query) || icao24.includes(query) || country.includes(query);

    if (!matchesSearch) return false;

    // Cek filter status (All / Airborne / Ground)
    if (statusFilter === 'airborne') return !flight.on_ground;
    if (statusFilter === 'ground') return flight.on_ground;
    return true; // 'all'
  });

  // Task-13 & Task-21: When no flight is selected, show list of aircraft in current viewport with recovery states
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-teal-300">Radar Viewport</h2>
        <p className="text-xs text-slate-400">
          Pilih pesawat dari daftar di bawah atau klik marker pada peta untuk melihat telemetri.
        </p>
      </div>

      {/* Error & Stale Alert Banner (F-03, F-15) */}
      {error && (
        <div role="alert" className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <div className="flex items-start gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 256 256" className="mt-0.5 flex-shrink-0 text-amber-400">
              <path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm-8-80V80a88,88,0,1,1,16,0v56a8,8,0,0,1-16,0Zm20,36a12,12,0,1,1-12-12A12,12,0,0,1,140,172Z" />
            </svg>
            <div className="space-y-1">
              <p className="font-medium text-amber-300">
                Pembaruan radar otomatis dijeda: {error.message || 'Koneksi gagal'}
              </p>
              {flights.length > 0 && (
                <p className="text-[11px] text-amber-400/90">
                  Data pengamatan sebelumnya tetap ditampilkan (Stale).
                </p>
              )}
              {isWaitingCooldown && (
                <p className="text-[11px] text-amber-300">
                  Batas frekuensi aktif. Coba lagi setelah {new Date(error.retryAt).toISOString().slice(11, 19)} UTC.
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={handleRetry}
            disabled={isPending || isWaitingCooldown}
            className="w-full rounded bg-amber-500/20 py-1.5 text-center text-xs font-medium text-amber-300 hover:bg-amber-500/30 disabled:opacity-50 transition"
          >
            {isPending ? 'Mencoba kembali…' : 'Coba Lagi'}
          </button>
        </div>
      )}

      {/* === BAGIAN PENAMBAHAN TASK-10 (4): Render Komponen FlightFilters di dalam Return === */}
      <FlightFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        totalCount={filteredFlights.length}
      />

      {/* === BAGIAN PENAMBAHAN TASK-11 (3): Render Komponen FlightColumnToggle === */}
      <FlightColumnToggle
        visibleColumns={visibleColumns}
        setVisibleColumns={setVisibleColumns}
      />

      {/* Empty State vs FlightTable (Task-09 & Task-10 & Task-11) */}
      {filteredFlights.length === 0 ? (
        <div className="rounded-lg border border-slate-800 bg-slate-900/50 p-4 text-center text-xs text-slate-400 space-y-2">
          <p>
            {searchQuery || statusFilter !== 'all'
              ? 'Tidak ada pesawat yang cocok dengan kriteria pencarian atau filter.'
              : error
              ? 'Data penerbangan tidak dapat dimuat saat ini.'
              : 'Pesawat saat ini tidak terpantau di area ini. Ini tidak berarti pesawat telah mendarat.'}
          </p>
          <p className="text-[11px] text-slate-500">
            Geser atau perbesar peta untuk memindai area lain.
          </p>
          {!error && !searchQuery && statusFilter === 'all' && (
            <button
              type="button"
              onClick={handleRetry}
              disabled={isPending}
              className="mt-1 rounded bg-slate-800 px-3 py-1 text-xs text-teal-300 hover:bg-slate-700 disabled:opacity-50 transition"
            >
              {isPending ? 'Memindai…' : 'Pindai Ulang Radar'}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>
              {filteredFlights.length} Pesawat Aktif {isStale && <span className="text-amber-400 font-medium">(Stale)</span>}
            </span>
            <span className="text-[11px] text-slate-500 font-mono">Tabel Telemetri</span>
          </div>

          {/* === BAGIAN PENAMBAHAN TASK-09 & TASK-11 (4): Render Komponen FlightTable dengan visibleColumns === */}
          <FlightTable
            flights={filteredFlights}
            onSelectFlight={(flight) => {
              if (onSelectFlight) {
                onSelectFlight(flight);
              } else if (setSelectedIcao24) {
                setSelectedIcao24(flight.icao24);
              }
            }}
            savedIds={outletContext.savedIds || []}
            onToggleSave={outletContext.onToggleSave}
            visibleColumns={visibleColumns}
          />
        </div>
      )}
    </div>
  );
}

function SavedFlightLookup({ intent }) {
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState({ status: intent ? 'pending' : 'idle', envelope: null, error: null });
  const [clock, setClock] = useState(() => Date.now());
  const closeButton = useRef(null);
  const hasIntent = Boolean(intent);
  const code = intent?.code;
  const identifierType = intent?.identifierType;
  const close = () => navigate('/map', { replace: true, state: null });

  useEffect(() => {
    if (!hasIntent) return;
    const controller = new AbortController();
    setResult((previous) => ({ ...previous, status: 'pending', error: null }));

    async function load() {
      try {
        const envelope = await getFlight({ [identifierType]: code }, { signal: controller.signal });
        if (!controller.signal.aborted) {
          setResult({ status: envelope.data === null ? 'empty' : 'success', envelope, error: null });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setClock(Date.now());
          setResult((previous) => ({ ...previous, status: 'error', error }));
        }
      }
    }
    load();
    return () => controller.abort();
  }, [hasIntent, code, identifierType, attempt]);

  useEffect(() => {
    const retryAt = result.error?.retryAt;
    if (!retryAt || retryAt <= Date.now()) return;
    const timer = setTimeout(() => setClock(Date.now()), Math.min(retryAt - Date.now(), 2147483647));
    return () => clearTimeout(timer);
  }, [result.error, clock]);

  useEffect(() => {
    if (!hasIntent) return;
    closeButton.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        navigate('/map', { replace: true, state: null });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hasIntent, navigate]);

  if (!hasIntent) return <p className="text-sm text-slate-400">Pilih pesawat untuk melihat detail. Live Map masih dalam pengembangan.</p>;

  const data = result.envelope?.data;
  const waiting = result.error?.retryAt > clock;
  const retry = () => {
    setClock(Date.now());
    setAttempt((value) => value + 1);
  };
  const text = (value) => (typeof value === 'string' || typeof value === 'number' ? value : '—');

  return (
    <section aria-labelledby="saved-flight-heading" className="space-y-4 text-sm text-slate-300">
      <div className="flex items-start justify-between gap-3">
        <h1 id="saved-flight-heading" className="break-all text-lg font-semibold text-teal-300">
          {typeof code === 'string' ? code.trim().toLowerCase() : 'Pesawat tersimpan'}
        </h1>
        <button ref={closeButton} onClick={close} className={buttonClass} aria-label="Tutup detail penerbangan">
          Tutup
        </button>
      </div>

      <div role="status" aria-live="polite">
        {result.status === 'pending' && <p>Memuat penerbangan terkini…</p>}
        {result.status === 'empty' && <p>Pesawat saat ini tidak terpantau. Ini tidak berarti pesawat telah mendarat. Bookmark tetap tersimpan.</p>}
      </div>

      {result.status === 'error' && (
        <div role="alert" className="space-y-2 text-amber-300">
          <p>{result.error.message}</p>
          <p>Bookmark tetap tersimpan.</p>
          {data && <p>Data sebelumnya ditampilkan; data mungkin sudah kedaluwarsa.</p>}
          {waiting && <p>Coba lagi setelah {new Date(result.error.retryAt).toISOString().slice(11, 19)} UTC.</p>}
        </div>
      )}

      {data && (
        <dl className="space-y-2">
          <div>
            <dt className="text-slate-500">Callsign / ICAO24</dt>
            <dd>{text(data.callsign || data.icao24)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Status penyedia</dt>
            <dd>{groundState(data.on_ground)}</dd>
          </div>
          {[
            ['Negara', data.origin_country], ['Latitude', data.latitude], ['Longitude', data.longitude],
            ['Ketinggian barometrik (ft)', metersToFeet(data.baro_altitude)],
            ['Ketinggian geometrik (ft)', metersToFeet(data.geo_altitude)],
            ['Ground speed (kt)', metersPerSecondToKnots(data.velocity)], ['Heading (°)', data.true_track],
            ['Vertical rate (m/s)', data.vertical_rate],
            ['Position observed (UTC)', data.time_position === null ? null : new Date(data.time_position * 1000).toISOString()],
            ['Last contact (UTC)', data.last_contact === null ? null : new Date(data.last_contact * 1000).toISOString()],
            ['Snapshot (UTC)', new Date(result.envelope.meta.snapshotTime * 1000).toISOString()],
          ].map(([label, value]) => <div key={label}><dt className="text-slate-500">{label}</dt><dd>{text(value)}</dd></div>)}
          <p>Ground adalah laporan penyedia, bukan konfirmasi tiba di tujuan.</p>
          <div>
            <dt className="text-slate-500">Data diambil (UTC)</dt>
            <dd>{new Date(result.envelope.meta.fetchedAt).toISOString()}</dd>
          </div>
        </dl>
      )}

      {result.status !== 'pending' && (
        <button onClick={retry} disabled={waiting} className={buttonClass}>
          {result.status === 'success' ? 'Refresh' : 'Coba lagi'}
        </button>
      )}
    </section>
  );
}