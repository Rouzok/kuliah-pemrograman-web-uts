import { normalizeFlightParams, normalizeFlightsParams, normalizeAirportParams } from './validation.js';
import { ApiError, parseRetryAfter, errorCodeForStatus, isValidEnvelope } from './response.js';

export { ApiError } from './response.js';
export { getSavedFlightIdentifier } from './validation.js';

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
        const retryAt = parseRetryAfter(response.headers.get('Retry-After'), now());
        const error = new ApiError(errorCodeForStatus(response.status), { status: response.status, retryAt });
        if (retryAt > now() && (!cooldown || retryAt > cooldown.retryAt)) cooldown = error;
        throw error;
      }
      let body;
      try { body = await response.json(); }
      catch {
        if (controller.signal.aborted) throw new ApiError('TIMEOUT');
        throw new ApiError('INVALID_RESPONSE', { status: response.status });
      }
      if (!isValidEnvelope(body, detail)) throw new ApiError('INVALID_RESPONSE', { status: response.status });
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
    async getFlights(params, options) { return request('/api/flights', normalizeFlightsParams(params), 30000, options); },
    async getFlight(params, options) { return request('/api/flight', normalizeFlightParams(params), 30000, options); },
    async getAirports(params = {}, options) { return request('/api/airports', normalizeAirportParams(params), 86400000, options); },
  };
}

const client = createApiClient({ baseURL: import.meta.env?.VITE_API_BASE_URL });
export const { getFlights, getFlight, getAirports } = client;
