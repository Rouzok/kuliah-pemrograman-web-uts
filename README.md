# Flight Tracker

A college-project flight tracker for exploring aircraft positions, viewing flight details, browsing airports, and saving flights in the browser.

## Planned features

- **Live Map:** Explore aircraft around Indonesia, refresh the current map area, search and filter loaded flights, and select a flight to view its details.
- **Airports:** Search the airport directory by name, IATA, or ICAO code, filter by country, and locate airports on the map.
- **Saved Flights:** Bookmark flight identifiers, reopen their current details, and manage saved flights across browser sessions.

The interface follows a dark and teal design with sidebar navigation, compact tables, and responsive map and detail views. Flight data comes from AirLabs through a separate project API proxy.

## Technology

The frontend uses JavaScript, React, Vite, React Router, MapLibre GL, and maplibre-react-components. A separate Cloudflare Worker implements validated aviation endpoints and keeps the AirLabs API key on the server. Saved flights use browser localStorage; no account or application database is required.

Dependencies are managed with **pnpm**, and development/build scripts run with **Bun**. The frontend and Worker deploy separately.

## Run locally

Install pnpm 12.14.0, Bun 1.4.2 or newer, and Node.js 22.22.0 or newer for tooling compatibility.

1. Open a terminal in the project root.
2. Install dependencies:

   ```sh
   pnpm install
   ```

3. Start the development server using Bun:

   ```sh
   pnpm dev
   ```

4. Open [http://localhost:5173](http://localhost:5173) in your browser.

Press `Ctrl+C` in the terminal to stop the server. The company profile is at `/`; the application uses `/map`, `/map/airports`, and `/map/saved`. The map and airport directory are still placeholders.

To build and preview the production version locally:

```sh
pnpm build
pnpm preview
```

Open [http://localhost:4173](http://localhost:4173) to view the preview.

## Aviation API client

All browser aviation requests go through `src/api/client.js` using the public `VITE_API_BASE_URL` origin. Set it in `.env.local` using `.env.example` as a reference; preserve any existing local configuration. Never put an AirLabs key in frontend code or a `VITE_*` variable. The Worker must inject the key server-side.

```js
import { getFlights, getFlight, getAirports } from './api/client.js';

const controller = new AbortController();
const { data, meta } = await getFlight({ flight_iata: 'GA123' }, { signal: controller.signal });
// Other supported requests:
// getFlights({ bbox: [-10, 95, 6, 141], zoom: 5 }, { signal })
// getAirports({}, { signal }) — full directory, then filter locally
// getAirports({ country_code: 'ID' }, { signal }) — explicitly limited coverage
```

The client validates queries, deduplicates pending requests, and reuses successful in-memory responses for 30 seconds for flights/details or 24 hours for airports, measured from the original `meta.fetchedAt`. Refresh also reuses fresh cache. Viewport normalization, antimeridian splitting/merging, search, and filters belong to consumers. Do not mutate cached timestamps or treat retrieval time as aircraft observation time.

Consumers set a pending state before awaiting, distinguish successful `[]`/detail `null` from errors, and retain previous data with a stale indication on refresh failure. Abort their controller on navigation/selection cleanup and ignore obsolete results, as shown in `Flights.jsx`. Canceling one consumer leaves other consumers' shared request intact. Responses and cache reads give each consumer an independent copy.

Failures are safe `ApiError` objects with `code`, `status`, and optional `retryAt`; caller cancellation uses `AbortError`. A valid `Retry-After` establishes a shared cooldown. Only a user action retries; expiry of a cooldown never fetches automatically. T06 must expose `Retry-After` through `Access-Control-Expose-Headers`. Requests have a 15-second browser timeout; the Worker has a separate 10-second upstream timeout.

Saved Flights Open accepts `{ id, code, identifierType }`, where `identifierType` is `flight_iata` or `flight_icao`. Existing records with an explicit `flight_iata`/`flight_icao` field also work (IATA takes precedence). Records with only a legacy `id` remain saved and show guidance instead of guessing an identifier type. Open navigates to `/map`, loads the current match, and supports Close/Escape, manual retry, and unavailable/error states. Full map and detail-panel integration remains future work.

Run the isolated client checks without credentials or a Worker:

```sh
pnpm test:api
pnpm build
```

## Local Worker (T05)

Set `AIRLABS_API_KEY` yourself in ignored `proxy/.dev.vars`. Preserve any existing settings; never commit this file or put the key in Wrangler public vars. A key in the root frontend environment file is not the configured Worker secret source.

The configured Bun launch currently encounters a Wrangler 4.152.0 compatibility error: Bun's Fetch does not honor the undici dispatcher used by Wrangler's local proxy. Keep `pnpm proxy:dev` for the configured script; for local verification with these versions, run Wrangler directly under Node in a separate terminal:

```sh
node node_modules/wrangler/bin/wrangler.js dev --config proxy/wrangler.jsonc
```

It listens at `http://localhost:8787` and accepts these project endpoints:

| Endpoint | Query |
| --- | --- |
| `GET /api/flights` | Required `bbox=south,west,north,east`; optional integer `zoom=0..11` |
| `GET /api/flight` | Exactly one normalized `flight_iata` or `flight_icao` |
| `GET /api/airports` | Optional two-letter `country_code`; omit for the full directory |

The Worker validates queries, calls only `https://airlabs.co/api/v9/`, injects the runtime secret, and returns approved fields in `{ data, meta: { fetchedAt, source } }`. Missing optional fields and valid zeros are preserved. Confirmed empty lists become `[]`; confirmed missing flight details become `null`. Failures return safe JSON errors, including configuration/plan errors (503), quota (429), timeout (504), and other upstream/parse failures (502). Valid upstream `Retry-After` is preserved without automatic retries. Provider request/key metadata is excluded from browser responses. Client cookies and authorization headers are never forwarded upstream. Redirects use manual mode and all 3xx responses are rejected without following them, as required by the Workers runtime.

Run Worker contract tests with dummy credentials and mocked upstream Fetch:

```sh
pnpm test:proxy
pnpm test:api
pnpm build
```

T05 returns `Cache-Control: no-store` and does not enforce the configured `ALLOWED_ORIGINS` or `RATE_LIMITER` binding yet. Exact-origin CORS controls belong to T06; Worker Cache API caching and rate limiting belong to T07. OPTIONS currently returns an empty 204 without an upstream request. Browser integration remains pending T06; local HTTP tools can test the proxy directly. Do not deploy this intermediate Worker as release-ready.

Mocked tests do not establish actual AirLabs plan access. Verify the three essential endpoints through the local Worker and record any access or coverage restrictions; unsupported essential access is a blocker. No deployment is included.

Local integration checked on October 28, 2026 (Asia/Jakarta) using Wrangler under Node and the existing browser client: the Indonesia viewport returned 63 flights, the full airport directory returned 23,490 records, and a returned flight identifier resolved to one detail record. Only approved field names/counts and proxy metadata were inspected; the secret file was not opened. These are observed integration results, not fixed UI counts or a guarantee of ongoing plan access. Browser CORS, Worker caching/rate limiting, and production deployment remain unverified.

## API module responsibilities

Browser code imports the public functions from `src/api/client.js`; `ApiError` and `getSavedFlightIdentifier` remain available there through explicit re-exports.

| Module | Responsibility |
| --- | --- |
| `src/api/client.js` | Endpoint functions, client factory, proxy configuration, cache, shared requests, caller cancellation, and cooldown lifecycle. |
| `src/api/validation.js` | Query validation/normalization and saved-flight identifiers. |
| `src/api/response.js` | Safe `ApiError` messages, HTTP-status mapping, Retry-After parsing, and envelope validation. |
| `proxy/src/index.js` | Worker routing, method/OPTIONS handling, configuration checks, and upstream dispatch. |
| `proxy/src/validation.js` | Allowed/duplicate query checks and endpoint-specific normalization. |
| `proxy/src/airlabs.js` | Fixed provider destination, routes/field allowlists, requests, timeout, redirect rejection, and provider-error mapping. |
| `proxy/src/response.js` | Sanitized records, payload extraction, Retry-After validation, and project success/error envelopes. |

Supporting modules never import their entry point. Browser and Worker modules stay separate. For T06, add origin checks and response headers at the Worker entry point. For T07, keep cache/rate-limit orchestration there and cache only sanitized successes, preserving `fetchedAt` and applying origin headers after retrieval.

## Project documentation

- [requirements.md](docs/requirements.md): Product scope, design references, and architecture.
- [functional.md](docs/functional.md): Functional behavior, proxy contract, data rules, and acceptance criteria.
- [AGENTS.md](AGENTS.md): AI agent context, development setup, commands, and implementation guidance.
