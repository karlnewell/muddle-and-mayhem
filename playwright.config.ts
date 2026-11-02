import { defineConfig, devices } from '@playwright/test';

// Runs against the production build served by `vite preview` at the GitHub
// Pages base path, so a wrong asset prefix fails here before it fails live.
// Run `npm run build` first; this config does not build.
const port = 4173;
const baseURL = `http://localhost:${port}/muddle-and-mayhem/`;

// Set PW_CHROMIUM_PATH to run with a Chromium that was not downloaded by this
// Playwright version (some sandboxes preinstall one). CI leaves it unset.
const executablePath = process.env.PW_CHROMIUM_PATH;

export default defineConfig({
  testDir: 'e2e',
  reporter: 'list',
  use: { baseURL, launchOptions: executablePath ? { executablePath } : {} },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run preview -- --port ${port} --strictPort`,
    // Probe the server root, not the base path: the root answers as soon as
    // the server is up (302 to the base), while a wrong base would 404 the
    // probe and hide the real failure behind a start-up timeout.
    url: `http://localhost:${port}/`,
    reuseExistingServer: !process.env.CI,
  },
});
