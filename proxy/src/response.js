const ERRORS = {
  400: ['BAD_INPUT', 'Request parameters are invalid.'],
  403: ['ACCESS_DENIED', 'Access to flight data is not allowed.'],
  404: ['NOT_FOUND', 'API route was not found.'],
  405: ['METHOD_NOT_ALLOWED', 'Request method is not supported.'],
  429: ['QUOTA_EXCEEDED', 'Flight data request limit reached. Please try again later.'],
  502: ['UPSTREAM_UNAVAILABLE', 'Flight data is temporarily unavailable.'],
  503: ['CONFIGURATION_ERROR', 'Flight data service configuration or plan access is unavailable.'],
  504: ['UPSTREAM_TIMEOUT', 'Flight data request timed out. Please try again.'],
};
export const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
export function failure(status, headers = {}) {
  const [code, message] = ERRORS[status];
  return Response.json({ error: { code, message } }, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}
const FIELDS = {
  0: 'icao24',
  1: 'callsign',
  2: 'origin_country',
  3: 'time_position',
  4: 'last_contact',
  5: 'longitude',
  6: 'latitude',
  7: 'baro_altitude',
  8: 'on_ground',
  9: 'velocity',
  10: 'true_track',
  11: 'vertical_rate',
  13: 'geo_altitude',
};
export function extractData(body, route, params) {
  if (!isObject(body) || !Number.isInteger(body.time) || body.time < 0 || !(body.states === null || Array.isArray(body.states))) throw 502;
  const records = (body.states ?? []).map((row) => {
    if (!Array.isArray(row) || row.length < 17 || typeof row[0] !== 'string' || !/^[a-f\d]{6}$/i.test(row[0]) || !(row[1] === null || typeof row[1] === 'string') || typeof row[2] !== 'string' || typeof row[8] !== 'boolean') throw 502;
    const record = {};
    for (const [index, field] of Object.entries(FIELDS)) {
      const value = row[index];
      if (![0, 1, 2, 8].includes(Number(index)) && value !== null && (typeof value !== 'number' || !Number.isFinite(value))) throw 502;
      record[field] = value;
    }
    if (
      (record.longitude !== null && Math.abs(record.longitude) > 180) ||
      (record.latitude !== null && Math.abs(record.latitude) > 90) ||
      [record.time_position, record.last_contact].some((value) => value !== null && (!Number.isInteger(value) || value < 0))
    )
      throw 502;
    record.icao24 = record.icao24.toLowerCase();
    record.callsign = record.callsign?.trim() ?? null;
    return record;
  });
  if (new Set(records.map((record) => record.icao24)).size !== records.length) throw 502;
  return route.endpoint === 'flight' ? (records.find((record) => record.icao24 === params.get('icao24')) ?? null) : records;
}
export function retryAfter(headers) {
  const value = (headers.get('X-Rate-Limit-Retry-After-Seconds') ?? headers.get('Retry-After'))?.trim();
  if (!value) return {};
  const valid = /^\d+$/.test(value) ? Number.isFinite(Number(value)) && Number(value) <= 8640000000000 : /^[A-Za-z]{3}, /.test(value) && Number.isFinite(Date.parse(value));
  return valid ? { 'Retry-After': value } : {};
}
export function success(data, snapshotTime) {
  return Response.json(
    { data, meta: { fetchedAt: new Date().toISOString(), source: 'opensky', snapshotTime } },
    {
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
