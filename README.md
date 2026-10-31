# Flight Tracker

A college-project React flight tracker with a separate Cloudflare Worker. OpenSky provides reported aircraft states; bookmarks identify aircraft by ICAO24 and persist locally. No user account or database is required.

Company profile (`/`), tracker navigation (`/map`, `/map/airports`, `/map/saved`), Saved Aircraft Open/Remove and a detail placeholder exist. The client/Worker use Axios with its Fetch adapter, authenticated OpenSky state requests, exact-origin CORS, IP rate limiting and 30-second sanitized-response caching. Full map/table integration and the visible-page 30-second update loop are future work. AirportsAPI is the future airport provider; `/api/airports` currently returns controlled uncached 503.

## Local setup

Use pnpm 12.14.0, Bun >=1.4.2 and Node >=22.22.0. Install with `pnpm install` (clean/CI: `pnpm install --frozen-lockfile`). Keep pnpm-lock.yaml as the only dependency lockfile.

From PowerShell, copy examples only if the destination does not exist:

```powershell
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
if (!(Test-Path proxy/.dev.vars)) { Copy-Item proxy/.dev.vars.example proxy/.dev.vars }
```

Set public `VITE_API_BASE_URL=http://localhost:8787` in `.env.local`, without `/api`. Set `OPENSKY_CLIENT_ID` and `OPENSKY_CLIENT_SECRET` yourself in ignored `proxy/.dev.vars`. Existing local settings are preserved; old provider credentials do not configure OpenSky. Never put provider credentials/tokens in `VITE_*`, Wrangler public vars, browser storage, public files or logs.

Run `pnpm dev` for [localhost:5173](http://localhost:5173). In another terminal run `pnpm proxy:dev` for the Worker at localhost:8787. Scripts use Bun. With Bun/Wrangler versions where the local undici dispatcher fails, use Node:

```sh
node node_modules/wrangler/bin/wrangler.js dev --config proxy/wrangler.jsonc
```

`pnpm build` builds dist/; `pnpm preview` serves [localhost:4173](http://localhost:4173). The public pages/placeholders run without credentials; live aircraft lookup requires the Worker and OpenSky secrets.

## API and bookmarks

```js
import { getFlights, getFlight, getAirports } from './src/api/client.js';
const controller = new AbortController();
const { data, meta } = await getFlight({ icao24: 'abc123' }, { signal: controller.signal });
// getFlights({ bbox: [-10, 95, 6, 141] }, { signal })
// getAirports() — deferred, currently rejects with CONFIGURATION / 503
```

Only bbox is accepted for flights (south, west, north, east); no zoom. Details accept one six-character hex ICAO24, normalized lowercase; old flight-number parameters are rejected. Consumers normalize/split antimeridian viewports and merge by ICAO24. Browser aviation calls only use the configured project origin.

Success is `{ data, meta: { fetchedAt, source: 'opensky', snapshotTime } }`; aircraft are named objects, not provider positional arrays. Empty states become `[]`, absent requested aircraft becomes null, HTTP/malformed-provider failures remain safe errors. Observation timestamps remain separate from retrieval time. Provider altitude is meters (display feet = m / 0.3048), velocity m/s (display knots = m/s × 3600 / 1852). Ground is reported state, not destination arrival; missing coverage never proves landing. No required commercial routes, airline/model, ETAs or delays.

The browser cache uses original fetchedAt freshness (30 seconds), shared pending requests, independent copies, caller-specific cancellation and Retry-After cooldowns. Callers ignore obsolete results after cleanup. Explicit retry respects cooldowns; time passing never triggers quota retries. Test injection uses an Axios `adapter` in `createApiClient`. Browser Fetch transport omits credentials, disables HTTP caching, rejects redirects and times out after 15 seconds.

Saved Aircraft uses `{ id: 'icao24:abc123', code: 'abc123', identifierType: 'icao24' }`, optionally callsign. Deduplicate normalized ICAO24. Legacy flight-number bookmarks stay visible/removable with save-again guidance; they never initiate guessed aircraft lookups. Open navigates to `/map` with current state lookup and Close/Escape/retry/unavailable handling. Full map selection integration remains future work.

## Worker operation and limits

`proxy/src/index.js` exports `handleRequest` and the default Worker handler; validation and safe envelopes are separate. `opensky.js` fixes the state destination; `oauth.js` owns the Axios instance and isolate token lifecycle. Tokens come from OpenSky's fixed OAuth client-credentials URL, expire according to expires_in, renew on demand with a 30-second margin and share concurrent acquisition within an isolate. One rejected bearer token can refresh/replay once; the entire auth/data/replay sequence has a 10-second deadline. Manual redirects are explicitly rejected, browser auth/cookies are never forwarded, and errors expose no raw Axios/provider data.

`ALLOWED_ORIGINS` in `proxy/wrangler.jsonc` contains exact local dev/preview origins. Allowed-origin success and errors include CORS and expose Retry-After; GET preflights allow Accept/Content-Type locally. No-Origin callers are allowed; disallowed origins get 403. No credentialed CORS. This public proxy is callable outside browsers.

The configured RATE_LIMITER (namespace 1001) enforces 60 requests/60 seconds by trusted client IP before cache/provider access. Rejection returns 429/Retry-After: 60; missing/failing binding or missing IP gives 503. OPTIONS does not consume the limiter or contact providers. Confirm namespace uniqueness in the intended account before deployment.

Worker Cache API stores only sanitized successful flight responses for 30 seconds with canonical `opensky-v1` keys. Cache hits preserve fetchedAt/snapshotTime and apply the caller's origin headers after retrieval. Browser HTTP caching remains no-store; errors/airports are uncached. OpenSky's rate-limit retry header is normalized to Retry-After without quota retry loops.

Standard OpenSky state access has **4,000 daily credits**, shared across account users. Bbox areas ≤25, >25–100, >100–400 and >400 square degrees cost 1, 2, 3 and 4 credits respectively. Indonesia-wide `[-10,95,6,141]` is 736 square degrees: approximately **480 credits/hour** at 30-second intervals before extra manual/detail/split/replay requests. It is not 4,000 unrestricted calls. Worker cache/rate limits are location-scoped and token memory isolate-scoped; none guarantees a single account-wide request/renewal. See [OpenSky REST docs](https://openskynetwork.github.io/opensky-api/rest.html), [Axios Fetch adapter](https://axios.rest/pages/advanced/fetch-adapter), and [Cloudflare Cache API](https://developers.cloudflare.com/workers/runtime-apis/cache/).

Future airport work uses [AirportsAPI](https://airportsapi.com/docs/api#/) through the Worker. Endpoint mappings/authentication are deliberately undefined until integration.

## Verification and deployment

```sh
pnpm install --frozen-lockfile
pnpm test:api
pnpm test:proxy
pnpm build
node node_modules/wrangler/bin/wrangler.js deploy --dry-run --config proxy/wrangler.jsonc
```

Tests use dummy credentials/adapters, plus local HTTP checks of Axios redirect rejection and body timeout. They do not establish live authentication or coverage. Perform bounded live Worker checks with one small viewport and one returned ICAO24 when credentials are available; otherwise report them unverified. Old provider checks do not verify OpenSky.

With local Wrangler running, `node proxy/smoke.mjs` checks CORS/errors/preflight and makes at most one small-viewport request plus one returned-aircraft lookup. If secrets are missing it reports live authentication/coverage unverified. On October 28, 2026, the frozen install, all 31 tests, build, Node Wrangler dry-run and local configuration/CORS smoke checks passed. An isolated Workers runtime check with intercepted dummy upstream traffic also verified Axios auth/data transport, Cache API timestamp/origin isolation, one 401 replay, redirect rejection, quota normalization and the 10-second response-body deadline. OpenSky live authentication/coverage remained unverified because its two credentials were not configured locally. No deployment was performed.

Deploy only when requested. Review account, Worker name, unique namespace and exact production ALLOWED_ORIGINS. Set each production secret interactively:

```sh
pnpm proxy:secret OPENSKY_CLIENT_ID
pnpm proxy:secret OPENSKY_CLIENT_SECRET
pnpm proxy:deploy
```

Set frontend build VITE_API_BASE_URL to the HTTPS Worker origin, install frozen/build and publish dist/ separately. Configure SPA fallback for `/`, `/map`, `/map/airports`, `/map/saved` without replacing API JSON. Rebuild when proxy origin changes. Rotate previously exposed real credentials and remove old public artifacts. Production acceptance, browser/device checks and airport integration remain outstanding until performed.

Local product specs [requirements.md](docs/requirements.md), [functional.md](docs/functional.md), [task-distribution.md](docs/task-distribution.md) and [AGENTS.md](AGENTS.md) remain ignored as configured; they may be absent from fresh clones.
