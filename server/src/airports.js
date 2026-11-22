import { failure } from './response.js';

const DEFAULT_AIRPORTS_API_URL = 'https://airportsapi.com/api/airports';
const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_PAGE_SIZE = 100;

function toFiniteNumber(value) {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function normalizeCode(value, length) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().toUpperCase();
  if (!trimmed || trimmed === '\\N' || trimmed === 'N/A' || trimmed === '-') return null;
  if (length && trimmed.length !== length) return null;
  return trimmed;
}

function normalizeText(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === '\\N' || trimmed === 'N/A' || trimmed === '-') return null;
  return trimmed;
}

function buildCountryLookup(payload) {
  const map = new Map();
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.included)) {
    return map;
  }
  for (const entry of payload.included) {
    if (!entry || typeof entry !== 'object') continue;
    if (entry.type === 'countries' && entry.id !== undefined && entry.id !== null) {
      const countryName =
        normalizeText(entry.attributes?.name) ??
        normalizeText(entry.attributes?.code);
      if (countryName) {
        map.set(String(entry.id), countryName);
      }
    }
  }
  return map;
}

export function normalizeAirport(raw, index = 0, countryLookup = new Map()) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

  const attrs =
    raw.attributes && typeof raw.attributes === 'object' && !Array.isArray(raw.attributes)
      ? raw.attributes
      : raw;

  const name =
    normalizeText(attrs.name) ??
    normalizeText(attrs.airport_name) ??
    normalizeText(attrs.title);
  if (!name) return null;

  const iata = normalizeCode(
    attrs.iata_code ?? attrs.iata ?? attrs.iataCode,
    3
  );
  const icao = normalizeCode(
    attrs.icao_code ?? attrs.icao ?? attrs.icaoCode ?? attrs.gps_code ?? attrs.code,
    4
  );

  const relCountryId =
    raw.relationships?.country?.data && typeof raw.relationships.country.data === 'object'
      ? normalizeText(String(raw.relationships.country.data.id ?? ''))
      : null;

  const includedCountryName = relCountryId ? countryLookup.get(relCountryId) ?? null : null;

  const country =
    normalizeText(attrs.country) ??
    normalizeText(attrs.country_name) ??
    normalizeText(attrs.countryName) ??
    includedCountryName ??
    relCountryId ??
    '';

  const rawLat = toFiniteNumber(attrs.latitude ?? attrs.lat);
  const rawLng = toFiniteNumber(attrs.longitude ?? attrs.lon ?? attrs.lng);

  const validLat = rawLat !== null && rawLat >= -90 && rawLat <= 90 ? rawLat : null;
  const validLng = rawLng !== null && rawLng >= -180 && rawLng <= 180 ? rawLng : null;

  const latitude = validLat !== null && validLng !== null ? validLat : null;
  const longitude = validLat !== null && validLng !== null ? validLng : null;

  const id =
    normalizeText(String(raw.id ?? attrs.id ?? raw.airport_id ?? '')) ??
    (icao || iata ? `${icao ?? 'NOICAO'}-${iata ?? 'NOIATA'}-${index}` : `airport-${index}`);

  return {
    id,
    name,
    iata,
    icao,
    country,
    latitude,
    longitude,
  };
}

function extractAirportList(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    for (const key of ['data', 'airports', 'items', 'results']) {
      if (Array.isArray(payload[key])) return payload[key];
    }
  }
  return null;
}

function buildUpstreamUrl(env) {
  const base =
    typeof env.AIRPORTS_API_URL === 'string' && env.AIRPORTS_API_URL.trim()
      ? env.AIRPORTS_API_URL.trim()
      : DEFAULT_AIRPORTS_API_URL;

  const url = new URL(base);
  if (!url.searchParams.has('include')) {
    url.searchParams.set('include', 'country');
  }
  if (!url.searchParams.has('page[size]')) {
    const rawSize = Number(env.AIRPORTS_API_PAGE_SIZE);
    const pageSize = Number.isInteger(rawSize) && rawSize > 0 ? rawSize : DEFAULT_PAGE_SIZE;
    url.searchParams.set('page[size]', String(pageSize));
  }
  return url.toString();
}

export async function fetchAirports(env = {}, fetchImpl = globalThis.fetch, now = Date.now) {
  const endpoint = buildUpstreamUrl(env);

  const timeoutMs =
    Number.isFinite(Number(env.AIRPORTS_API_TIMEOUT_MS)) && Number(env.AIRPORTS_API_TIMEOUT_MS) > 0
      ? Number(env.AIRPORTS_API_TIMEOUT_MS)
      : DEFAULT_TIMEOUT_MS;

  const headers = {
    Accept: 'application/json',
  };

  if (typeof env.AIRPORTS_API_KEY === 'string' && env.AIRPORTS_API_KEY.trim()) {
    headers['X-API-Key'] = env.AIRPORTS_API_KEY.trim();
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let upstreamResponse;
  try {
    upstreamResponse = await fetchImpl(endpoint, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === 'AbortError') {
      return failure(504);
    }
    return failure(503);
  } finally {
    clearTimeout(timer);
  }

  if (!upstreamResponse || !upstreamResponse.ok) {
    const status = upstreamResponse?.status;
    if (status === 429) {
      const retryAfter = upstreamResponse.headers?.get('Retry-After');
      return failure(429, retryAfter ? { 'Retry-After': retryAfter } : { 'Retry-After': '60' });
    }
    if (status === 401 || status === 403) {
      return failure(503);
    }
    if (status === 504) {
      return failure(504);
    }
    return failure(502);
  }

  let payload;
  try {
    payload = await upstreamResponse.json();
  } catch {
    return failure(502);
  }

  const rawList = extractAirportList(payload);
  if (!rawList) {
    return failure(502);
  }

  const countryLookup = buildCountryLookup(payload);
  const normalized = [];
  for (let i = 0; i < rawList.length; i += 1) {
    const item = normalizeAirport(rawList[i], i, countryLookup);
    if (item) normalized.push(item);
  }

  return new Response(
    JSON.stringify({
      meta: {
        source: 'airportsapi',
        fetchedAt: new Date(now()).toISOString(),
      },
      data: normalized,
    }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
    }
  );
}