import { ApiError } from './response.js';

const FLIGHT_CODE = /^[A-Z0-9]{3,10}$/;
const IDENTIFIER_TYPES = ['flight_iata', 'flight_icao'];

function badInput() {
  throw new ApiError('BAD_INPUT');
}

function checkParams(params, allowed) {
  if (!params || typeof params !== 'object' || Array.isArray(params) ||
      Object.keys(params).some((key) => !allowed.includes(key))) {
    badInput();
  }
}

function normalizeCode(code) {
  if (typeof code !== 'string') {
    badInput();
  }
  const normalized = code.trim().toUpperCase();
  if (!FLIGHT_CODE.test(normalized)) {
    badInput();
  }
  return normalized;
}

export function normalizeFlightParams(params) {
  checkParams(params, IDENTIFIER_TYPES);
  const keys = Object.keys(params);
  if (keys.length !== 1) {
    badInput();
  }
  return { [keys[0]]: normalizeCode(params[keys[0]]) };
}

/** Accept explicit saved identifiers only; a legacy id never implies a type. */
export function getSavedFlightIdentifier(bookmark) {
  if (!bookmark || typeof bookmark !== 'object') {
    badInput();
  }
  if (bookmark.identifierType !== undefined || bookmark.code !== undefined) {
    if (!IDENTIFIER_TYPES.includes(bookmark.identifierType)) {
      badInput();
    }
    return { code: normalizeCode(bookmark.code), identifierType: bookmark.identifierType };
  }
  const identifierType = IDENTIFIER_TYPES.find((type) => bookmark[type] != null);
  if (!identifierType) {
    badInput();
  }
  return { code: normalizeCode(bookmark[identifierType]), identifierType };
}

export function normalizeFlightsParams(params) {
  checkParams(params, ['bbox', 'zoom']);
  const values = params.bbox;
  if (!Array.isArray(values) || values.length !== 4 || ![...values].every(Number.isFinite)) {
    badInput();
  }
  const [south, west, north, east] = values;
  if (south < -90 || north > 90 || west < -180 || east > 180 ||
      south >= north || west >= east) {
    badInput();
  }
  const result = { bbox: [south, west, north, east].join(',') };
  if (Object.hasOwn(params, 'zoom')) {
    if (!Number.isInteger(params.zoom) || params.zoom < 0 || params.zoom > 11) {
      badInput();
    }
    result.zoom = params.zoom;
  }
  return result;
}

export function normalizeAirportParams(params) {
  checkParams(params, ['country_code']);
  if (!Object.hasOwn(params, 'country_code')) return {};
  if (typeof params.country_code !== 'string') {
    badInput();
  }
  const code = params.country_code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) {
    badInput();
  }
  return { country_code: code };
}
