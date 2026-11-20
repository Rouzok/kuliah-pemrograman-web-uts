import { transport, tokens } from './oauth.js';
import { failure, success, extractData, retryAfter } from './response.js';

export const ROUTES = {
  '/api/flights': { endpoint: 'flights', params: ['bbox'] },
  '/api/flight': { endpoint: 'flight', params: ['icao24'] },
  '/api/airports': { endpoint: 'airports', params: [] },
};
export async function fetchOpenSky(route, params, env, { http = transport, tokenManager = tokens, timeoutMs = 10000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let retryHeaders = {};
  async function load() {
    const url = new URL('https://opensky-network.org/api/states/all');
    if (route.endpoint === 'flights') {
      const bounds = params.get('bbox').split(',');
      ['lamin', 'lomin', 'lamax', 'lomax'].forEach((key, index) => url.searchParams.set(key, bounds[index]));
    } else url.searchParams.set('icao24', params.get('icao24'));
    let token = await tokenManager.get(env, controller.signal);
    for (let attempt = 0; attempt < 2; attempt++) {
      if (controller.signal.aborted) throw 504;
      const response = await http.get(url.href, { signal: controller.signal, headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } });
      retryHeaders = retryAfter(response.headers);
      if (response.status === 401) {
        tokenManager.invalidate(token);
        if (attempt === 1) throw 503;
        token = await tokenManager.get(env, controller.signal);
        continue;
      }
      if ([401, 403].includes(response.status)) throw 503;
      if (response.status === 429) throw 429;
      if ([408, 504].includes(response.status)) throw 504;
      if (response.status !== 200) throw 502;
      return success(extractData(response.data, route, params), response.data.time);
    }
  }
  try {
    return await Promise.race([
      load(),
      new Promise((_, reject) => {
        controller.signal.addEventListener('abort', () => reject(504), { once: true });
      }),
    ]);
  } catch (error) {
    return failure(controller.signal.aborted ? 504 : [429, 502, 503, 504].includes(error) ? error : 502, retryHeaders);
  } finally {
    clearTimeout(timer);
  }
}
