import { describe, expect, test } from 'bun:test';
import { ApiError, createApiClient, getSavedFlightIdentifier } from './client.js';

const START = Date.parse('2026-10-27T10:00:00Z');
const envelope = (data, timestamp = START) => ({
  data, meta: { fetchedAt: new Date(timestamp).toISOString(), source: 'airlabs' },
});
const json = (data, options) => Response.json(data, options);
const deferred = () => Promise.withResolvers();

function setup(handler = () => json(envelope([])), options = {}) {
  let time = START;
  const calls = [];
  const client = createApiClient({
    baseURL: 'http://localhost:8787/',
    now: () => time,
    fetch: (url, init) => { calls.push({ url, init }); return handler(url, init); },
    ...options,
  });
  return { client, calls, advance: (ms) => { time += ms; } };
}

describe('proxy contract and validation', () => {
  test('uses fixed normalized proxy URLs with no credentials or browser HTTP cache', async () => {
    const { client, calls } = setup((url) => json(envelope(url.includes('/api/flight?') ? null : [])));
    await client.getFlights({ zoom: 5, bbox: [-10, 95, 6, 141] });
    await client.getFlight({ flight_icao: ' gia123 ' });
    await client.getAirports({ country_code: ' id ' });
    await client.getAirports();
    expect(calls.map(({ url }) => url)).toEqual([
      'http://localhost:8787/api/flights?bbox=-10%2C95%2C6%2C141&zoom=5',
      'http://localhost:8787/api/flight?flight_icao=GIA123',
      'http://localhost:8787/api/airports?country_code=ID',
      'http://localhost:8787/api/airports',
    ]);
    for (const { init } of calls) {
      expect(init).toMatchObject({ method: 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store' });
      expect(init.headers).toEqual({ Accept: 'application/json' });
      expect(init.signal).toBeInstanceOf(AbortSignal);
    }
  });

  test('rejects bad inputs before network access', async () => {
    const { client, calls } = setup();
    for (const input of [{}, null, [], { flight_iata: 'A' }, { flight_iata: 'GA-123' },
      { flight_iata: 'GA123', flight_icao: 'GIA123' }, { flight_iata: 'GA123', api_key: 'forbidden' }]) {
      await expect(client.getFlight(input)).rejects.toMatchObject({ code: 'BAD_INPUT' });
    }
    for (const input of [{}, { bbox: [0, 0, 0, 1] }, { bbox: [-91, 0, 1, 2] },
      { bbox: [0, 170, 10, -170] }, { bbox: [0, 0, Infinity, 1] },
      { bbox: [0, 0, 1, 181] }, { bbox: '0,0,1,2' }, { bbox: ['0', 0, 1, 2] },
      { bbox: [false, 0, 1, 2] },
      { bbox: [0, 0, 1, 2], zoom: 12 }, { bbox: [0, 0, 1, 2], zoom: 1.5 },
      { bbox: [0, 0, 1, 2], search: 'GA' }]) {
      await expect(client.getFlights(input)).rejects.toMatchObject({ code: 'BAD_INPUT' });
    }
    for (const input of [{ country_code: 'IDN' }, { country_code: 12 }, { url: 'https://airlabs.co' }]) {
      await expect(client.getAirports(input)).rejects.toMatchObject({ code: 'BAD_INPUT' });
    }
    expect(calls).toHaveLength(0);
  });

  test('requires an origin-only configuration and never falls back to AirLabs', async () => {
    for (const baseURL of [undefined, '', 'relative', 'ftp://example.com',
      'https://user:pass@example.com', 'https://example.com/api',
      'https://example.com?api_key=bad', 'https://example.com/#fragment']) {
      const { client, calls } = setup(undefined, { baseURL });
      await expect(client.getAirports()).rejects.toMatchObject({ code: 'CONFIGURATION' });
      expect(calls).toHaveLength(0);
    }
  });

  test('keeps normalized explicit bookmark identifiers and rejects ambiguous legacy ids', () => {
    expect(getSavedFlightIdentifier({ id: 'legacy', code: ' ga123 ', identifierType: 'flight_iata' }))
      .toEqual({ code: 'GA123', identifierType: 'flight_iata' });
    expect(getSavedFlightIdentifier({ flight_icao: ' gia123 ' }))
      .toEqual({ code: 'GIA123', identifierType: 'flight_icao' });
    expect(getSavedFlightIdentifier({ flight_iata: 'GA123', flight_icao: 'GIA123' }).identifierType).toBe('flight_iata');
    for (const value of [null, { id: 'GA123' }, { code: 'GA123' },
      { code: 'GA123', identifierType: 'hex' }, { flight_iata: 'bad!' }]) {
      expect(() => getSavedFlightIdentifier(value)).toThrow(ApiError);
    }
  });
});

describe('shared requests and cache freshness', () => {
  test('deduplicates canonical requests and gives consumers independent data', async () => {
    const response = deferred();
    const { client, calls } = setup(() => response.promise);
    const first = client.getFlight({ flight_iata: ' ga123 ' });
    const second = client.getFlight({ flight_iata: 'GA123' });
    expect(calls).toHaveLength(1);
    response.resolve(json(envelope({ flight_iata: 'GA123', alt: 0 })));
    const [a, b] = await Promise.all([first, second]);
    expect(a).toEqual(b);
    a.data.alt = 100;
    expect(b.data.alt).toBe(0);
    expect((await client.getFlight({ flight_iata: 'GA123' })).data.alt).toBe(0);
    expect(calls).toHaveLength(1);
  });

  test('flights expire 30 seconds after fetchedAt, not after browser receipt', async () => {
    const { client, calls, advance } = setup(() => json(envelope([], START - 20000)));
    const params = { bbox: [-10, 95, 6, 141] };
    const result = await client.getFlights(params);
    advance(9999);
    expect(await client.getFlights(params)).toEqual(result);
    expect(calls).toHaveLength(1);
    advance(1);
    await client.getFlights(params);
    await client.getFlights(params);
    expect(calls).toHaveLength(3); // An already-expired proxy response is not recached.
  });

  test('caches empty airports for 24 hours and null details for 30 seconds', async () => {
    const { client, calls, advance } = setup((url) => json(envelope(url.includes('/api/flight?') ? null : [])));
    const result = await client.getAirports();
    expect(result.data).toEqual([]);
    expect((await client.getFlight({ flight_iata: 'GA123' })).data).toBeNull();
    await client.getFlight({ flight_iata: 'GA123' });
    expect(calls).toHaveLength(2);
    advance(30000);
    await client.getFlight({ flight_iata: 'GA123' });
    advance(86400000 - 30001);
    expect(await client.getAirports()).toEqual(result);
    expect(calls).toHaveLength(3);
    advance(1);
    await client.getAirports();
    expect(calls).toHaveLength(4);
  });

  test('does not cache failures or turn them into empty successes', async () => {
    let fail = true;
    const { client, calls } = setup(() => fail ? json({ error: {} }, { status: 502 }) : json(envelope([])));
    await expect(client.getAirports()).rejects.toMatchObject({ code: 'UNAVAILABLE', status: 502 });
    fail = false;
    expect((await client.getAirports()).data).toEqual([]);
    expect(calls).toHaveLength(2);
  });

  test('one consumer abort never cancels another consumer or a later selection', async () => {
    const response = deferred();
    const { client, calls } = setup(() => response.promise);
    const controller = new AbortController();
    const first = client.getFlight({ flight_iata: 'GA123' }, { signal: controller.signal });
    const second = client.getFlight({ flight_iata: 'GA123' });
    controller.abort();
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    expect(calls[0].init.signal.aborted).toBe(false);
    response.resolve(json(envelope({ flight_iata: 'GA123' })));
    expect((await second).data.flight_iata).toBe('GA123');
    expect(calls).toHaveLength(1);
  });

  test('joins an already-pending request even when another endpoint establishes a cooldown', async () => {
    const response = deferred();
    const { client, calls } = setup((url) => url.includes('/api/flight?') ? response.promise :
      json({}, { status: 429, headers: { 'Retry-After': '60' } }));
    const first = client.getFlight({ flight_iata: 'GA123' });
    await expect(client.getAirports()).rejects.toMatchObject({ code: 'QUOTA' });
    const second = client.getFlight({ flight_iata: 'GA123' });
    response.resolve(json(envelope({ flight_iata: 'GA123' })));
    expect(await first).toEqual(await second);
    expect(calls).toHaveLength(2);
  });

  test('cleans up the browser timeout after a successful request', async () => {
    const { client, calls } = setup(undefined, { timeoutMs: 5 });
    await client.getAirports();
    await Bun.sleep(10);
    expect(calls[0].init.signal.aborted).toBe(false);
  });

  test('an already-aborted caller does no work, including cached reads', async () => {
    const { client, calls } = setup();
    const signal = AbortSignal.abort();
    await expect(client.getAirports({}, { signal })).rejects.toMatchObject({ name: 'AbortError' });
    expect(calls).toHaveLength(0);
  });
});

describe('safe errors and Retry-After', () => {
  test('maps status errors without trusting provider messages or metadata', async () => {
    for (const [status, code] of [[400, 'BAD_INPUT'], [403, 'ACCESS_DENIED'],
      [404, 'UNAVAILABLE'], [405, 'UNAVAILABLE'], [429, 'QUOTA'], [503, 'CONFIGURATION'],
      [504, 'TIMEOUT'], [502, 'UNAVAILABLE']]) {
      const { client } = setup(() => json({ error: { code: 'unsafe', message: 'secret-key-provider-url' } }, { status }));
      const error = await client.getAirports().catch((value) => value);
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ code, status, retryAt: null });
      expect(error.message).not.toContain('secret-key-provider-url');
    }
  });

  test('rejects malformed successes and preserves the difference from empty', async () => {
    for (const body of [{}, { data: [] }, envelope(null), envelope([null]), envelope([1]),
      { ...envelope([]), error: {} }, { data: [], meta: { source: 'airlabs', fetchedAt: 'invalid' } },
      { data: [], meta: { source: 'other', fetchedAt: new Date(START).toISOString() } }]) {
      const { client } = setup(() => json(body));
      await expect(client.getAirports()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    }
    const { client } = setup(() => new Response('<html>secret</html>'));
    await expect(client.getAirports()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    const detail = setup(() => json(envelope([])));
    await expect(detail.client.getFlight({ flight_iata: 'GA123' })).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  test('sanitizes network failures and aborts timed-out requests', async () => {
    const network = setup(() => { throw new Error('credential-bearing-url'); });
    await expect(network.client.getAirports()).rejects.toMatchObject({ code: 'NETWORK', status: null });
    const { client, calls } = setup((url, { signal }) => new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('timeout', 'AbortError')), { once: true });
    }), { timeoutMs: 5 });
    await expect(client.getAirports()).rejects.toMatchObject({ code: 'TIMEOUT' });
    expect(calls[0].init.signal.aborted).toBe(true);
    await expect(client.getAirports()).rejects.toMatchObject({ code: 'TIMEOUT' });
    expect(calls).toHaveLength(2);
  });

  test('also times out while reading the response body', async () => {
    const { client } = setup((url, { signal }) => ({
      ok: true, status: 200,
      json: () => new Promise((resolve, reject) => signal.addEventListener('abort',
        () => reject(new DOMException('timeout', 'AbortError')), { once: true })),
    }), { timeoutMs: 5 });
    await expect(client.getAirports()).rejects.toMatchObject({ code: 'TIMEOUT' });
  });

  for (const header of ['60', new Date(START + 60000).toUTCString()]) {
    test(`shares cooldown for Retry-After ${header}, without automatic retries`, async () => {
      let fail = false;
      const { client, calls, advance } = setup(() => fail ?
        json({ error: {} }, { status: 429, headers: { 'Retry-After': header } }) : json(envelope([])));
      await client.getAirports();
      fail = true;
      await expect(client.getFlight({ flight_iata: 'GA123' })).rejects.toMatchObject({ code: 'QUOTA', retryAt: START + 60000 });
      await client.getAirports(); // Fresh cache is still accessible during cooldown.
      await expect(client.getAirports({ country_code: 'ID' })).rejects.toMatchObject({ code: 'QUOTA', retryAt: START + 60000 });
      advance(59999);
      await expect(client.getFlight({ flight_iata: 'GA456' })).rejects.toMatchObject({ code: 'QUOTA' });
      expect(calls).toHaveLength(2);
      advance(1);
      expect(calls).toHaveLength(2); // Time passing never starts a request.
      fail = false;
      await client.getAirports({ country_code: 'ID' });
      expect(calls).toHaveLength(3);
    });
  }

  test('missing or invalid Retry-After invents no cooldown; 503 can also carry a cooldown', async () => {
    for (const header of ['', '-1', 'nonsense', '1.5', '9999999999999999999999999']) {
      const { client, calls } = setup(() => json({}, { status: 429, headers: { 'Retry-After': header } }));
      await expect(client.getAirports()).rejects.toMatchObject({ code: 'QUOTA', retryAt: null });
      await expect(client.getAirports()).rejects.toMatchObject({ code: 'QUOTA' });
      expect(calls).toHaveLength(2);
    }
    const { client, calls } = setup(() => json({}, { status: 503, headers: { 'Retry-After': '10' } }));
    await expect(client.getAirports()).rejects.toMatchObject({ code: 'CONFIGURATION', retryAt: START + 10000 });
    await expect(client.getFlight({ flight_iata: 'GA123' })).rejects.toMatchObject({ code: 'CONFIGURATION' });
    expect(calls).toHaveLength(1);
  });
});
