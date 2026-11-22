import { afterAll, afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createServerApp } from './index.js';
import { createApiClient } from '../../client/src/api/client.js';

const root = await mkdtemp(join(tmpdir(), 'flight-tracker-static-'));
await mkdir(join(root, 'assets'));
await writeFile(join(root, 'index.html'), '<!doctype html><title>Flight Tracker test</title>');
await writeFile(join(root, 'assets', 'app.js'), 'console.log("fixture");');
const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

afterAll(() => rm(root, { recursive: true, force: true }));

describe('combined Bun server', () => {
  test('SPA routes and assets work; missing assets and API errors never receive fallback HTML', async () => {
    globalThis.fetch = async (url, init) => {
      if (String(url).includes('airportsapi.com')) {
        return new Response(
          JSON.stringify([{ name: 'Juanda International Airport', iata: 'SUB', icao: 'WARR', country: 'Indonesia', latitude: -7.37983, longitude: 112.787 }]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return originalFetch(url, init);
    };

    const app = createServerApp({ staticRoot: root, env: { ALLOWED_ORIGINS: 'http://localhost:5273' }, getPeerAddress: () => '192.0.2.1' });
    for (const path of ['/', '/about', '/contact', '/map', '/map/', '/map/airports', '/map/saved']) {
      const result = await app.request('http://local' + path);
      expect(result.status).toBe(200);
      expect(result.headers.get('Content-Type')).toContain('text/html');
      expect(await result.text()).toContain('Flight Tracker test');
    }
    const asset = await app.request('http://local/assets/app.js');
    expect(asset.status).toBe(200);
    expect(asset.headers.get('Content-Type')).toContain('javascript');
    for (const path of ['/assets/missing.js', '/favicon.ico', '/.env', '/server/.env', '/src/index.js']) {
      expect((await app.request('http://local' + path)).status).toBe(404);
    }
    for (const [path, expected] of [
      ['/api', 404],
      ['/api/missing', 404],
      ['/api/flights/', 404],
      ['/api/flights', 400],
      ['/api/airports', 200],
    ]) {
      const result = await app.request('http://local' + path, { headers: { Origin: 'http://localhost:5273' } });
      expect(result.status).toBe(expected);
      expect(result.headers.get('Content-Type')).toContain('application/json');
      expect(result.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:5273');
      if (expected >= 400) {
        expect((await result.json()).error.code).toBeString();
      }
    }
  });
  test('real Bun connection IP and browser Axios transport work without Cloudflare headers', async () => {
    globalThis.fetch = async (url, init) => {
      if (String(url).includes('airportsapi.com')) {
        return new Response(
          JSON.stringify([{ name: 'Juanda International Airport', iata: 'SUB', icao: 'WARR', country: 'Indonesia', latitude: -7.37983, longitude: 112.787 }]),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return originalFetch(url, init);
    };

    const app = createServerApp({ staticRoot: root, env: { ALLOWED_ORIGINS: 'http://localhost:5273' } });
    const server = Bun.serve({ port: 0, hostname: '127.0.0.1', fetch: app.fetch });
    try {
      const baseURL = server.url.origin;
      const client = createApiClient({ baseURL });
      const airports = await client.getAirports();
      expect(airports.meta.source).toBe('airportsapi');
      expect(airports.data).toHaveLength(1);
      const preflight = await fetch(baseURL + '/api/flight', {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:5273',
          'Access-Control-Request-Method': 'GET',
        },
      });
      expect(preflight.status).toBe(204);
      expect(preflight.headers.get('Cache-Control')).toBe('no-store');
      // 60 GETs per IP; preflight and invalid queries do not consume a slot.
      for (let i = 1; i < 60; i++) expect((await fetch(baseURL + '/api/airports')).status).toBe(200);
      const limited = await fetch(baseURL + '/api/airports');
      expect(limited.status).toBe(429);
      expect(limited.headers.get('Retry-After')).toBe('60');
      expect((await fetch(baseURL + '/map/saved')).status).toBe(200);
    } finally {
      server.stop(true);
    }
  });
});