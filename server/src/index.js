import { serveStatic } from '@hono/bun';
import { fileURLToPath } from 'node:url';
import { createApp } from './app.js';

const defaultStaticRoot = fileURLToPath(new URL('../../client/dist/', import.meta.url));
const frontendRoutes = ['/', '/about', '/contact', '/map', '/map/', '/map/airports', '/map/saved'];

export function createServerApp({ staticRoot = defaultStaticRoot, ...options } = {}) {
  const app = createApp(options);
  // The API, including unknown API routes, is resolved before any SPA fallback.
  app.get('*', serveStatic({ root: staticRoot }));
  for (const route of frontendRoutes) app.get(route, serveStatic({ path: staticRoot + '/index.html' }));
  return app;
}

if (import.meta.main) {
  const production = process.argv.includes('--production') || process.env.NODE_ENV === 'production';
  const env = {
    ...process.env,
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS ?? (production ? '' : 'http://localhost:5273,http://localhost:4173'),
  };
  const port = env.PORT === undefined ? 8787 : Number(env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be an integer from 1 to 65535.');
  if (production && !(await Bun.file(defaultStaticRoot + '/index.html').exists())) {
    throw new Error('Frontend build missing. Run pnpm build before pnpm start.');
  }
  const app = createServerApp({ env });
  const server = Bun.serve({ hostname: env.HOST || 'localhost', port, fetch: app.fetch });
  console.log('Flight Tracker server listening on ' + server.url.origin);
}
