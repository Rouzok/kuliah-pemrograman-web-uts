import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getFlight } from '../api/client.js';
import { metersToFeet, metersPerSecondToKnots, groundState } from '../utils/aircraft.js';

const buttonClass = 'rounded-md bg-slate-700 px-3 py-2 text-sm text-white hover:bg-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-300 disabled:cursor-not-allowed disabled:opacity-50';

export default function Flights() {
  const location = useLocation();
  // A new navigation gets its own lifecycle, including repeated Open of the same code.
  return <SavedFlightLookup key={location.key} intent={location.state?.openSavedFlight} />;
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
