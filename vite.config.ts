import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages serves the site from this sub-path, so every asset URL must
  // carry it. The Playwright smoke test loads the built site at this path.
  base: '/muddle-and-mayhem/',
  // No single-page-app history fallback: `vite preview` then returns 404 for
  // paths outside `base`, like Pages does, so a wrong base fails the smoke test.
  appType: 'mpa',
});
