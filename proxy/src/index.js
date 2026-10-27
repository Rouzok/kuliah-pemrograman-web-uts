import { ROUTES, fetchAirlabs } from './airlabs.js';
import { validateQuery } from './validation.js';
import { failure } from './response.js';

/** Fetch handler kept separate from frontend code; tests supply a dummy env and mock Fetch. */
export async function handleRequest(request, env) {
  const url = new URL(request.url);
  const route = Object.hasOwn(ROUTES, url.pathname) ? ROUTES[url.pathname] : null;
  if (!route) return failure(404);
  if (!['GET', 'OPTIONS'].includes(request.method)) return failure(405, { Allow: 'GET, OPTIONS' });
  // T06 will add exact-origin CORS enforcement and response headers.
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });

  let params;
  try {
    params = validateQuery(url.searchParams, route);
  } catch {
    return failure(400);
  }
  if (typeof env?.AIRLABS_API_KEY !== 'string' || !env.AIRLABS_API_KEY.trim()) {
    return failure(503);
  }

  return fetchAirlabs(route, params, env.AIRLABS_API_KEY);
}

export default { fetch: handleRequest };
