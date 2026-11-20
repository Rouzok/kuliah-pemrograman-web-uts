import { Hono } from 'hono';
import { getConnInfo } from '@hono/bun';
import { isIP } from 'node:net';
import { ROUTES, fetchOpenSky } from './opensky.js';
import { validateQuery } from './validation.js';
import { failure } from './response.js';
import { createResponseCache } from './cache.js';
import { createRateLimiter } from './rateLimit.js';

export function resolveClientIp(request, peer, trustedProxies = []) {
  if (!isIP(peer ?? '')) return null;
  if (!trustedProxies.includes(peer)) return peer;
  // A trusted immediate proxy must overwrite, rather than append to, this header.
  const forwarded = request.headers.get('X-Forwarded-For')?.trim();
  return isIP(forwarded ?? '') ? forwarded : null;
}

// Tests inject the clock, cache, limiter and connection lookup; no port is opened here.
export function createApp({ env = {}, cache = createResponseCache(), limiter = createRateLimiter(), getPeerAddress = (c) => getConnInfo(c).remote.address, now = Date.now } = {}) {
  const app = new Hono({ strict: true });
  const api = new Hono({ strict: true });
  const allowed = (env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  const trustedProxies = (env.TRUSTED_PROXY_IPS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  api.onError(() => failure(503));
  api.use('*', async (c, next) => {
    const origin = c.req.header('Origin');
    function finish(response) {
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'no-store');
      headers.set('Vary', 'Origin');
      if (origin && allowed.includes(origin)) {
        headers.set('Access-Control-Allow-Origin', origin);
        headers.set('Access-Control-Expose-Headers', 'Retry-After');
      }
      return new Response(response.body, { status: response.status, headers });
    }
    if (origin && !allowed.includes(origin)) return finish(failure(403));
    await next();
    c.res = finish(c.res);
  });

  function endpoint(route) {
    return async (c) => {
      const request = c.req.raw;
      if (!['GET', 'OPTIONS'].includes(request.method)) return failure(405, { Allow: 'GET, OPTIONS' });
      if (request.method === 'OPTIONS') {
        const headers =
          request.headers
            .get('Access-Control-Request-Headers')
            ?.split(',')
            .map((value) => value.trim().toLowerCase()) ?? [];
        if (!request.headers.get('Origin') || request.headers.get('Access-Control-Request-Method') !== 'GET' || headers.some((value) => !['accept', 'content-type'].includes(value))) return failure(400);
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Methods': 'GET',
            'Access-Control-Allow-Headers': 'Accept, Content-Type',
          },
        });
      }

      let params;
      try {
        // URLSearchParams preserves duplicate keys so validation can reject them.
        params = validateQuery(new URL(request.url).searchParams, route);
      } catch {
        return failure(400);
      }
      try {
        const ip = resolveClientIp(request, getPeerAddress(c), trustedProxies);
        if (!ip || !limiter?.limit) return failure(503);
        const result = await limiter.limit({ key: ip });
        if (result?.success === false) return failure(429, { 'Retry-After': '60' });
        if (result?.success !== true) return failure(503);
      } catch {
        return failure(503);
      }
      if (route.endpoint === 'airports') return failure(503);

      const key = 'opensky-v1' + c.req.path + '?' + params.toString();
      try {
        const hit = await cache?.get(key);
        if (hit) {
          const body = await hit.clone().json();
          if (Date.parse(body.meta?.fetchedAt) + 30000 > now()) return hit;
        }
      } catch {
        // A cache failure leaves provider access available.
      }
      const response = await fetchOpenSky(route, params, env);
      if (response.ok) {
        try {
          await cache?.set(key, response);
        } catch {
          // Caching must not turn a successful provider response into an error.
        }
      }
      return response;
    };
  }

  api.all('/flights', endpoint(ROUTES['/api/flights']));
  api.all('/flight', endpoint(ROUTES['/api/flight']));
  api.all('/airports', endpoint(ROUTES['/api/airports']));
  api.all('*', () => failure(404));
  app.route('/api', api);
  app.onError(() => failure(503));
  return app;
}
