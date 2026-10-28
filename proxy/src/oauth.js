import axios from 'axios';

export const transport = axios.create({
  adapter: 'fetch',
  validateStatus: () => true,
  responseType: 'json',
  withCredentials: false,
  fetchOptions: { redirect: 'manual', credentials: 'omit', cache: 'no-store' },
});
const TOKEN_URL = 'https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token';

// One manager per isolate. The factory permits isolated adapter/clock tests.
export function createTokenManager(http = transport, now = Date.now) {
  let cached = null;
  let pending = null;
  let credentials = null;
  return {
    invalidate(token) {
      if (cached?.token === token) cached = null;
    },
    async get(env, signal) {
      const { OPENSKY_CLIENT_ID: id, OPENSKY_CLIENT_SECRET: secret } = env;
      if (typeof id !== 'string' || !id.trim() || typeof secret !== 'string' || !secret.trim()) throw 503;
      if (credentials && (credentials.id !== id || credentials.secret !== secret)) {
        cached = null;
        pending = null;
      }
      credentials = { id, secret };
      if (cached && cached.expiresAt > now()) return cached.token;
      if (!pending) {
        const acquisition = http
          .post(
            TOKEN_URL,
            new URLSearchParams({
              grant_type: 'client_credentials',
              client_id: id,
              client_secret: secret,
            }).toString(),
            { signal, headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' } },
          )
          .then(({ status, data }) => {
            if (status !== 200 || !data || typeof data.access_token !== 'string' || !/^[\x21-\x7e]+$/.test(data.access_token) || typeof data.expires_in !== 'number' || !Number.isFinite(data.expires_in) || data.expires_in <= 0) throw 503;
            const token = { token: data.access_token, expiresAt: now() + Math.max(0, data.expires_in - 30) * 1000 };
            if (credentials.id === id && credentials.secret === secret) cached = token;
            return token.token;
          })
          .catch(() => {
            throw signal.aborted ? 504 : 503;
          });
        pending = acquisition;
        acquisition
          .finally(() => {
            if (pending === acquisition) pending = null;
          })
          .catch(() => {});
      }
      return pending;
    },
  };
}
export const tokens = createTokenManager();
