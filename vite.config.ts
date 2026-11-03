import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import { formatBuildVersion } from './src/game/buildVersion';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };
const buildVersion = formatBuildVersion(
  pkg.version,
  () => execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString(),
  new Date(),
);

export default defineConfig({
  // GitHub Pages serves the site from this sub-path, so every asset URL must
  // carry it. The Playwright smoke test loads the built site at this path.
  base: '/muddle-and-mayhem/',
  // No single-page-app history fallback: `vite preview` then returns 404 for
  // paths outside `base`, like Pages does, so a wrong base fails the smoke test.
  appType: 'mpa',
  // The build shown on screen and in reports (src/game/buildVersion.ts).
  define: { __BUILD_VERSION__: JSON.stringify(buildVersion) },
});
