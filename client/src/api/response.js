const ERRORS = {
  BAD_INPUT: 'Parameter permintaan tidak valid.',
  CONFIGURATION: 'Layanan data belum dikonfigurasi atau akses paket belum tersedia.',
  ACCESS_DENIED: 'Akses ke layanan data tidak diizinkan.',
  QUOTA: 'Batas permintaan tercapai. Silakan coba lagi nanti.',
  TIMEOUT: 'Permintaan data melewati batas waktu. Silakan coba lagi.',
  NETWORK: 'Tidak dapat menghubungi layanan data. Periksa koneksi Anda.',
  UNAVAILABLE: 'Layanan data sementara tidak tersedia.',
  INVALID_RESPONSE: 'Layanan data mengirim respons yang tidak valid.',
};

export class ApiError extends Error {
  constructor(code, { status = null, retryAt = null } = {}) {
    super(ERRORS[code]);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.retryAt = retryAt;
  }
}

export function parseRetryAfter(header, now) {
  if (!header?.trim()) return null;
  const value = header.trim();
  const time = /^\d+$/.test(value) ? now + Number(value) * 1000 : /^[A-Za-z]{3}, /.test(value) ? Date.parse(value) : NaN;
  return Number.isFinite(time) && time <= 8640000000000000 ? Math.max(time, now) : null;
}

export function errorCodeForStatus(status) {
  return { 400: 'BAD_INPUT', 403: 'ACCESS_DENIED', 429: 'QUOTA', 503: 'CONFIGURATION', 504: 'TIMEOUT' }[status] || 'UNAVAILABLE';
}

function hasValidFetchedAt(meta) {
  return (
    typeof meta.fetchedAt === 'string' &&
    /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(meta.fetchedAt) &&
    Number.isFinite(Date.parse(meta.fetchedAt))
  );
}

function validAirport(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return false;
  if (typeof record.name !== 'string' || !record.name.trim()) return false;
  if (!(record.iata === null || typeof record.iata === 'string')) return false;
  if (!(record.icao === null || typeof record.icao === 'string')) return false;
  if (typeof record.country !== 'string') return false;

  const latValid =
    record.latitude === null ||
    (typeof record.latitude === 'number' && Number.isFinite(record.latitude) && Math.abs(record.latitude) <= 90);
  const lngValid =
    record.longitude === null ||
    (typeof record.longitude === 'number' && Number.isFinite(record.longitude) && Math.abs(record.longitude) <= 180);

  return latValid && lngValid;
}

export function isValidEnvelope(body, kind = 'flights') {
  const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  if (!object(body) || Object.hasOwn(body, 'error') || !object(body.meta) || !hasValidFetchedAt(body.meta)) {
    return false;
  }

  if (kind === 'airports') {
    return (
      body.meta.source === 'airportsapi' &&
      Array.isArray(body.data) &&
      body.data.every(validAirport)
    );
  }

  const detail = kind === true || kind === 'flight';
  return (
    body.meta.source === 'opensky' &&
    Number.isInteger(body.meta.snapshotTime) &&
    body.meta.snapshotTime >= 0 &&
    (detail ? body.data === null || validAircraft(body.data) : Array.isArray(body.data) && body.data.every(validAircraft))
  );
}

function validAircraft(record) {
  if (
    !record ||
    typeof record !== 'object' ||
    Array.isArray(record) ||
    !/^[a-f\d]{6}$/.test(record.icao24) ||
    !(record.callsign === null || typeof record.callsign === 'string') ||
    typeof record.origin_country !== 'string' ||
    typeof record.on_ground !== 'boolean'
  )
    return false;
  const fields = ['time_position', 'last_contact', 'longitude', 'latitude', 'baro_altitude', 'velocity', 'true_track', 'vertical_rate', 'geo_altitude'];
  return (
    fields.every((field) => record[field] === null || (typeof record[field] === 'number' && Number.isFinite(record[field]))) &&
    (record.longitude === null || Math.abs(record.longitude) <= 180) &&
    (record.latitude === null || Math.abs(record.latitude) <= 90)
  );
}