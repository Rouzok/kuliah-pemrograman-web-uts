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

export function isValidEnvelope(body, detail) {
  const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  return (
    object(body) &&
    !Object.hasOwn(body, 'error') &&
    object(body.meta) &&
    body.meta.source === 'opensky' &&
    Number.isInteger(body.meta.snapshotTime) &&
    body.meta.snapshotTime >= 0 &&
    typeof body.meta.fetchedAt === 'string' &&
    /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(body.meta.fetchedAt) &&
    Number.isFinite(Date.parse(body.meta.fetchedAt)) &&
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
