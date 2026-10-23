# Flight Tracker

A college-project flight tracker for exploring aircraft positions, viewing flight details, browsing airports, and saving flights in the browser.

## Planned features

- **Live Map:** Explore aircraft around Indonesia, refresh the current map area, search and filter loaded flights, and select a flight to view its details.
- **Airports:** Search the airport directory by name, IATA, or ICAO code, filter by country, and locate airports on the map.
- **Saved Flights:** Bookmark flight identifiers, reopen their current details, and manage saved flights across browser sessions.

The interface follows a dark and teal design with sidebar navigation, compact tables, and responsive map and detail views. Flight data comes from AirLabs through a separate project API proxy.

## Technology

The frontend uses JavaScript, React, Vite, React Router, MapLibre GL, and maplibre-react-components. A Cloudflare Worker proxies aviation requests and keeps the AirLabs API key on the server. Saved flights use browser localStorage; no account or application database is required.

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

Press `Ctrl+C` in the terminal to stop the server. The Hello World starter does not require environment files, an API key, or a running Worker.

To build and preview the production version locally:

```sh
pnpm build
pnpm preview
```

Open [http://localhost:4173](http://localhost:4173) to view the preview.

## Project documentation

- [requirements.md](docs/requirements.md): Product scope, design references, and architecture.
- [functional.md](docs/functional.md): Functional behavior, proxy contract, data rules, and acceptance criteria.
- [AGENTS.md](AGENTS.md): AI agent context, development setup, commands, and implementation guidance.
