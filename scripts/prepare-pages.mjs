import { copyFile, mkdir } from 'node:fs/promises';

// Pages serves directories rather than providing a server-side SPA rewrite.
// Keep these entry pages aligned with the routes in src/App.jsx.
const routes = ['about', 'contact', 'map', 'map/airports', 'map/saved'];

for (const route of routes) {
  await mkdir(`dist/${route}`, { recursive: true });
  await copyFile('dist/index.html', `dist/${route}/index.html`);
}

console.log(`Prepared ${routes.length} direct route entry pages in dist/.`);
