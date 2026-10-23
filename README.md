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

## Project status

The repository currently contains project requirements and development setup. The application UI, routing, data integration, and Worker handler have not been implemented. It is not yet a runnable flight tracker.

## Project documentation

- [requirements.md](docs/requirements.md): Product scope, design references, and architecture.
- [functional.md](docs/functional.md): Functional behavior, proxy contract, data rules, and acceptance criteria.
- [AGENTS.md](AGENTS.md): AI agent context, development setup, commands, and implementation guidance.
