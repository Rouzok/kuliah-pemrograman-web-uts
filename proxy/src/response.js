const ERRORS = {
  400: ['BAD_INPUT', 'Request parameters are invalid.'],
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
  return Response.json({ error: { code, message } }, {
    status, headers: { 'Cache-Control': 'no-store', ...headers },
  });
}

function sanitizeRecord(record, fields) {
  if (!isObject(record)) throw 502;
  const sanitized = {};
  for (const field of fields) {
    if (!Object.hasOwn(record, field)) continue;
    const value = record[field];
    if (value !== null && typeof value !== 'string' &&
        !(typeof value === 'number' && Number.isFinite(value))) throw 502;
    sanitized[field] = value;
  }
  if (Object.keys(sanitized).length === 0) throw 502;
  return sanitized;
}

export function extractData(body, route) {
  if (!isObject(body) || !Object.hasOwn(body, 'response')) throw 502;
  if (route.endpoint === 'flight') {
    return body.response === null ? null : sanitizeRecord(body.response, route.fields);
  }
  if (!Array.isArray(body.response)) throw 502;
  return body.response.map((record) => sanitizeRecord(record, route.fields));
}

export function retryAfter(headers) {
  const value = headers.get('Retry-After')?.trim();
  if (!value) return {};
  const valid = /^\d+$/.test(value) ? Number.isFinite(Number(value)) && Number(value) <= 8640000000000 :
    /^[A-Za-z]{3}, /.test(value) && Number.isFinite(Date.parse(value));
  return valid ? { 'Retry-After': value } : {};
}

export function success(data) {
  // No Worker cache until T07; fetchedAt is retrieval time, not observation time.
  return Response.json({ data, meta: { fetchedAt: new Date().toISOString(), source: 'airlabs' } }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
