const FLIGHT_CODE = /^[A-Z0-9]{3,10}$/;
const IDENTIFIER_TYPES = ['flight_iata', 'flight_icao'];
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

function badInput() {
  throw new ApiError('BAD_INPUT');
}

function checkParams(params, allowed) {
  if (!params || typeof params !== 'object' || Array.isArray(params) ||
      Object.keys(params).some((key) => !allowed.includes(key))) badInput();
}

function normalizeCode(code) {
  if (typeof code !== 'string') badInput();
  const normalized = code.trim().toUpperCase();
  if (!FLIGHT_CODE.test(normalized)) badInput();
  return normalized;
}

function flightParams(params) {
  checkParams(params, IDENTIFIER_TYPES);
  const keys = Object.keys(params);
  if (keys.length !== 1) badInput();
  return { [keys[0]]: normalizeCode(params[keys[0]]) };
}

/** Accept explicit saved identifiers only; a legacy id never implies a type. */
export function getSavedFlightIdentifier(bookmark) {
  if (!bookmark || typeof bookmark !== 'object') badInput();
  if (bookmark.identifierType !== undefined || bookmark.code !== undefined) {
    if (!IDENTIFIER_TYPES.includes(bookmark.identifierType)) badInput();
    return { code: normalizeCode(bookmark.code), identifierType: bookmark.identifierType };
  }
  const identifierType = IDENTIFIER_TYPES.find((type) => bookmark[type] != null);
  if (!identifierType) badInput();
  return { code: normalizeCode(bookmark[identifierType]), identifierType };
}

function flightsParams(params) {
  checkParams(params, ['bbox', 'zoom']);
  const values = params.bbox;
  if (!Array.isArray(values) || values.length !== 4 || ![...values].every(Number.isFinite)) badInput();
  const [south, west, north, east] = values;
  if (south < -90 || north > 90 || west < -180 || east > 180 ||
      south >= north || west >= east) badInput();
  const result = { bbox: [south, west, north, east].join(',') };
  if (Object.hasOwn(params, 'zoom')) {
    if (!Number.isInteger(params.zoom) || params.zoom < 0 || params.zoom > 11) badInput();
    result.zoom = params.zoom;
  }
  return result;
}

function airportParams(params) {
  checkParams(params, ['country_code']);
  if (!Object.hasOwn(params, 'country_code')) return {};
  if (typeof params.country_code !== 'string') badInput();
  const code = params.country_code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) badInput();
  return { country_code: code };
}

function proxyOrigin(baseURL) {
  try {
    const url = new URL(baseURL);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
        url.pathname !== '/' || url.search || url.hash) throw new Error();
    return url.origin;
  } catch {
    throw new ApiError('CONFIGURATION');
  }
}

function retryTime(header, now) {
  if (!header?.trim()) return null;
  const value = header.trim();
  const time = /^\d+$/.test(value) ? now + Number(value) * 1000 :
    /^[A-Za-z]{3}, /.test(value) ? Date.parse(value) : NaN;
  return Number.isFinite(time) && time <= 8640000000000000 ? Math.max(time, now) : null;
}

function statusCode(status) {
  return ({ 400: 'BAD_INPUT', 403: 'ACCESS_DENIED', 429: 'QUOTA',
    503: 'CONFIGURATION', 504: 'TIMEOUT' })[status] || 'UNAVAILABLE';
}

function validEnvelope(body, detail) {
  const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
  return object(body) && !Object.hasOwn(body, 'error') && object(body.meta) &&
    body.meta.source === 'airlabs' && typeof body.meta.fetchedAt === 'string' &&
    /^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(body.meta.fetchedAt) &&
    Number.isFinite(Date.parse(body.meta.fetchedAt)) &&
    (detail ? body.data === null || object(body.data) :
      Array.isArray(body.data) && body.data.every(object));
}

// Cancellation belongs to each caller, not to the shared network request.
function forConsumer(promise, signal) {
  if (!signal) return promise.then((value) => structuredClone(value));
  return new Promise((resolve, reject) => {
    const abort = () => reject(new DOMException('Request canceled.', 'AbortError'));
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    promise.then((value) => {
      if (!signal.aborted) resolve(structuredClone(value));
    }, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

/** Separate instances allow isolated contract tests; the app uses the singleton below. */
export function createApiClient({ baseURL, fetch: fetchImpl = (...args) => globalThis.fetch(...args),
  now = () => Date.now(), timeoutMs = 15000 } = {}) {
  const cache = new Map();
  const pending = new Map();
  let cooldown = null;

  async function fetchEnvelope(url, detail, ttl) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        method: 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store',
        headers: { Accept: 'application/json' }, signal: controller.signal,
      });
      if (!response.ok) {
        const retryAt = retryTime(response.headers.get('Retry-After'), now());
        const error = new ApiError(statusCode(response.status), { status: response.status, retryAt });
        if (retryAt > now() && (!cooldown || retryAt > cooldown.retryAt)) cooldown = error;
        throw error;
      }
      let body;
      try { body = await response.json(); }
      catch {
        if (controller.signal.aborted) throw new ApiError('TIMEOUT');
        throw new ApiError('INVALID_RESPONSE', { status: response.status });
      }
      if (!validEnvelope(body, detail)) throw new ApiError('INVALID_RESPONSE', { status: response.status });
      const expiresAt = Date.parse(body.meta.fetchedAt) + ttl;
      // Bound memory during a long session with many different viewport requests.
      for (const [key, entry] of cache) if (entry.expiresAt <= now()) cache.delete(key);
      if (cache.size >= 100) cache.delete(cache.keys().next().value);
      if (expiresAt > now()) cache.set(url, { body, expiresAt });
      return body;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(controller.signal.aborted ? 'TIMEOUT' : 'NETWORK');
    } finally {
      clearTimeout(timer);
    }
  }

  async function request(path, params, ttl, { signal } = {}) {
    if (signal?.aborted) throw new DOMException('Request canceled.', 'AbortError');
    const url = new URL(path, proxyOrigin(baseURL));
    for (const key of Object.keys(params).sort()) url.searchParams.set(key, params[key]);
    const key = url.href;
    const cached = cache.get(key);
    if (cached?.expiresAt > now()) return forConsumer(Promise.resolve(cached.body), signal);
    cache.delete(key);
    if (pending.has(key)) return forConsumer(pending.get(key), signal);
    if (cooldown?.retryAt > now()) throw new ApiError(cooldown.code, cooldown);
    const promise = fetchEnvelope(key, path === '/api/flight', ttl)
      .finally(() => pending.delete(key));
    pending.set(key, promise);
    return forConsumer(promise, signal);
  }

  return {
    async getFlights(params, options) { return request('/api/flights', flightsParams(params), 30000, options); },
    async getFlight(params, options) { return request('/api/flight', flightParams(params), 30000, options); },
    async getAirports(params = {}, options) { return request('/api/airports', airportParams(params), 86400000, options); },
  };
}

const client = createApiClient({ baseURL: import.meta.env?.VITE_API_BASE_URL });
export const { getFlights, getFlight, getAirports } = client;
