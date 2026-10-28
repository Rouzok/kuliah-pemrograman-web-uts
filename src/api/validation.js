import { ApiError } from './response.js';

const badInput = () => {
  throw new ApiError('BAD_INPUT');
};
function checkParams(params, allowed) {
  if (!params || typeof params !== 'object' || Array.isArray(params) || Object.keys(params).some((key) => !allowed.includes(key))) badInput();
}
export function normalizeFlightParams(params) {
  checkParams(params, ['icao24']);
  if (typeof params.icao24 !== 'string' || !/^[a-f\d]{6}$/i.test(params.icao24.trim())) badInput();
  return { icao24: params.icao24.trim().toLowerCase() };
}
// Legacy flight numbers stay removable, but can never initiate an aircraft lookup.
export function getSavedFlightIdentifier(bookmark) {
  if (bookmark?.identifierType !== 'icao24') badInput();
  return { code: normalizeFlightParams({ icao24: bookmark.code }).icao24, identifierType: 'icao24' };
}
export function normalizeFlightsParams(params) {
  checkParams(params, ['bbox']);
  const values = params.bbox;
  if (!Array.isArray(values) || values.length !== 4 || ![...values].every(Number.isFinite)) badInput();
  const [south, west, north, east] = values;
  if (south < -90 || north > 90 || west < -180 || east > 180 || south >= north || west >= east) badInput();
  return { bbox: values.join(',') };
}
export function normalizeAirportParams(params) {
  checkParams(params, []);
  return {};
}
