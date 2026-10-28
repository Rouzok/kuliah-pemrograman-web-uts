import { ROUTES, fetchOpenSky } from './opensky.js';
import { validateQuery } from './validation.js';
import { failure } from './response.js';

export async function handleRequest(request, env, ctx) {
  const origin = request.headers.get('Origin');
  const allowed =
    typeof env?.ALLOWED_ORIGINS === 'string'
      ? env.ALLOWED_ORIGINS.split(',')
          .map((value) => value.trim())
          .filter(Boolean)
      : [];
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
  const url = new URL(request.url);
  const route = Object.hasOwn(ROUTES, url.pathname) ? ROUTES[url.pathname] : null;
  if (!route) return finish(failure(404));
  if (!['GET', 'OPTIONS'].includes(request.method)) return finish(failure(405, { Allow: 'GET, OPTIONS' }));
  if (request.method === 'OPTIONS') {
    const method = request.headers.get('Access-Control-Request-Method');
    const headers =
      request.headers
        .get('Access-Control-Request-Headers')
        ?.split(',')
        .map((value) => value.trim().toLowerCase()) ?? [];
    if (!origin || method !== 'GET' || headers.some((value) => !['accept', 'content-type'].includes(value))) return finish(failure(400));
    return finish(
      new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Methods': 'GET',
          'Access-Control-Allow-Headers': 'Accept, Content-Type',
        },
      }),
    );
  }
  let params;
  try {
    params = validateQuery(url.searchParams, route);
  } catch {
    return finish(failure(400));
  }
  try {
    if (!env?.RATE_LIMITER?.limit) return finish(failure(503));
    const ip = request.headers.get('CF-Connecting-IP');
    if (!ip) return finish(failure(503));
    const result = await env.RATE_LIMITER.limit({ key: ip });
    if (result?.success === false) return finish(failure(429, { 'Retry-After': '60' }));
    if (result?.success !== true) return finish(failure(503));
  } catch {
    return finish(failure(503));
  }
  if (route.endpoint === 'airports') return finish(failure(503));
  const key = new URL(`/__cache/opensky-v1${url.pathname}`, url.origin);
  for (const [name, value] of [...params].sort()) key.searchParams.set(name, value);
  const cache = globalThis.caches?.default;
  try {
    const hit = await cache?.match(new Request(key));
    if (hit) {
      const body = await hit.clone().json();
      if (Date.parse(body.meta?.fetchedAt) + 30000 > Date.now()) return finish(hit);
    }
  } catch {
    /* Cache failure leaves provider access available. */
  }
  const response = await fetchOpenSky(route, params, env);
  if (response.ok && cache) {
    const headers = new Headers(response.headers);
    headers.set('Cache-Control', 'public, max-age=30');
    const write = cache.put(new Request(key), new Response(response.clone().body, { headers })).catch(() => {});
    if (ctx?.waitUntil) ctx.waitUntil(write);
    else await write;
  }
  return finish(response);
}
export default { fetch: handleRequest };
