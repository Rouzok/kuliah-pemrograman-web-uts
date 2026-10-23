# Flight Tracker setup

Setup for the JavaScript React SPA and separate Cloudflare Worker described in [functional.md](functional.md) and [requirements.md](requirements.md). Dependencies, scripts, configuration, and environment templates only. No UI, routes, API client, Worker handler, or sample application has been implemented.

## Tools and installation

Use pnpm 12.14.0 for dependency management and Bun 1.4.2 or newer for development/build tooling. `.bun-version` records the local baseline. Node.js 22.22.0 or newer supports the package tooling dependency requirements; application scripts explicitly select Bun. Cloudflare executes deployed Workers in its Workers runtime, and the built frontend executes in the browser.

Install Bun using the [official installation instructions](https://bun.sh/docs/installation) and pnpm using the [pnpm installation instructions](https://pnpm.io/installation). Then, from this directory:

```sh
pnpm install
```

Commit `pnpm-lock.yaml`. Subsequent clean/CI installs use `pnpm install --frozen-lockfile`. Use `pnpm add` / `pnpm add -D` for dependencies; keep pnpm as the only lockfile source. `pnpm-workspace.yaml` configures the root package and permits the native tooling install scripts for esbuild and workerd.

React, React DOM, React Router, MapLibre GL 5, and maplibre-react-components are installed for the future frontend. Vite, its React plugin, and Wrangler are development tools. MapLibre stays on major 5 to satisfy the wrapper's peer dependency.

## Local environment

Copy the example files in PowerShell:

```powershell
Copy-Item .env.example .env.local
Copy-Item proxy/.dev.vars.example proxy/.dev.vars
```

Set `AIRLABS_API_KEY` only in `proxy/.dev.vars`. The frontend's `VITE_API_BASE_URL` is the public proxy origin (`http://localhost:8787` locally), without `/api`. Both local environment files are ignored. Never prefix the provider key with `VITE_` or store it in public assets.

`proxy/wrangler.jsonc` defines the future `ALLOWED_ORIGINS` binding as a comma-separated list of exact origins. Local dev and preview origins are listed. The future handler must parse and enforce this binding; configuration alone does not enforce CORS.

## Commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Vite dev server at `http://localhost:5173` |
| `pnpm build` | Build frontend assets into `dist/` |
| `pnpm preview` | Serve a completed frontend build at `http://localhost:4173` |
| `pnpm proxy:dev` | Local Worker at `http://localhost:8787` |
| `pnpm proxy:secret` | Set the deployed Worker secret interactively |
| `pnpm proxy:deploy` | Deploy the Worker separately |

Every script explicitly invokes Bun using `bun run --bun`, including local Wrangler. Ports are fixed so the configured browser origins remain stable. Once entry points exist, run frontend and Worker dev commands in separate terminals. No automatic polling or combined process manager is configured.

**This setup is intentionally not a runnable application.** Vite may start, but there is no page to serve. `pnpm build` needs the future root `index.html` and React source. Worker commands need the future `proxy/src/index.js` handler configured in Wrangler. Do not interpret these missing entry points as completed functionality or passing release checks.

## Implementation boundaries

Add the frontend entry point and React source only when implementation begins. The three future SPA routes are `/`, `/airports`, and `/saved`. Import MapLibre's stylesheet when adding the map, and select a permitted map style/tile source with visible attribution. No tile provider is selected by this setup.

Add the JavaScript Worker at `proxy/src/index.js`, separate from the Vite bundle. Implement the exact request validation, response sanitization, secret handling, CORS, and error behavior in functional.md. Its fixed upstream is `https://airlabs.co/api/v9/`; browser aviation requests must go through the project proxy.

| Future endpoint | Successful response cache lifetime |
| --- | --- |
| `GET /api/flights` | 30 seconds |
| `GET /api/flight` | 30 seconds |
| `GET /api/airports` | 24 hours |

These cache lifetimes are requirements, not implemented settings. The future handler must use the Worker Cache API, cache sanitized successes only, preserve `fetchedAt`, and apply origin headers after cache retrieval. Upstream requests must time out after 10 seconds.

Wrangler configures `RATE_LIMITER` for 60 requests per 60 seconds, with namespace ID `1001`. Choose a namespace ID unique to this rate-limit policy in your Cloudflare account. The future handler must call the binding using client IP before upstream access and return 429 plus Retry-After on rejection. The binding is best-effort per Cloudflare location, not a global quota guarantee. No limits are enforced until that handler exists.

## Deployment after implementation

Frontend and Worker deployment are independent. Do not deploy this setup as a completed application.

1. Authenticate Wrangler to the intended Cloudflare account. Replace the Worker's `ALLOWED_ORIGINS` value with the exact HTTPS frontend origin(s); retain local origins only when needed. Review the Worker name and rate-limit namespace for your account.
2. Set `AIRLABS_API_KEY` using `pnpm proxy:secret`, then deploy the implemented Worker using `pnpm proxy:deploy`. Never place the secret in Wrangler vars or frontend hosting settings.
3. Set the frontend hosting build environment's `VITE_API_BASE_URL` to the deployed HTTPS Worker origin. Run `pnpm install --frozen-lockfile` and `pnpm build`; publish `dist/` to a static host with Bun available for the build.
4. Configure that host to serve `index.html` for frontend navigation to `/airports` and `/saved`. Keep the separately hosted API's JSON errors outside the SPA fallback. Rebuild whenever `VITE_API_BASE_URL` changes because Vite embeds public variables at build time.
5. Verify the implementation acceptance checklist in functional.md, including real API access, missing configuration, cache, quotas, CORS, safe errors, browser assets, and direct URLs.

Confirm the AirLabs plan supports all three essential endpoints before integration. Unsupported essential access blocks integration; missing optional fields use the specified placeholders. If a real key was previously exposed, rotate it, update the Worker secret, and remove old public artifacts. Moving an exposed key to the Worker does not revoke it.

## Tool references

- [Bun runtime and the --bun flag](https://bun.sh/docs/runtime)
- [Vite guide](https://vite.dev/guide/)
- [MapLibre React Components setup](https://maplibre-react-components.pentatrion.com/getting-started)
- [Cloudflare Wrangler configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Worker secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
- [Worker rate limiting](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
