import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import worker from './index.js';
import { createApiClient } from '../../src/api/client.js';

const ENV = { AIRLABS_API_KEY: 'test-only-placeholder' };
const json = (response, options) => Response.json({ response }, options);
const request = (path, options) => new Request(`http://localhost:8787${path}`, options);
const run = (path, options, env = ENV) => worker.fetch(request(path, options), env);
const upstream = (handler = () => json([])) => spyOn(globalThis, 'fetch').mockImplementation(handler);
afterEach(() => mock.restore());

async function expectError(response, status, code) {
  expect(response.status).toBe(status);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  const body = await response.json();
  expect(body).toEqual({ error: { code, message: expect.any(String) } });
  expect(JSON.stringify(body)).not.toContain(ENV.AIRLABS_API_KEY);
  expect(body.error.message).not.toContain('unsafe-provider-message');
}

describe('Worker routing and validation', () => {
  test('unknown routes, methods, OPTIONS and missing key never call upstream', async () => {
    const fetchMock = upstream();
    for (const path of ['/api/unknown', '/api/flights/extra', '/api/flights/', '/api/toString', '/map', '/api/flight.xml']) {
      await expectError(await run(path), 404, 'NOT_FOUND');
    }
    for (const method of ['POST', 'PUT', 'DELETE', 'PATCH', 'HEAD']) {
      const response = await run('/api/flights', { method });
      expect(response.headers.get('Allow')).toBe('GET, OPTIONS');
      await expectError(response, 405, 'METHOD_NOT_ALLOWED');
    }
    for (const path of ['/api/flights', '/api/flight', '/api/airports']) {
      const response = await run(path, { method: 'OPTIONS' }, {});
      expect(response.status).toBe(204);
      expect(await response.text()).toBe('');
      expect(response.headers.has('Access-Control-Allow-Origin')).toBe(false);
    }
    for (const env of [undefined, {}, { AIRLABS_API_KEY: '' }, { AIRLABS_API_KEY: '   ' }, { AIRLABS_API_KEY: 42 }]) {
      await expectError(await worker.fetch(request('/api/airports'), env), 503, 'CONFIGURATION_ERROR');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('rejects missing, unknown, duplicate, and credential/destination parameters', async () => {
    const fetchMock = upstream();
    for (const path of [
      '/api/flights', '/api/flight', '/api/flight?flight_iata=AA6&flight_icao=AAL6',
      '/api/flight?flight_iata=AA6&flight_iata=AA6',
      '/api/flights?bbox=0,0,1,1&bbox=0,0,1,1',
      '/api/flights?bbox=0,0,1,1&zoom=1&zoom=1',
      '/api/airports?country_code=ID&country_code=ID',
      '/api/flight?flight_iata=AA6&%66light_iata=AA6',
      '/api/airports?api_key=bad', '/api/airports?signature=bad',
      '/api/airports?url=https://example.com', '/api/airports?_fields=name',
      '/api/airports?_view=array', '/api/airports?search=jakarta',
    ]) await expectError(await run(path), 400, 'BAD_INPUT');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('rejects invalid bounds, zoom, flight codes and country codes', async () => {
    const fetchMock = upstream();
    for (const bbox of ['0,0,0,1', '0,1,1,0', '-91,0,1,1', '0,0,91,1',
      '0,-181,1,1', '0,0,1,181', '0,170,10,-170', '0,0,NaN,1',
      '0,0,Infinity,1', '0,0,1e999,1', '0,,1,2', '0,0,1', '0,0,1,2,3', '0,0,0x10,2']) {
      await expectError(await run(`/api/flights?bbox=${encodeURIComponent(bbox)}`), 400, 'BAD_INPUT');
    }
    for (const zoom of ['', '-1', '12', '1.5', 'NaN', 'Infinity', '1e1']) {
      await expectError(await run(`/api/flights?bbox=0,0,1,2&zoom=${zoom}`), 400, 'BAD_INPUT');
    }
    for (const code of ['', 'A1', 'ABCDEFGHIJK', 'AA-6', 'ＡＡ６', 'AA 6', 'AA6&api_key=bad']) {
      await expectError(await run(`/api/flight?flight_iata=${encodeURIComponent(code)}`), 400, 'BAD_INPUT');
    }
    for (const code of ['', 'I', 'IDN', '12', 'ＩＤ']) {
      await expectError(await run(`/api/airports?country_code=${encodeURIComponent(code)}`), 400, 'BAD_INPUT');
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('normalizes queries, fixes upstream destinations and never forwards client credentials', async () => {
    const fetchMock = upstream((url) => json(new URL(url).pathname.endsWith('/flight') ? { flight_iata: 'AA6' } : []));
    const paths = [
      '/api/flights?bbox=-90,-180,90,180&zoom=0',
      '/api/flights?bbox=1e-7,0,1,2&zoom=11',
      '/api/flight?flight_iata=%20aa6%20', '/api/flight?flight_icao=aal6',
      '/api/airports?country_code=%20id%20', '/api/airports',
    ];
    for (const path of paths) {
      expect((await run(path, { headers: { Cookie: 'client-cookie', Authorization: 'Bearer client-token' } })).status).toBe(200);
    }
    for (const [input, init] of fetchMock.mock.calls) {
      const url = new URL(input);
      expect(url.origin).toBe('https://airlabs.co');
      expect(['/api/v9/flights', '/api/v9/flight', '/api/v9/airports']).toContain(url.pathname);
      expect(url.searchParams.get('api_key')).toBe(ENV.AIRLABS_API_KEY);
      expect(init).toMatchObject({ method: 'GET', credentials: 'omit', redirect: 'manual' });
      expect(init.headers).toEqual({ Accept: 'application/json' });
      if (!url.pathname.endsWith('/flight')) expect(url.searchParams.has('_fields')).toBe(true);
    }
    expect(new URL(fetchMock.mock.calls[2][0]).searchParams.get('flight_iata')).toBe('AA6');
    expect(new URL(fetchMock.mock.calls[3][0]).searchParams.get('flight_icao')).toBe('AAL6');
    expect(new URL(fetchMock.mock.calls[4][0]).searchParams.get('country_code')).toBe('ID');
    expect(new URL(fetchMock.mock.calls[5][0]).searchParams.has('country_code')).toBe(false);
  });
});

describe('sanitized payloads', () => {
  test('returns only approved fields, preserving zero, null, units and observation timestamps', async () => {
    upstream(() => Response.json({
      request: { api_key: ENV.AIRLABS_API_KEY }, terms: 'private metadata',
      response: [{ hex: 'abc123', flight_iata: 'AA6', lat: 0, lng: 0, alt: 0,
        speed: 775, updated: 1626153069, reg_number: null,
        api_key: ENV.AIRLABS_API_KEY, request: { secret: 'hidden' }, unknown: 'drop' }],
    }));
    const before = Date.now();
    const response = await run('/api/flights?bbox=-1,-1,1,1');
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(body.data).toEqual([{ hex: 'abc123', flight_iata: 'AA6', lat: 0, lng: 0, alt: 0,
      speed: 775, updated: 1626153069, reg_number: null }]);
    expect(body.meta.source).toBe('airlabs');
    expect(Date.parse(body.meta.fetchedAt)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(body.meta.fetchedAt)).toBeLessThanOrEqual(Date.now());
    expect(JSON.stringify(body)).not.toContain(ENV.AIRLABS_API_KEY);
    expect(Object.keys(body)).toEqual(['data', 'meta']);
  });

  test('details retain documented time variants; airports retain only directory fields', async () => {
    const record = { flight_iata: 'AA6', model: 'Boeing 777', manufacturer: 'Boeing',
      dep_time: '2026-10-28 08:00', dep_time_utc: '2026-10-28 01:00', dep_time_ts: 1793149200,
      arr_estimated_utc: '2026-10-28 03:00', arr_estimated_ts: 1793156400,
      request: { api_key: ENV.AIRLABS_API_KEY } };
    const fetchMock = upstream(() => json(record));
    const detail = await (await run('/api/flight?flight_iata=AA6')).json();
    const { request: ignored, ...expected } = record;
    expect(detail.data).toEqual(expected);
    fetchMock.mockImplementation(() => json([{ name: 'Airport', iata_code: null, icao_code: 'TEST',
      country_code: 'ID', lat: 0, lng: 0, website: 'drop', phone: 'drop', names: { en: 'drop' } }]));
    expect((await (await run('/api/airports')).json()).data).toEqual([
      { name: 'Airport', iata_code: null, icao_code: 'TEST', country_code: 'ID', lat: 0, lng: 0 },
    ]);
  });

  test('accepts explicit empty lists and confirmed detail misses', async () => {
    const fetchMock = upstream();
    expect((await (await run('/api/airports')).json()).data).toEqual([]);
    expect((await (await run('/api/flights?bbox=0,0,1,1')).json()).data).toEqual([]);
    fetchMock.mockImplementation(() => json(null));
    expect((await (await run('/api/flight?flight_iata=AA6')).json()).data).toBeNull();
    for (const status of [200, 404]) {
      fetchMock.mockImplementation(() => Response.json({ error: { code: 'not_found', message: 'unsafe-provider-message' } }, { status }));
      const response = await run('/api/flight?flight_iata=AA6');
      expect(response.status).toBe(200);
      expect((await response.json()).data).toBeNull();
    }
  });

  test('malformed containers and records are errors, never invented empty results', async () => {
    const fetchMock = upstream();
    for (const body of [null, [], {}, { data: [] }, { response: {} }, { response: null },
      { response: [null] }, { response: [[]] }, { response: [{}] },
      { response: [{ request: { api_key: ENV.AIRLABS_API_KEY } }] },
      { response: [{ name: { nested: 'unsafe' } }] }]) {
      fetchMock.mockImplementation(() => Response.json(body));
      await expectError(await run('/api/airports'), 502, 'UPSTREAM_UNAVAILABLE');
    }
    for (const body of [{ response: [] }, { response: {} }, { response: 'not-found' }]) {
      fetchMock.mockImplementation(() => Response.json(body));
      await expectError(await run('/api/flight?flight_iata=AA6'), 502, 'UPSTREAM_UNAVAILABLE');
    }
    fetchMock.mockImplementation(() => new Response('<html>unsafe-provider-message</html>'));
    await expectError(await run('/api/airports'), 502, 'UPSTREAM_UNAVAILABLE');
  });
});

describe('upstream errors and resource cleanup', () => {
  test('maps quota/configuration JSON errors even when HTTP status is 200', async () => {
    const fetchMock = upstream();
    for (const [codes, status, expected] of [
      [['minute_limit_exceeded', 'hour_limit_exceeded', 'month_limit_exceeded'], 429, 'QUOTA_EXCEEDED'],
      [['unknown_api_key', 'expired_api_key', 'unknown_method', 'access_denied', 'unsupported_plan'], 503, 'CONFIGURATION_ERROR'],
      [['wrong_params', 'internal_error', 'unknown'], 502, 'UPSTREAM_UNAVAILABLE'],
    ]) {
      for (const code of codes) {
        fetchMock.mockImplementation(() => Response.json({ error: { code, message: 'unsafe-provider-message' }, response: [] }));
        await expectError(await run('/api/airports'), status, expected);
      }
    }
    for (const error of [null, {}, 'bad']) {
      fetchMock.mockImplementation(() => Response.json({ error, response: [] }));
      await expectError(await run('/api/airports'), 502, 'UPSTREAM_UNAVAILABLE');
    }
  });

  test('HTTP failures never become empty success, including unexplained 404', async () => {
    const fetchMock = upstream();
    for (const [status, expected, code] of [[401, 503, 'CONFIGURATION_ERROR'], [403, 503, 'CONFIGURATION_ERROR'],
      [429, 429, 'QUOTA_EXCEEDED'], [408, 504, 'UPSTREAM_TIMEOUT'], [504, 504, 'UPSTREAM_TIMEOUT'],
      [404, 502, 'UPSTREAM_UNAVAILABLE'], [500, 502, 'UPSTREAM_UNAVAILABLE'], [502, 502, 'UPSTREAM_UNAVAILABLE']]) {
      fetchMock.mockImplementation(() => new Response('unsafe-provider-message', { status }));
      await expectError(await run('/api/flight?flight_iata=AA6'), expected, code);
    }
    fetchMock.mockImplementation(() => Response.json({ error: { code: 'not_found' } }));
    await expectError(await run('/api/airports'), 502, 'UPSTREAM_UNAVAILABLE');
  });

  test('preserves valid Retry-After without a retry loop and strips invalid values', async () => {
    const fetchMock = upstream();
    for (const value of ['60', new Date(Date.now() + 60000).toUTCString()]) {
      fetchMock.mockImplementation(() => new Response(null, { status: 429, headers: { 'Retry-After': value } }));
      const response = await run('/api/airports');
      expect(response.headers.get('Retry-After')).toBe(value);
      await expectError(response, 429, 'QUOTA_EXCEEDED');
    }
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const value of ['', '-1', '1.5', 'invalid', '999999999999999999999999']) {
      fetchMock.mockImplementation(() => new Response(null, { status: 429, headers: { 'Retry-After': value } }));
      expect((await run('/api/airports')).headers.get('Retry-After')).toBeNull();
    }
  });

  test('rejects redirects and sanitizes network failures without logging them', async () => {
    const log = spyOn(console, 'log').mockImplementation(() => {});
    const error = spyOn(console, 'error').mockImplementation(() => {});
    const fetchMock = upstream();
    for (const status of [301, 302, 303, 307, 308]) {
      fetchMock.mockImplementation(() => new Response(null, { status, headers: { Location: 'https://example.com' } }));
      await expectError(await run('/api/airports'), 502, 'UPSTREAM_UNAVAILABLE');
    }
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(fetchMock.mock.calls[0][1].redirect).toBe('manual');
    fetchMock.mockImplementation(() => { throw new Error(`unsafe-provider-message/${ENV.AIRLABS_API_KEY}`); });
    await expectError(await run('/api/airports'), 502, 'UPSTREAM_UNAVAILABLE');
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  test('times out Fetch and response-body reading at 10 seconds and clears timers', async () => {
    const realTimeout = globalThis.setTimeout;
    const timer = spyOn(globalThis, 'setTimeout').mockImplementation((callback, delay) => {
      expect(delay).toBe(10000);
      return realTimeout(callback, 5);
    });
    const clear = spyOn(globalThis, 'clearTimeout');
    const fetchMock = upstream((url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
    }));
    await expectError(await run('/api/airports'), 504, 'UPSTREAM_TIMEOUT');
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    fetchMock.mockImplementation((url, { signal }) => Promise.resolve({
      status: 200, ok: true, headers: new Headers(),
      json: () => new Promise((resolve, reject) => signal.addEventListener('abort',
        () => reject(new DOMException('aborted', 'AbortError')), { once: true })),
    }));
    await expectError(await run('/api/airports'), 504, 'UPSTREAM_TIMEOUT');
    fetchMock.mockImplementation(() => json([]));
    expect((await run('/api/airports')).status).toBe(200);
    expect(timer).toHaveBeenCalledTimes(3);
    expect(clear).toHaveBeenCalledTimes(3);
  });

  test('existing browser client consumes Worker envelopes and safe errors', async () => {
    const fetchMock = upstream(() => json({ flight_iata: 'AA6', alt: 0 }));
    const client = createApiClient({ baseURL: 'http://localhost:8787',
      fetch: (url, init) => worker.fetch(new Request(url, init), ENV) });
    expect((await client.getFlight({ flight_iata: 'AA6' })).data).toEqual({ flight_iata: 'AA6', alt: 0 });
    fetchMock.mockImplementation(() => Response.json({ error: { code: 'month_limit_exceeded' } },
      { headers: { 'Retry-After': '60' } }));
    await expect(client.getAirports()).rejects.toMatchObject({ code: 'QUOTA', status: 429, retryAt: expect.any(Number) });
  });
});
