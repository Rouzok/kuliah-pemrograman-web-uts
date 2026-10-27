# Flight Tracker

A college-project flight tracker for exploring aircraft positions, viewing flight details, browsing airports, and saving flights in the browser.

## Planned features

- **Live Map:** Explore aircraft around Indonesia, refresh the current map area, search and filter loaded flights, and select a flight to view its details.
- **Airports:** Search the airport directory by name, IATA, or ICAO code, filter by country, and locate airports on the map.
- **Saved Flights:** Bookmark flight identifiers, reopen their current details, and manage saved flights across browser sessions.

The interface follows a dark and teal design with sidebar navigation, compact tables, and responsive map and detail views. Flight data comes from AirLabs through a separate project API proxy.

## Technology

The frontend uses JavaScript, React, Vite, React Router, MapLibre GL, and maplibre-react-components. A separate Cloudflare Worker is planned to proxy aviation requests and keep the AirLabs API key on the server. Saved flights use browser localStorage; no account or application database is required.

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
const { data, meta } = await getFlight(
  { flight_iata: 'GA123' },
  { signal: controller.signal },
);
// Other supported requests:
// getFlights({ bbox: [-10, 95, 6, 141], zoom: 5 }, { signal })
// getAirports({}, { signal }) — full directory, then filter locally
// getAirports({ country_code: 'ID' }, { signal }) — explicitly limited coverage
```

The client validates queries, deduplicates pending requests, and reuses successful in-memory responses for 30 seconds for flights/details or 24 hours for airports, measured from the original `meta.fetchedAt`. Refresh also reuses fresh cache. Viewport normalization, antimeridian splitting/merging, search, and filters belong to consumers. Do not mutate cached timestamps or treat retrieval time as aircraft observation time.

Consumers set a pending state before awaiting, distinguish successful `[]`/detail `null` from errors, and retain previous data with a stale indication on refresh failure. Abort their controller on navigation/selection cleanup and ignore obsolete results, as shown in `LiveMap.jsx`. Canceling one consumer leaves other consumers' shared request intact. Responses and cache reads give each consumer an independent copy.

Failures are safe `ApiError` objects with `code`, `status`, and optional `retryAt`; caller cancellation uses `AbortError`. A valid `Retry-After` establishes a shared cooldown. Only a user action retries; expiry of a cooldown never fetches automatically. The Worker must expose `Retry-After` through `Access-Control-Expose-Headers`. Requests have a 15-second browser timeout; the future Worker has a separate 10-second upstream timeout.

Saved Flights Open accepts `{ id, code, identifierType }`, where `identifierType` is `flight_iata` or `flight_icao`. Existing records with an explicit `flight_iata`/`flight_icao` field also work (IATA takes precedence). Records with only a legacy `id` remain saved and show guidance instead of guessing an identifier type. Open navigates to `/map`, loads the current match, and supports Close/Escape, manual retry, and unavailable/error states. Full map and detail-panel integration remains future work.

Run the isolated client checks without credentials or a Worker:

```sh
pnpm test:api
pnpm build
```

The Worker handler, CORS/secret enforcement, Worker Cache API, rate limiting, and real AirLabs plan access are **not implemented or verified by T04**. End-to-end live lookup requires T05–T07 and a running Worker at the configured origin. Mocked tests do not verify real provider access. No deployment is included.

## Project documentation

- [requirements.md](docs/requirements.md): Product scope, design references, and architecture.
- [functional.md](docs/functional.md): Functional behavior, proxy contract, data rules, and acceptance criteria.
- [AGENTS.md](AGENTS.md): AI agent context, development setup, commands, and implementation guidance.
