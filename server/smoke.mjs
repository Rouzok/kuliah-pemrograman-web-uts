// Default checks never call OpenSky. Opt in with --live for one bounded viewport/detail check.
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';

const base = process.env.SMOKE_BASE_URL || 'http://localhost:8787';
const origin = 'http://localhost:5273';
let ready = false;
for (let attempt = 0; attempt < 30; attempt++) {
  try {
    const result = await fetch(base + '/map/saved', { signal: AbortSignal.timeout(1000), redirect: 'error' });
    if (result.status === 200) {
      assert.match(result.headers.get('Content-Type') || '', /text\/html/);
      await result.arrayBuffer();
      ready = true;
      break;
    }
    await result.arrayBuffer();
  } catch {
    // Allow a short startup delay in CI without issuing aviation-data requests.
  }
  await delay(200);
}
assert.ok(ready, 'Combined server did not become ready; run pnpm build and pnpm start first.');

const checks = [
  ['GET', '/api/airports', 503, {}],
  ['GET', '/api/flight?flight_iata=GA123', 400, {}],
  ['GET', '/api/flight?icao24=abc123', 403, { Origin: 'https://denied.example' }],
  ['GET', '/api/missing', 404, {}],
  ['OPTIONS', '/api/flights', 204, { Origin: origin, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'Accept, Content-Type' }],
];
for (const [method, path, status, headers] of checks) {
  const result = await fetch(base + path, { method, headers, signal: AbortSignal.timeout(15000), redirect: 'error' });
  assert.equal(result.status, status);
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
  assert.equal(result.headers.get('Vary'), 'Origin');
  if (method === 'OPTIONS') assert.equal(result.headers.get('Access-Control-Allow-Origin'), origin);
  if (status !== 204) assert.equal(typeof (await result.json()).error.code, 'string');
  console.log(method + ' ' + path + ': ' + status + '; headers/envelope verified');
}
for (const path of ['/', '/about', '/contact', '/map', '/map/', '/map/airports', '/map/saved']) {
  const result = await fetch(base + path, { signal: AbortSignal.timeout(15000), redirect: 'error' });
  assert.equal(result.status, 200);
  assert.match(result.headers.get('Content-Type') || '', /text\/html/);
  await result.arrayBuffer();
}
assert.equal((await fetch(base + '/assets/missing-smoke.js')).status, 404);
console.log('Frontend direct routes, missing assets and API JSON isolation verified.');

if (!process.argv.includes('--live')) {
  console.log('No provider requests made; live OpenSky authentication/coverage unverified.');
  process.exit(0);
}

// One small viewport; at most one returned-aircraft lookup. No quota retry loop.
const viewport = await fetch(base + '/api/flights?bbox=-6.3,106.6,-6.0,107.0', {
  signal: AbortSignal.timeout(15000),
  redirect: 'error',
});
assert.equal(viewport.status, 200, 'Live viewport check failed; authentication/coverage is unverified.');
const body = await viewport.json();
assert.equal(body.meta.source, 'opensky');
assert.ok(Number.isInteger(body.meta.snapshotTime));
assert.ok(Array.isArray(body.data));
console.log('Live small viewport: ' + body.data.length + ' sanitized aircraft; no records printed.');
if (body.data.length) {
  const aircraft = await fetch(base + '/api/flight?icao24=' + body.data[0].icao24, {
    signal: AbortSignal.timeout(15000),
    redirect: 'error',
  });
  assert.equal(aircraft.status, 200);
  const detail = await aircraft.json();
  assert.ok(detail.data === null || detail.data.icao24 === body.data[0].icao24);
  console.log(detail.data === null ? 'Returned aircraft no longer covered; null preserved.' : 'Live returned-aircraft lookup verified.');
} else console.log('Aircraft lookup unverified: small viewport returned no aircraft.');
