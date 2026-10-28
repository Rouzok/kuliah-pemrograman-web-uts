// Run under Node while local Wrangler is running. Never print live records or secrets.
import assert from 'node:assert/strict';

const base = 'http://localhost:8787';
const origin = 'http://localhost:5173';
const checks = [
  ['GET', '/api/airports', 503, { Origin: origin }],
  ['GET', '/api/flight?flight_iata=GA123', 400, { Origin: origin }],
  ['GET', '/api/flight?icao24=abc123', 403, { Origin: 'https://denied.example' }],
  ['OPTIONS', '/api/flights', 204, { Origin: origin, 'Access-Control-Request-Method': 'GET', 'Access-Control-Request-Headers': 'Accept, Content-Type' }],
];
for (const [method, path, status, headers] of checks) {
  const result = await fetch(base + path, { method, headers, signal: AbortSignal.timeout(15000), redirect: 'error' });
  assert.equal(result.status, status);
  assert.equal(result.headers.get('Cache-Control'), 'no-store');
  assert.equal(result.headers.get('Vary'), 'Origin');
  if (status !== 403) assert.equal(result.headers.get('Access-Control-Allow-Origin'), origin);
  if (status !== 204) assert.equal(typeof (await result.json()).error.code, 'string');
  console.log(`${method} ${path}: ${status}; headers/envelope verified`);
}

// One small viewport; at most one returned-aircraft lookup. No quota retry loop.
const viewport = await fetch(`${base}/api/flights?bbox=-6.3,106.6,-6.0,107.0`, {
  headers: { Origin: origin }, signal: AbortSignal.timeout(15000), redirect: 'error',
});
assert.equal(viewport.headers.get('Access-Control-Allow-Origin'), origin);
if (viewport.status === 503) {
  assert.equal((await viewport.json()).error.code, 'CONFIGURATION_ERROR');
  console.log('Worker missing-configuration response verified; live OpenSky authentication/coverage unverified.');
} else {
  assert.equal(viewport.status, 200, 'Live viewport check failed; do not treat errors as missing coverage.');
  const body = await viewport.json();
  assert.equal(body.meta.source, 'opensky');
  assert.ok(Number.isInteger(body.meta.snapshotTime));
  assert.ok(Array.isArray(body.data));
  console.log(`Live small viewport: ${body.data.length} sanitized aircraft; no records printed.`);
  if (body.data.length) {
    const aircraft = await fetch(`${base}/api/flight?icao24=${body.data[0].icao24}`, {
      headers: { Origin: origin }, signal: AbortSignal.timeout(15000), redirect: 'error',
    });
    assert.equal(aircraft.status, 200);
    const detail = await aircraft.json();
    assert.ok(detail.data === null || detail.data.icao24 === body.data[0].icao24);
    console.log(detail.data === null ? 'Returned aircraft no longer covered; null preserved.' : 'Live returned-aircraft lookup verified.');
  } else console.log('Aircraft lookup unverified: small viewport returned no aircraft.');
}
