import { isObject, failure, success, extractData, retryAfter } from './response.js';

const UPSTREAM_BASE = 'https://airlabs.co/api/v9/';
const FLIGHT_FIELDS = [
  'hex', 'reg_number', 'flight_iata', 'flight_icao', 'flight_number',
  'airline_iata', 'airline_icao', 'flag', 'lat', 'lng', 'alt', 'speed', 'dir',
  'aircraft_icao', 'dep_iata', 'dep_icao', 'arr_iata', 'arr_icao', 'status', 'updated',
];
const DETAIL_FIELDS = [
  ...FLIGHT_FIELDS, 'model', 'manufacturer',
  'dep_time', 'dep_time_ts', 'dep_time_utc',
  'dep_estimated', 'dep_estimated_ts', 'dep_estimated_utc',
  'arr_time', 'arr_time_ts', 'arr_time_utc',
  'arr_estimated', 'arr_estimated_ts', 'arr_estimated_utc',
];
export const ROUTES = {
  '/api/flights': { endpoint: 'flights', params: ['bbox', 'zoom'], fields: FLIGHT_FIELDS },
  '/api/flight': { endpoint: 'flight', params: ['flight_iata', 'flight_icao'], fields: DETAIL_FIELDS },
  '/api/airports': { endpoint: 'airports', params: ['country_code'], fields: ['name', 'iata_code', 'icao_code', 'country_code', 'lat', 'lng'] },
};

const QUOTA_CODES = ['minute_limit_exceeded', 'hour_limit_exceeded', 'month_limit_exceeded'];
const CONFIG_CODES = ['unknown_api_key', 'expired_api_key', 'unknown_method', 'access_denied', 'unsupported_plan'];

export async function fetchAirlabs(route, params, apiKey) {
  const upstream = new URL(route.endpoint, UPSTREAM_BASE);
  for (const [key, value] of params) upstream.searchParams.set(key, value);
  if (route.endpoint !== 'flight') upstream.searchParams.set('_fields', route.fields.join(','));
  upstream.searchParams.set('api_key', apiKey);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  let retryHeaders = {};
  try {
    // workerd supports manual/follow, not error; reject 3xx below without following.
    const response = await fetch(upstream.href, {
      method: 'GET', redirect: 'manual', credentials: 'omit',
      headers: { Accept: 'application/json' }, signal: controller.signal,
    });
    retryHeaders = retryAfter(response.headers);
    if (response.status >= 300 && response.status < 400) throw 502;
    if (response.status === 429) return failure(429, retryHeaders);
    if ([401, 403].includes(response.status)) return failure(503, retryHeaders);
    if ([408, 504].includes(response.status)) return failure(504, retryHeaders);

    const body = await response.json();
    if (!isObject(body)) throw 502;
    if (Object.hasOwn(body, 'error')) {
      const code = isObject(body.error) ? body.error.code : null;
      if (QUOTA_CODES.includes(code)) return failure(429, retryHeaders);
      if (CONFIG_CODES.includes(code)) return failure(503, retryHeaders);
      if (code === 'not_found' && route.endpoint === 'flight' && (response.ok || response.status === 404)) {
        return success(null);
      }
      throw 502;
    }
    if (!response.ok) throw 502;
    return success(extractData(body, route));
  } catch {
    return failure(controller.signal.aborted ? 504 : 502, retryHeaders);
  } finally {
    clearTimeout(timer);
  }
}
