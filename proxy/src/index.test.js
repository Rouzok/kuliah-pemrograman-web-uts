import { afterEach, describe, expect, test } from 'bun:test';
import axios from 'axios';
import worker, { handleRequest } from './index.js';
import { transport, createTokenManager } from './oauth.js';
import { fetchOpenSky, ROUTES } from './opensky.js';
import { createApiClient } from '../../src/api/client.js';

const row = () => ['ABC123', ' GIA1 ', 'Indonesia', 0, 0, null, null, 0, false, 0, 0, null, null, null, 'ignored', false, 0];
const payload = (states = [row()]) => ({ time: 1700000000, states });
const env = () => ({ OPENSKY_CLIENT_ID: 'dummy-id', OPENSKY_CLIENT_SECRET: 'dummy-secret',
  ALLOWED_ORIGINS: 'http://localhost:5173,http://localhost:4173', RATE_LIMITER: { limit: async () => ({ success: true }) } });
const headers = { Origin: 'http://localhost:5173', 'CF-Connecting-IP': '192.0.2.1' };
const path = '/api/flights?bbox=-1,100,1,102';
const response = (data, status = 200, headers = {}) => ({ data, status, headers: new axios.AxiosHeaders(headers) });
const originalAdapter = transport.defaults.adapter;
const originalCaches = globalThis.caches;
afterEach(() => { transport.defaults.adapter = originalAdapter; globalThis.caches = originalCaches; });
function upstream(handler = () => response(payload())) {
  const calls = [];
  // Fresh credentials avoid sharing tokens between isolated handler tests.
  const bindings = env(); bindings.OPENSKY_CLIENT_ID += Math.random();
  transport.defaults.adapter = async (config) => {
    calls.push(config);
    return config.method === 'post' ? response({ access_token: 'dummy-token', expires_in: 1800 }) : handler(config);
  };
  return { calls, bindings, run: (url = path, init = {}) => handleRequest(new Request(`https://proxy.test${url}`, { headers, ...init }), bindings) };
}
function cacheStore() {
  const records = new Map();
  globalThis.caches = { default: {
    match: async (request) => records.get(request.url)?.clone(),
    put: async (request, value) => { records.set(request.url, value.clone()); },
  } };
  return records;
}
describe('public Worker contract', () => {
  test('maps bounds, bearer transport, named fields and snapshot metadata', async () => {
    const { calls, run } = upstream();
    const result = await run(); expect(result.status).toBe(200);
    const body = await result.json();
    expect(body.meta).toMatchObject({ source: 'opensky', snapshotTime: 1700000000 });
    expect(Number.isFinite(Date.parse(body.meta.fetchedAt))).toBe(true);
    expect(body.data[0]).toEqual({ icao24: 'abc123', callsign: 'GIA1', origin_country: 'Indonesia',
      time_position: 0, last_contact: 0, longitude: null, latitude: null, baro_altitude: 0,
      on_ground: false, velocity: 0, true_track: 0, vertical_rate: null, geo_altitude: null });
    expect(calls[0].url).toBe('https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token');
    expect(new URLSearchParams(calls[0].data).get('grant_type')).toBe('client_credentials');
    expect(calls[0].headers.get('Authorization')).toBeUndefined();
    expect(calls[1].url).toBe('https://opensky-network.org/api/states/all?lamin=-1&lomin=100&lamax=1&lomax=102');
    expect(calls[1].headers.get('Authorization')).toBe('Bearer dummy-token');
    expect(calls[1].fetchOptions.redirect).toBe('manual');
    expect(calls[1].withCredentials).toBe(false);
  });
  test('normalizes detail ICAO24, empty states, absent aircraft and ground boolean', async () => {
    const { run } = upstream(() => { const state = row(); state[8] = true; return response(payload([state])); });
    expect((await (await run('/api/flight?icao24=%20ABC123%20')).json()).data.on_ground).toBe(true);
    expect((await (await run('/api/flight?icao24=def456')).json()).data).toBeNull();
    for (const states of [[], null]) {
      const empty = upstream(() => response(payload(states)));
      expect((await (await empty.run()).json()).data).toEqual([]);
    }
  });
  test('validates routes, methods and strict duplicate/unknown parameters before upstream', async () => {
    const { run, calls } = upstream();
    expect((await run('/missing')).status).toBe(404);
    expect((await run(path, { method: 'POST' })).status).toBe(405);
    for (const url of ['/api/flights', `${path}&zoom=5`, `${path}&bbox=0,0,1,1`, '/api/flights?bbox=0,170,1,-170',
      '/api/flights?bbox=0,0,0,1', '/api/flights?bbox=-91,0,1,1', '/api/flights?bbox=0,0,1,181',
      '/api/flights?bbox=0,,1,2', '/api/flight?icao24=abc12g', '/api/flight?flight_iata=GA123',
      '/api/flight?icao24=abc123&icao24=def456', '/api/airports?country_code=ID']) expect((await run(url)).status).toBe(400);
    expect(calls).toHaveLength(0);
  });
  test('rejects malformed containers, arrays, coordinates and booleans safely', async () => {
    for (const body of [null, [], {}, { time: 1, states: {} }, { time: '1', states: [] },
      payload([null]), payload([{}]), payload([row().slice(0, 10)]), payload([row(), row()]),
      ...[[0, 'wrong'], [5, 181], [6, -91], [8, 'false'], [9, {}], [3, -1]].map(([index, value]) => {
        const state = row(); state[index] = value; return payload([state]);
      })]) {
      const { run } = upstream(() => response(body));
      const result = await run(); expect(result.status).toBe(502);
      expect(await result.json()).toEqual({ error: { code: 'UPSTREAM_UNAVAILABLE', message: 'Flight data is temporarily unavailable.' } });
    }
  });
  test('HTTP errors and redirects never become empty successes; rate headers normalize', async () => {
    for (const [status, expected] of [[301, 502], [302, 502], [307, 502], [308, 502], [404, 502], [500, 502], [401, 503], [403, 503], [408, 504], [504, 504], [429, 429]]) {
      const { run } = upstream(() => response('unsafe-token', status, { 'X-Rate-Limit-Retry-After-Seconds': '60' }));
      const result = await run(); expect(result.status).toBe(expected);
      expect(result.headers.get('Retry-After')).toBe('60');
      expect(await result.text()).not.toContain('unsafe-token');
    }
  });
});
describe('CORS, rate limits and cache', () => {
  test('preflight is local and exact origins are enforced on failures too', async () => {
    const { run, calls, bindings } = upstream();
    let limited = 0; bindings.RATE_LIMITER.limit = async () => { limited++; return { success: true }; };
    const preflight = await run(path, { method: 'OPTIONS', headers: { Origin: headers.Origin, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'accept, Content-Type' } });
    expect(preflight.status).toBe(204); expect(limited).toBe(0); expect(calls).toHaveLength(0);
    expect(preflight.headers.get('Access-Control-Allow-Origin')).toBe(headers.Origin);
    expect(preflight.headers.get('Access-Control-Allow-Credentials')).toBeNull();
    expect((await run(path, { headers: { ...headers, Origin: 'http://localhost:5173.evil' } })).status).toBe(403);
    expect((await run(path, { method: 'OPTIONS', headers: { Origin: headers.Origin, 'Access-Control-Request-Method': 'POST' } })).status).toBe(400);
    const bad = await run('/api/flight?icao24=bad');
    expect(bad.headers.get('Access-Control-Allow-Origin')).toBe(headers.Origin);
    expect(bad.headers.get('Access-Control-Expose-Headers')).toBe('Retry-After');
    expect(bad.headers.get('Vary')).toBe('Origin');
    expect((await run(path, { headers: { 'CF-Connecting-IP': '192.0.2.1' } })).status).toBe(200);
  });
  test('limiter rejects before cache/provider; missing/failing binding is controlled', async () => {
    const { run, calls, bindings } = upstream();
    cacheStore();
    bindings.RATE_LIMITER.limit = async ({ key }) => { expect(key).toBe('192.0.2.1'); return { success: false }; };
    const result = await run(); expect(result.status).toBe(429); expect(result.headers.get('Retry-After')).toBe('60');
    bindings.RATE_LIMITER.limit = async () => { throw new Error('unsafe'); };
    expect((await run()).status).toBe(503);
    delete bindings.RATE_LIMITER; expect((await run()).status).toBe(503);
    expect(calls).toHaveLength(0);
  });
  test('canonical provider-versioned cache is origin independent with preserved timestamps and expiry', async () => {
    const records = cacheStore();
    const { run, calls } = upstream();
    const first = await run(); const body = await first.json();
    const second = await run('/api/flights?bbox=-1.0,100,1,102', { headers: { ...headers, Origin: 'http://localhost:4173' } });
    expect(await second.json()).toEqual(body);
    expect(second.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:4173');
    expect(second.headers.get('Cache-Control')).toBe('no-store'); expect(calls).toHaveLength(2);
    const [key, stored] = [...records][0];
    expect(key).toContain('/__cache/opensky-v1/');
    expect(stored.headers.get('Access-Control-Allow-Origin')).toBeNull();
    records.set(key, Response.json({ ...body, meta: { ...body.meta, fetchedAt: new Date(Date.now() - 30000).toISOString() } }));
    await run(); expect(calls).toHaveLength(3);
  });
  test('deferred airports never contact providers or enter cache; errors remain uncached', async () => {
    const records = cacheStore(); const { run, calls } = upstream(() => response({}, 500));
    expect((await run('/api/airports')).status).toBe(503); expect(calls).toHaveLength(0);
    await run(); await run(); expect(calls).toHaveLength(3); expect(records.size).toBe(0);
  });
  test('browser client consumes the Worker through an injectable Axios adapter', async () => {
    const { bindings } = upstream();
    const client = createApiClient({ baseURL: 'https://proxy.test', adapter: async (config) => {
      const result = await worker.fetch(new Request(config.url, { headers }), bindings);
      return response(await result.json(), result.status, Object.fromEntries(result.headers));
    } });
    expect((await client.getFlight({ icao24: 'ABC123' })).data.icao24).toBe('abc123');
    await expect(client.getAirports()).rejects.toMatchObject({ code: 'CONFIGURATION', status: 503 });
  });
});
describe('OAuth lifecycle and sequence deadline', () => {
  test('reuses tokens, deduplicates acquisition, renews at margin and protects newer tokens', async () => {
    let now = 0, count = 0;
    const http = axios.create({ adapter: async () => response({ access_token: `token${++count}`, expires_in: 60 }) });
    const manager = createTokenManager(http, () => now), bindings = env(), signal = new AbortController().signal;
    expect(await Promise.all([manager.get(bindings, signal), manager.get(bindings, signal)])).toEqual(['token1', 'token1']);
    now = 29999; expect(await manager.get(bindings, signal)).toBe('token1');
    now = 30000; expect(await manager.get(bindings, signal)).toBe('token2');
    manager.invalidate('token1'); expect(await manager.get(bindings, signal)).toBe('token2');
    manager.invalidate('token2'); expect(await manager.get(bindings, signal)).toBe('token3');
    expect(count).toBe(3);
  });
  test('401 refresh/replay is bounded and rejected credentials are safe', async () => {
    for (const always401 of [false, true]) {
      let auth = 0, data = 0;
      const http = axios.create({ adapter: async (config) => config.method === 'post' ?
        response({ access_token: `token${++auth}`, expires_in: 1800 }) : response(payload(), ++data === 1 || always401 ? 401 : 200) });
      const result = await fetchOpenSky(ROUTES['/api/flight'], new URLSearchParams({ icao24: 'abc123' }), env(), { http, tokenManager: createTokenManager(http) });
      expect(result.status).toBe(always401 ? 503 : 200); expect(auth).toBe(2); expect(data).toBe(2);
    }
    for (const result of [response({ error: 'secret' }, 401), response({}, 200), response({}, 302)]) {
      const http = axios.create({ adapter: async () => result });
      const safe = await fetchOpenSky(ROUTES['/api/flight'], new URLSearchParams({ icao24: 'abc123' }), env(), { http, tokenManager: createTokenManager(http) });
      expect(safe.status).toBe(503); expect(await safe.text()).not.toContain('secret');
    }
  });
  test('concurrent rejected tokens share a renewal', async () => {
    let auth = 0;
    const http = axios.create({ adapter: async (config) => config.method === 'post' ? response({ access_token: `token${++auth}`, expires_in: 1800 }) :
      response(payload(), config.headers.get('Authorization') === 'Bearer token1' ? 401 : 200) });
    const manager = createTokenManager(http);
    const options = { http, tokenManager: manager };
    const results = await Promise.all([1, 2, 3].map(() => fetchOpenSky(ROUTES['/api/flight'], new URLSearchParams({ icao24: 'abc123' }), env(), options)));
    expect(results.map((result) => result.status)).toEqual([200, 200, 200]); expect(auth).toBe(2);
  });
  test('one deadline bounds auth, shared waits, data and replay without exposing errors', async () => {
    for (const stage of ['auth', 'data', 'replay']) {
      let data = 0;
      const http = axios.create({ adapter: async (config) => {
        if ((config.method === 'post' && stage === 'auth') || (config.method === 'get' && (stage === 'data' || ++data > 1))) return new Promise(() => {});
        return config.method === 'post' ? response({ access_token: `token${data}`, expires_in: 1800 }) : response({}, 401);
      } });
      const result = await fetchOpenSky(ROUTES['/api/flight'], new URLSearchParams({ icao24: 'abc123' }), env(), { http, tokenManager: createTokenManager(http), timeoutMs: 5 });
      expect(result.status).toBe(504);
    }
  });
  test('real Fetch adapter preserves manual redirect and abort behavior', async () => {
    const server = Bun.serve({ port: 0, fetch(request) {
      if (new URL(request.url).pathname === '/redirect') return new Response(null, { status: 302, headers: { Location: '/target' } });
      return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{')); } }));
    } });
    try {
      const url = `http://localhost:${server.port}`;
      expect((await transport.get(`${url}/redirect`)).status).toBe(302);
      await expect(transport.get(`${url}/body`, { signal: AbortSignal.timeout(20) })).rejects.toThrow();
    } finally { server.stop(true); }
  });
});
