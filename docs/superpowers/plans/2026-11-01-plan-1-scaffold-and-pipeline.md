# Plan 1: Scaffold and Pipeline — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An empty-but-real Muddle & Mayhem project: TypeScript + Vite + Canvas page, unit and browser tests, CI on every PR, automatic deploy to GitHub Pages on merge, and the project rules written down where every future session will read them.

**Architecture:** Vite serves `index.html` with one `<canvas>`; `src/main.ts` draws a placeholder so the deploy is visibly alive. The only simulation code in this plan is the seeded PRNG (`src/sim/rng.ts`), which also proves the headless Vitest path works. A small Node script enforces the sim arithmetic ban. Two GitHub Actions workflows: `ci.yml` (PRs and pushes) and `deploy.yml` (main → Pages).

**Tech Stack:** TypeScript (strict), Vite, Vitest, Playwright (Chromium), GitHub Actions, GitHub Pages. Node 22 in CI. No game engine, no UI framework.

**Spec:** `docs/superpowers/specs/2026-11-01-muddle-and-mayhem-design.md` (sections 3, 5, 6 drive this plan).

## v1 plan sequence (for orientation; this document is Plan 1 only)

1. **Plan 1 (this document):** scaffold, tests, CI, Pages deploy, CLAUDE.md, decisions log. Done when a placeholder page is live at `https://karlnewell.github.io/muddle-and-mayhem/` and CI is green.
2. **Plan 2: Headless simulation.** `src/sim/`: map grid, line of sight, A* pathfinding, soldiers, five weapons, damage/downed/instant-kill, medics, win condition, command queue, AI. Done when an AI-vs-AI battle runs to completion in Vitest and replays bit-for-bit from its command log.
3. **Plan 3: Playable game.** `src/render/`, `src/input/`, `src/ui/`: top-down renderer, mouse/keyboard commands, pause, HUD, title and result screens, Playwright smoke test that plays a few seconds. Done when the spec's v1 success criterion holds.

Plans 2 and 3 are written when their turn comes, from the spec, using superpowers:writing-plans.

## Global Constraints

- Package and repo name: `muddle-and-mayhem`. Game title string: `Muddle & Mayhem`.
- License: MIT. All assets original or openly licensed (CC0 / CC-BY / OFL).
- `src/sim/**` never imports from `src/render`, `src/input`, `src/ui`, or touches `document`, `window`, `performance`, `Date`, or `Math.random`.
- `src/sim/**` may use only `+ - * /`, `Math.sqrt`, `Math.floor`, `Math.abs`, `Math.min`, `Math.max`, and comparisons. Banned: `Math.sin`, `Math.cos`, `Math.tan`, `Math.atan`, `Math.atan2`, `Math.pow`, `Math.exp`, `Math.log`, `Math.random`, `**` operator.
- Vite `base` is `/muddle-and-mayhem/` so Pages serves assets from the right path.
- Node 22 in CI. TypeScript `strict: true`.
- Files small and single-purpose (200-400 lines typical, 800 max).
- Never use the names General Chaos, General Havoc, Moronica, or Viceria anywhere in the repo.
- Commit messages: plain, no attribution trailers.

## Review Focus

1. Opening the deployed URL shows a blank page because an asset path lacks the `/muddle-and-mayhem/` prefix. The Playwright smoke test must run against `vite preview` at the base path, not against a dev server at `/`. (Task 3)
2. The sim arithmetic guard passes code that uses `Math.pow` via a renamed import or the `**` operator. The guard greps for `**` as well as the `Math.` names. (Task 2)
3. The sim arithmetic guard fails on the word `Math.sin` inside a comment that explains the ban. The guard strips `//` and `/* */` comments before matching. (Task 2)
4. A PR passes CI with a type error because `vite build` does not type-check. CI runs `tsc --noEmit` as its own step. (Task 4)
5. The deploy workflow fails because Pages is set to "Deploy from a branch". README and the plan record the owner step: Settings → Pages → Source → GitHub Actions. (Task 5)

---

### Task 1: Vite + TypeScript project with a canvas and the seeded PRNG

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `src/main.ts`, `src/sim/rng.ts`, `.gitignore`
- Test: `tests/sim/rng.test.ts`

**Interfaces:**
- Produces: `createRng(seed: number): Rng` in `src/sim/rng.ts`, where `interface Rng { next(): number; int(maxExclusive: number): number; chance(p: number): boolean }`. `next()` returns a float in `[0, 1)`. Mulberry32 algorithm. Plan 2 builds on this exact signature.
- Produces: npm scripts `dev`, `build`, `preview`, `typecheck`, `test`, `test:e2e`, `lint:sim`, `check` (runs typecheck, lint:sim, test, build in that order).

- [x] **Step 1: Scaffold with Vite**

Run in the repo root (it is empty apart from `docs/` and `.git`):
```bash
npm create vite@latest . -- --template vanilla-ts
npm install
npm install -D vitest
```
Delete the template's `src/counter.ts`, `src/style.css`, `src/typescript.svg`, and `public/vite.svg`. Keep `index.html`, `src/main.ts`, `src/vite-env.d.ts`, `tsconfig.json`, `package.json`.

- [x] **Step 2: Configure**

`package.json`: set `"name": "muddle-and-mayhem"`, `"private": true`, `"license": "MIT"`, `"type": "module"`, and scripts:
```json
"dev": "vite",
"build": "vite build",
"preview": "vite preview",
"typecheck": "tsc --noEmit",
"test": "vitest run",
"test:e2e": "playwright test",
"lint:sim": "node scripts/check-sim-math.mjs",
"check": "npm run typecheck && npm run lint:sim && npm run test && npm run build"
```
`vite.config.ts`: `export default defineConfig({ base: '/muddle-and-mayhem/' })`.
`vitest.config.ts`: `test: { include: ['tests/**/*.test.ts'], environment: 'node' }`.
`tsconfig.json`: keep the template's strict settings; add `"include": ["src", "tests", "scripts", "e2e", "vite.config.ts", "vitest.config.ts", "playwright.config.ts"]`.
`.gitignore`: `node_modules/`, `dist/`, `.superpowers/`, `test-results/`, `playwright-report/`, `.DS_Store`.

- [x] **Step 3: Write the failing PRNG test**

`tests/sim/rng.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/sim/rng';

describe('createRng', () => {
  it('is deterministic for a seed', () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });
  it('differs across seeds', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });
  it('next() stays in [0, 1)', () => {
    const r = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('int(n) stays in [0, n)', () => {
    const r = createRng(9);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(6);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
    }
  });
  it('chance(0) is never true and chance(1) is always true', () => {
    const r = createRng(3);
    for (let i = 0; i < 100; i++) {
      expect(r.chance(0)).toBe(false);
      expect(r.chance(1)).toBe(true);
    }
  });
});
```

- [x] **Step 4: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL, cannot resolve `../../src/sim/rng`.

- [x] **Step 5: Implement `createRng` in `src/sim/rng.ts`**

Mulberry32: state `s = seed >>> 0`; each `next()` does `s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296;`. `int(n)` is `Math.floor(next() * n)`. `chance(p)` is `next() < p`. Integer bit operations and `Math.imul` are allowed in sim code (they are exact everywhere); add them to the allowed list in the CLAUDE.md rule in Task 5.

- [x] **Step 6: Run the test to verify it passes**

Run: `npm test`
Expected: PASS, 5 tests.

- [x] **Step 7: Replace `src/main.ts` and `index.html` with the canvas placeholder**

`index.html`: title `Muddle & Mayhem`, body contains `<canvas id="game" width="960" height="540"></canvas>` and the module script. Minimal inline CSS: dark background (`#0e1116`), canvas centered, `image-rendering: pixelated`.
`src/main.ts`: get the canvas and 2D context, fill it `#3b6b35`, draw the text `Muddle & Mayhem` centered in a monospace font, and draw one blue circle (`#3d7bd6`) and one red circle (`#d64545`). Nothing else. Throw an `Error('canvas not found')` if the element is missing.

- [x] **Step 8: Verify build and typecheck**

Run: `npm run typecheck && npm run build`
Expected: no type errors; `dist/index.html` exists and references assets under `/muddle-and-mayhem/assets/`.

- [x] **Step 9: Commit**

```bash
git add -A
git commit -m "Scaffold Vite + TypeScript project with canvas placeholder and seeded PRNG"
```

---

### Task 2: Sim arithmetic guard

**Files:**
- Create: `scripts/check-sim-math.mjs`, `scripts/check-sim-math.d.mts` (declares `findViolations` so the strict TypeScript test can import the plain JS script)
- Test: `tests/scripts/check-sim-math.test.ts`

**Interfaces:**
- Produces: `node scripts/check-sim-math.mjs [dir]` exits 0 when no file under `dir` (default `src/sim`) contains a banned token outside comments, else prints `file:line: token` for each offence and exits 1. Also exported for tests: `findViolations(source: string, filename: string): Array<{ file: string; line: number; token: string }>`.

- [x] **Step 1: Write the failing test**

`tests/scripts/check-sim-math.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { findViolations } from '../../scripts/check-sim-math.mjs';

describe('findViolations', () => {
  it('flags banned Math calls with line numbers', () => {
    const src = 'const a = 1;\nconst b = Math.sin(a);\nconst c = Math.atan2(1, 2);';
    expect(findViolations(src, 'x.ts')).toEqual([
      { file: 'x.ts', line: 2, token: 'Math.sin' },
      { file: 'x.ts', line: 3, token: 'Math.atan2' },
    ]);
  });
  it('flags the ** operator, Math.random, Date, and performance', () => {
    const src = 'a ** 2;\nMath.random();\nDate.now();\nperformance.now();';
    expect(findViolations(src, 'x.ts').map((v) => v.token)).toEqual(['**', 'Math.random', 'Date', 'performance']);
  });
  it('ignores banned names inside comments', () => {
    const src = '// Math.sin is banned here\n/* Math.pow\n too */\nconst ok = Math.sqrt(4);';
    expect(findViolations(src, 'x.ts')).toEqual([]);
  });
  it('allows the permitted operations', () => {
    const src = 'Math.sqrt(1); Math.floor(1); Math.abs(1); Math.min(1,2); Math.max(1,2); Math.imul(1,2); 1 >>> 0;';
    expect(findViolations(src, 'x.ts')).toEqual([]);
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npm test -- tests/scripts`
Expected: FAIL, cannot resolve `scripts/check-sim-math.mjs`.

- [x] **Step 3: Implement `scripts/check-sim-math.mjs`**

Export `findViolations`, and declare it in `scripts/check-sim-math.d.mts` as `export function findViolations(source: string, filename: string): Array<{ file: string; line: number; token: string }>`. Strip comments with a small scanner (track `//` to end of line and `/* */` spans, preserving newlines so line numbers survive; do not attempt to handle comment markers inside string literals, note this in a `ponytail:` comment). Match, per line, the regex `/\bMath\.(sin|cos|tan|atan|atan2|asin|acos|pow|exp|log|log2|log10|random|hypot|cbrt)\b|\*\*|\bDate\b|\bperformance\b/g`. When run as a script (`import.meta.url` matches `process.argv[1]`), walk the directory recursively for `.ts` files, print offences, exit 1 if any. Exit 0 with no output when the directory does not exist yet.

- [x] **Step 4: Run the test to verify it passes**

Run: `npm test`
Expected: PASS.

- [x] **Step 5: Run the guard against the real sim folder**

Run: `npm run lint:sim`
Expected: exit 0, no output (`src/sim/rng.ts` uses only allowed operations).

- [x] **Step 6: Commit**

```bash
git add scripts tests/scripts
git commit -m "Add sim arithmetic guard enforcing cross-engine-safe math"
```

---

### Task 3: Playwright smoke test against the built site

**Files:**
- Create: `playwright.config.ts`, `e2e/smoke.spec.ts`

**Interfaces:**
- Produces: `npm run test:e2e` builds nothing itself; it expects `dist/` to exist and starts `vite preview` on port 4173 via Playwright's `webServer`, with `baseURL` `http://localhost:4173/muddle-and-mayhem/`.

- [x] **Step 1: Install Playwright**

```bash
npm install -D @playwright/test
npx playwright install chromium
```

- [x] **Step 2: Write the smoke test**

`e2e/smoke.spec.ts`:
```ts
import { expect, test } from '@playwright/test';

test('page loads, canvas is painted, no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('./');
  await expect(page).toHaveTitle('Muddle & Mayhem');
  const canvas = page.locator('canvas#game');
  await expect(canvas).toBeVisible();
  const painted = await canvas.evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) return true;
    return false;
  });
  expect(painted).toBe(true);
  expect(errors).toEqual([]);
});
```

- [x] **Step 3: Write `playwright.config.ts`**

`testDir: 'e2e'`, one project `chromium`, `use: { baseURL: 'http://localhost:4173/muddle-and-mayhem/' }`, `webServer: { command: 'npm run preview -- --port 4173 --strictPort', url: 'http://localhost:4173/muddle-and-mayhem/', reuseExistingServer: !process.env.CI }`, `reporter: 'list'`.

- [x] **Step 4: Run it and verify it passes**

Run: `npm run build && npm run test:e2e`
Expected: 1 passed.

- [x] **Step 5: Verify it catches a broken base path**

Temporarily change `base` in `vite.config.ts` to `/`, rebuild, run `npm run test:e2e`. Expected: FAIL (canvas not painted or page error). Restore `base` to `/muddle-and-mayhem/`, rebuild, confirm PASS again.

- [x] **Step 6: Commit**

```bash
git add playwright.config.ts e2e package.json package-lock.json
git commit -m "Add Playwright smoke test against the built site at the Pages base path"
```

---

### Task 4: GitHub Actions: CI and Pages deploy

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`

**Interfaces:**
- Produces: a required check named `ci` for branch protection to reference; a deployment to the `github-pages` environment on every push to `main`.

- [x] **Step 1: Write `ci.yml`**

Triggers: `pull_request` and `push` to `main`. One job `ci` on `ubuntu-latest`: `actions/checkout@v4`; `actions/setup-node@v4` with `node-version: 22` and `cache: npm`; `npm ci`; `npm run typecheck`; `npm run lint:sim`; `npm test`; `npm run build`; `npx playwright install --with-deps chromium`; `npm run test:e2e` with `CI: true` in `env`.

- [x] **Step 2: Write `deploy.yml`**

Trigger: `push` to `main` and `workflow_dispatch`. `permissions: { contents: read, pages: write, id-token: write }`. `concurrency: { group: pages, cancel-in-progress: true }`. Job `build`: checkout, setup-node 22, `npm ci`, `npm run build`, `actions/configure-pages@v5`, `actions/upload-pages-artifact@v3` with `path: dist`. Job `deploy`: `needs: build`, `environment: { name: github-pages, url: ${{ steps.deployment.outputs.page_url }} }`, step `id: deployment` using `actions/deploy-pages@v4`.

- [x] **Step 3: Validate the YAML locally**

Run: `node -e "const y=require('yaml');for(const f of ['ci','deploy'])y.parse(require('fs').readFileSync('.github/workflows/'+f+'.yml','utf8'));console.log('ok')"` (install `yaml` as a dev dependency first with `npm i -D yaml`, or skip this step if the implementer prefers to rely on the PR run).
Expected: `ok`.

- [x] **Step 4: Commit**

```bash
git add .github
git commit -m "Add CI workflow and GitHub Pages deploy workflow"
```

---

### Task 5: Project rules: CLAUDE.md, decisions log, README, LICENSE, Claude GitHub Action

**Files:**
- Create: `CLAUDE.md`, `docs/decisions.md`, `README.md`, `LICENSE`, `.github/workflows/claude.yml`

- [ ] **Step 1: Write `CLAUDE.md`**

Sections, each a few lines:
- **What this is:** one paragraph from the spec's section 1, with the link to the spec and to `docs/decisions.md`.
- **Commands:** `npm run dev`, `npm run check` (run before every commit), `npm run test:e2e` (needs `npm run build` first).
- **Architecture rules** (copy exactly): sim/renderer split; fixed timestep; commands not mutations; seeded randomness via `createRng` only; the allowed-operations list from Global Constraints plus `Math.imul` and integer bit operators; `npm run lint:sim` enforces it.
- **Working agreements:** small PRs, one task per PR where practical, `npm run check` green before pushing, tests first for sim code, every new rule or tunable goes in `src/sim/constants.ts` (Plan 2 creates it), every non-obvious decision gets a dated line in `docs/decisions.md`.
- **Legal rules:** section 8 of the spec, verbatim.
- **Plans:** where plans live and that Plan 2 and 3 are written from the spec with superpowers:writing-plans before implementation.

- [ ] **Step 2: Write `docs/decisions.md`**

Header: "One dated line per decision. Newest at the bottom. The roadmap lives at the end." Then entries dated 2026-11-01, one line each, for: web/TypeScript/Canvas/no engine; GitHub (not GitLab) because of cloud sessions; top-down with renderer swappable to isometric; inspired-by not recreation; v1 features (core, pause, medics, instant kills); pause is single-player only; public repo and why; name Muddle & Mayhem and the generals; cross-engine arithmetic ban; AI deterministic through the command log; downed soldiers immune, no time limit; friendly fire splash/flame only; 3 medic calls, revive at 50%; instant kill 10% start. Then `## Roadmap` with the spec's section 7 list verbatim.

- [ ] **Step 3: Write `README.md`**

Title, one-paragraph description, the live URL `https://karlnewell.github.io/muddle-and-mayhem/`, how to run locally (`npm install`, `npm run dev`), how to test (`npm run check`), a **Repository setup (owner, one time)** list: Settings → Pages → Source → GitHub Actions; Settings → Branches → protect `main`, require the `ci` check; install the Claude GitHub App and add the `CLAUDE_CODE_OAUTH_TOKEN` secret for `@claude` on PRs. Credit line: "Inspired by the squad-tactics genre of the early 1990s. All code, art, and names are original."

- [ ] **Step 4: Write `LICENSE`**

MIT, copyright 2026 Karl Newell.

- [ ] **Step 5: Write `.github/workflows/claude.yml`**

The standard Claude Code GitHub Action workflow: triggers on `issue_comment`, `pull_request_review_comment`, `issues`, and `pull_request_review` when the body contains `@claude`; job with `permissions: { contents: write, pull-requests: write, issues: write, id-token: read }`; `anthropics/claude-code-action@v1` with `claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}`. A comment at the top: "Does nothing until the owner installs the Claude GitHub App and adds the secret (see README)."

- [ ] **Step 6: Run the full check and commit**

Run: `npm run check`
Expected: typecheck, lint:sim, tests, and build all succeed.
```bash
git add CLAUDE.md docs/decisions.md README.md LICENSE .github/workflows/claude.yml
git commit -m "Add project rules, decisions log, README, license, and Claude GitHub Action"
```

- [ ] **Step 7: Open the pull request**

Push the branch and open a PR against `main` titled "Plan 1: scaffold and pipeline". The PR body lists the five tasks and the owner's one-time setup steps from the README. CI must be green before merge. After merge, the deploy workflow publishes the placeholder page; the plan is done when `https://karlnewell.github.io/muddle-and-mayhem/` shows the green canvas with the title and two circles.
