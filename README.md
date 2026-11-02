# Muddle & Mayhem

A small real-time squad-tactics game for the browser. Five soldiers per side,
each with a different weapon, directed from above until one squad is wiped
out. Written in plain TypeScript on HTML Canvas with no game engine, built
with Claude Code as a learning project.

**Play it:** https://karlnewell.github.io/muddle-and-mayhem/

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (the game lives at `/muddle-and-mayhem/`).

## Test

```bash
npm run check
```

That runs the type check, the simulation arithmetic guard, the unit tests,
and the production build. The browser smoke test needs a build first:

```bash
npm run build
npm run test:e2e
```

## Repository setup (owner, one time)

These cannot be done from a cloud session.

1. **Pages:** Settings → Pages → Build and deployment → Source → **GitHub Actions**.
   The `deploy` workflow publishes `dist/` on every push to `main`.
2. **Branch protection:** Settings → Branches → add a rule for `main` that
   requires the **`ci`** status check to pass before merging.
3. **Claude on PRs:** install the Claude GitHub App on this repository and add
   a repository secret named `CLAUDE_CODE_OAUTH_TOKEN`. Until then the
   `claude` workflow ships but does nothing. After that, `@claude` in a PR
   or issue comment asks it to review or fix.

## Project rules

See `CLAUDE.md` for the architecture and working rules, `docs/decisions.md`
for the decision log and roadmap, and `docs/superpowers/specs/` for the design.

## Credit and license

Inspired by the squad-tactics genre of the early 1990s. All code, art, and
names are original. Source is MIT licensed; see `LICENSE`.
