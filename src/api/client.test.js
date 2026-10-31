import { describe, expect, test, afterEach } from 'bun:test';
import axios from 'axios';
import { ApiError, createApiClient, getSavedFlightIdentifier } from './client.js';
import { getSavedFlights, saveFlight, removeFlight } from '../utils/storage.js';
import { metersToFeet, metersPerSecondToKnots, groundState } from '../utils/aircraft.js';

const START = Date.parse('2026-10-27T10:00:00Z');
const aircraft = { icao24: 'abc123', callsign: 'GIA1', origin_country: 'Indonesia', time_position: 0,
  last_contact: 0, longitude: null, latitude: null, baro_altitude: 0, on_ground: false,
  velocity: 0, true_track: 0, vertical_rate: null, geo_altitude: null };
const envelope = (data = [], time = START) => ({ data, meta: { fetchedAt: new Date(time).toISOString(), source: 'opensky', snapshotTime: 0 } });
const reply = (data = envelope(), status = 200, headers = {}) => ({ data, status, headers: new axios.AxiosHeaders(headers) });
function setup(handler = () => reply(), options = {}) {
  let time = START;
  const calls = [];
  const client = createApiClient({ baseURL: 'http://localhost:8787', now: () => time,
    adapter: async (config) => { calls.push(config); return handler(config); }, ...options });
  return { client, calls, advance: (ms) => { time += ms; } };
}
const detail = { icao24: 'abc123' };
const bounds = { bbox: [-10, 95, 6, 141] };

describe('public client contract', () => {
  test('normalizes queries and explicitly configures transport', async () => {
    const { client, calls } = setup(() => reply(envelope(null)));
    await client.getFlight({ icao24: ' ABC123 ' });
    expect(calls[0].url).toBe('http://localhost:8787/api/flight?icao24=abc123');
    expect(calls[0].fetchOptions).toEqual({ credentials: 'omit', redirect: 'error', cache: 'no-store' });
    expect(calls[0].withCredentials).toBe(false);
  });
  test('rejects unknown, old, malformed and unsplit antimeridian inputs before I/O', async () => {
    const { client, calls } = setup();
    for (const params of [null, {}, [], { icao24: '12345' }, { icao24: 'xyz123' }, { flight_iata: 'GA123' },
      { icao24: 'abc123', flight_icao: 'GIA1' }, { icao24: 123456 }]) await expect(client.getFlight(params)).rejects.toMatchObject({ code: 'BAD_INPUT' });
    for (const params of [{}, { ...bounds, zoom: 5 }, { bbox: [0, 170, 1, -170] }, { bbox: [0, 0, 0, 1] },
      { bbox: [-91, 0, 1, 2] }, { bbox: [0, 0, NaN, 1] }, { bbox: [0, 0, 1, 181] }, { bbox: '0,0,1,2' }])
      await expect(client.getFlights(params)).rejects.toMatchObject({ code: 'BAD_INPUT' });
    await expect(client.getAirports({ country_code: 'ID' })).rejects.toMatchObject({ code: 'BAD_INPUT' });
    expect(calls).toHaveLength(0);
  });
  test('requires an origin-only proxy configuration', async () => {
    for (const baseURL of [undefined, '', 'relative', 'ftp://example.com', 'https://user:pass@example.com', 'https://example.com/api', 'https://example.com?q=1']) {
      const { client, calls } = setup(undefined, { baseURL });
      await expect(client.getAirports()).rejects.toMatchObject({ code: 'CONFIGURATION' });
      expect(calls).toHaveLength(0);
    }
  });
  test('rejects malformed success metadata and aircraft while preserving empty/null', async () => {
    for (const body of [{}, envelope(null), envelope([{}]), envelope([{ ...aircraft, on_ground: 0 }]),
      envelope([{ ...aircraft, latitude: 100 }]), { ...envelope(), error: {} },
      { data: [], meta: { fetchedAt: 'bad', source: 'opensky', snapshotTime: 0 } },
      { data: [], meta: { ...envelope().meta, source: 'airlabs' } }]) {
      await expect(setup(() => reply(body)).client.getFlights(bounds)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    }
    expect((await setup().client.getFlights(bounds)).data).toEqual([]);
    expect((await setup(() => reply(envelope(null))).client.getFlight(detail)).data).toBeNull();
  });
});
describe('freshness, deduplication and cancellation', () => {
  test('shares pending requests and returns independent copies', async () => {
    const pending = Promise.withResolvers();
    const { client, calls } = setup(() => pending.promise);
    const a = client.getFlight(detail), b = client.getFlight({ icao24: 'ABC123' });
    pending.resolve(reply(envelope(aircraft)));
    const [one, two] = await Promise.all([a, b]);
    one.data.velocity = 100;
    expect(two.data.velocity).toBe(0);
    expect((await client.getFlight(detail)).data.velocity).toBe(0);
    expect(calls).toHaveLength(1);
  });
  test('expires from original fetchedAt and never caches failures', async () => {
    const { client, calls, advance } = setup(() => reply(envelope([], START - 20000)));
    await client.getFlights(bounds); advance(9999); await client.getFlights(bounds);
    expect(calls).toHaveLength(1);
    advance(1); await client.getFlights(bounds); await client.getFlights(bounds);
    expect(calls).toHaveLength(3);
    const failed = setup(() => reply({}, 503));
    await expect(failed.client.getAirports()).rejects.toMatchObject({ code: 'CONFIGURATION' });
    await expect(failed.client.getAirports()).rejects.toMatchObject({ code: 'CONFIGURATION' });
    expect(failed.calls).toHaveLength(2);
  });
  test('caller cancellation leaves shared transport and subsequent selection usable', async () => {
    const pending = Promise.withResolvers();
    const { client, calls } = setup(() => pending.promise);
    const controller = new AbortController();
    const obsolete = client.getFlight(detail, { signal: controller.signal });
    const active = client.getFlight(detail);
    controller.abort();
    await expect(obsolete).rejects.toMatchObject({ name: 'AbortError' });
    expect(calls[0].signal.aborted).toBe(false);
    pending.resolve(reply(envelope(aircraft)));
    expect((await active).data.icao24).toBe('abc123');
    await expect(client.getFlight(detail, { signal: AbortSignal.abort() })).rejects.toMatchObject({ name: 'AbortError' });
    expect(calls).toHaveLength(1);
  });
  test('timeouts are safe and timers clear after success', async () => {
    const { client, calls } = setup(({ signal }) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('unsafe')))), { timeoutMs: 5 });
    await expect(client.getFlights(bounds)).rejects.toMatchObject({ code: 'TIMEOUT' });
    expect(calls[0].signal.aborted).toBe(true);
    const success = setup(undefined, { timeoutMs: 5 });
    await success.client.getFlights(bounds); await Bun.sleep(10);
    expect(success.calls[0].signal.aborted).toBe(false);
  });
});
describe('safe errors and cooldown', () => {
  test('maps statuses and discards unsafe errors', async () => {
    for (const [status, code] of [[400, 'BAD_INPUT'], [403, 'ACCESS_DENIED'], [429, 'QUOTA'], [503, 'CONFIGURATION'], [504, 'TIMEOUT'], [500, 'UNAVAILABLE']]) {
      const error = await setup(() => reply({ error: { message: 'secret' } }, status)).client.getAirports().catch((e) => e);
      expect(error).toBeInstanceOf(ApiError); expect(error.code).toBe(code); expect(error.message).not.toContain('secret');
    }
    await expect(setup(() => { throw new Error('secret'); }).client.getAirports()).rejects.toMatchObject({ code: 'NETWORK' });
  });
  for (const header of ['60', new Date(START + 60000).toUTCString()]) test(`cooldown ${header} permits cached/pending work without retry timers`, async () => {
    const pending = Promise.withResolvers();
    let quota = false;
    const { client, calls, advance } = setup(({ url }) => url.includes('/api/flight?') ? pending.promise : quota ? reply({}, 429, { 'Retry-After': header }) : reply());
    await client.getFlights(bounds);
    const a = client.getFlight(detail);
    quota = true;
    await expect(client.getAirports()).rejects.toMatchObject({ code: 'QUOTA', retryAt: START + 60000 });
    const b = client.getFlight(detail);
    await client.getFlights(bounds);
    await expect(client.getFlight({ icao24: 'def456' })).rejects.toMatchObject({ code: 'QUOTA' });
    pending.resolve(reply(envelope(aircraft))); expect(await a).toEqual(await b);
    advance(60000); expect(calls).toHaveLength(3);
    quota = false; await client.getAirports(); expect(calls).toHaveLength(4);
  });
  test('invalid retry headers create no cooldown', async () => {
    for (const header of ['', '-1', '1.5', 'bad', '999999999999999999999999']) {
      const { client, calls } = setup(() => reply({}, 429, { 'Retry-After': header }));
      await expect(client.getAirports()).rejects.toMatchObject({ retryAt: null });
      await expect(client.getAirports()).rejects.toMatchObject({ retryAt: null });
      expect(calls).toHaveLength(2);
    }
  });
});

describe('aircraft identity and presentation', () => {
  const originals = { localStorage: globalThis.localStorage, window: globalThis.window };
  afterEach(() => { globalThis.localStorage = originals.localStorage; globalThis.window = originals.window; });
  function storage(initial = []) {
    let value = JSON.stringify(initial);
    globalThis.localStorage = { getItem: () => value, setItem: (_, next) => { value = next; } };
    globalThis.window = new EventTarget();
  }
  test('normalizes/deduplicates ICAO24 and keeps legacy entries removable', () => {
    storage([{ id: 'GA123', code: 'GA123', identifierType: 'flight_iata' }]);
    saveFlight({ icao24: ' ABC123 ', callsign: ' GIA1 ' });
    saveFlight({ icao24: 'abc123' });
    expect(getSavedFlights()).toHaveLength(2);
    expect(getSavedFlights()[1]).toEqual({ id: 'icao24:abc123', code: 'abc123', identifierType: 'icao24', callsign: 'GIA1' });
    expect(getSavedFlightIdentifier(getSavedFlights()[1])).toEqual({ code: 'abc123', identifierType: 'icao24' });
    expect(() => getSavedFlightIdentifier(getSavedFlights()[0])).toThrow(ApiError);
    expect(() => saveFlight({ flight_iata: 'GA123' })).toThrow(ApiError);
    removeFlight('GA123'); expect(getSavedFlights()).toHaveLength(1);
  });
  test('handles corrupt/denied storage without overwriting records', () => {
    storage();
    globalThis.localStorage.getItem = () => '{bad';
    expect(() => getSavedFlights()).toThrow(); expect(() => saveFlight(aircraft)).toThrow();
    globalThis.localStorage.getItem = () => JSON.stringify([null, 1, { id: 'legacy' }]);
    expect(getSavedFlights()).toEqual([{ id: 'legacy' }]);
    globalThis.localStorage.setItem = () => { throw new Error('denied'); };
    expect(() => removeFlight('legacy')).toThrow();
    expect(getSavedFlights()).toHaveLength(1);
    globalThis.localStorage.getItem = () => { throw new Error('denied'); };
    expect(() => getSavedFlights()).toThrow();
  });
  test('converts provider units, preserves zero and distinguishes ground booleans', () => {
    expect(metersToFeet(304.8)).toBeCloseTo(1000);
    expect(metersPerSecondToKnots(1852 / 3600)).toBeCloseTo(1);
    expect(metersToFeet(0)).toBe(0); expect(metersToFeet(null)).toBeNull();
    expect(metersPerSecondToKnots(null)).toBeNull();
    expect(groundState(false)).toBe('Airborne'); expect(groundState(true)).toBe('Ground (reported)');
  });
});

test('real Axios Fetch adapter rejects redirects and times out response bodies', async () => {
  const server = Bun.serve({ port: 0, fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/api/flight') return new Response(null, { status: 302, headers: { Location: '/target' } });
    return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{')); } }));
  } });
  try {
    const client = createApiClient({ baseURL: `http://localhost:${server.port}`, timeoutMs: 30 });
    await expect(client.getFlight(detail)).rejects.toMatchObject({ code: 'NETWORK' });
    await expect(client.getFlights(bounds)).rejects.toMatchObject({ code: 'TIMEOUT' });
  } finally { server.stop(true); }
});
