# Muddle & Mayhem

## What this is

A small real-time squad-tactics game in the browser: five soldiers with
different weapons per side, directed from above, until one squad is wiped
out. It exists so the owner (Python background, new to TypeScript and game
dev) can build a complete game with Claude Code end to end, including the
cloud-session and pull-request workflow, and to recapture the feel of the
early-1990s squad-skirmish games. Plain TypeScript on HTML Canvas, no game
engine, no UI framework.

- Design spec: `docs/superpowers/specs/2026-11-01-muddle-and-mayhem-design.md`
- Decision log and roadmap: `docs/decisions.md`
- Live site: https://karlnewell.github.io/muddle-and-mayhem/

## Commands

- `npm run dev` starts the Vite dev server (open the URL it prints, at `/muddle-and-mayhem/`).
- `npm run check` runs typecheck, `lint:sim`, unit tests, and build. Run it before every commit.
- `npm run test:e2e` runs the Playwright tests against the built site. Run `npm run build` first.
  Set `PW_CHROMIUM_PATH` to a Chromium binary if the local Playwright has none of its own.
- `npm run measure` runs 60 AI-vs-AI battles headless and prints pacing statistics and per-class
  shots, hits, damage and downs; pass a JSON object of constant overrides to compare candidates,
  and `--blue=passive` or `--blue=holdline` for a scripted blue squad. Judge every tuning change by its output.
- Open the game with `?seed=N` to pin a battle and `?tune={...}` to try constant overrides (the
  same JSON the measure script takes; a TUNED badge shows while any is active). The game runs at half speed by
  default (title-screen and Esc-menu selector, remembered in `localStorage`); `?speed=0.5`, `0.75` or `1`
  overrides it for the visit. Speed scales real time only (a SPEED badge shows when not 0.5x); the battle, log and replay are unchanged. The result screen
  shows a per-class report and Copy report puts it on the clipboard as Markdown with the command
  log. `window.__mm` exposes seed, tick, log, state, overrides, stats and `report()`.

## Architecture rules

These protect the multiplayer and headless-testing goals. Do not bend them.

1. **Simulation / renderer split.** `src/sim/` lives in world coordinates and
   never imports from `src/render`, `src/input`, `src/ui`, or `src/game`, and
   never touches `document`, `window`, `performance`, `Date`, or `Math.random`.
   The renderer reads simulation state and draws it. Input translates clicks
   into commands. `src/game/` owns the clock, the session and the command log,
   and is the only code that calls `step`.
2. **Fixed timestep.** The simulation advances in fixed ticks. The render loop
   interpolates between ticks. Pause stops ticks.
3. **Commands, not mutations.** Every player and AI action is a command object
   tagged with the tick it applies to. The simulation consumes a command list
   per tick. Replays and lockstep multiplayer depend on this.
4. **Seeded randomness only.** The simulation gets randomness from
   `createRng` in `src/sim/rng.ts` and nowhere else. Same seed plus same
   command log equals the same battle, bit for bit.
5. **Cross-engine-safe arithmetic.** Code under `src/sim/` may use only
   `+ - * /`, `Math.sqrt`, `Math.floor`, `Math.abs`, `Math.min`, `Math.max`,
   `Math.imul`, integer bit operators (`| & ^ ~ << >> >>>`), and comparisons.
   Every other `Math` member is banned (`sin`, `cos`, `atan2`, `pow`, `exp`,
   `log`, `round`, `random`, all of them), and so is the `**` operator.
   Use squared distances; use dot products or a precomputed unit-vector table
   where an angle is needed. `npm run lint:sim` enforces this and fails CI.

## Working agreements

- Small pull requests, one plan task per PR where practical.
- `npm run check` green before pushing. CI runs the same steps plus the Playwright smoke test.
- Tests first for simulation code: write the failing Vitest case, then the code.
- Every tunable (speeds, ranges, damage, cooldowns, chances) goes in
  `src/sim/constants.ts` (Plan 2 creates it), never inline in logic.
- Every non-obvious decision gets a dated line in `docs/decisions.md`.
- Files are small and single-purpose: 200-400 lines typical, 800 max.
- Commit messages are plain, with no attribution trailers.

## Legal rules

Not legal advice; these are the project's rules. The spec's section 8 is the
authoritative statement.

- Never use the original game's title, its generals' names, its country
  names, or any other character or place name from it, anywhere in this
  repository. The spec lists the specific names to avoid; do not repeat them
  elsewhere.
- No sprites, sounds, music, text, or code from the original or its manual.
  Generic class words (Gunner, Launcher, Chucker, Scorcher, Blaster) are
  ordinary words and fine.
- Mechanics are inspiration; expression is ours. The "two bumbling rival
  generals" premise is a stock comic setup and the one deliberate wink at
  the original. No other names, places, lines, or jokes are borrowed.
- All assets original or openly licensed (CC0 / CC-BY / OFL). Source is MIT.
- Hobby, non-commercial.

## Plans

Plans live in `docs/superpowers/plans/`. Plan 1 (scaffold and pipeline) is
this repository's foundation. Plan 2 (headless deterministic simulation,
`docs/superpowers/plans/2026-11-02-plan-2-headless-simulation.md`) is
implemented: `src/sim/index.ts` is its public surface. Plan 3 (playable
game, `docs/superpowers/plans/2026-11-02-plan-3-playable-game.md`) is
implemented: `src/game/`, `src/render/`, `src/input/` and `src/ui/` on top
of the sim, with `src/main.ts` as the entry point. Plan 4 (pacing tuning,
`docs/superpowers/plans/2026-11-02-plan-4-pacing-tuning.md`) set the
constants for 60 to 90 second battles and added `npm run measure`. Plan 5
(tuning tools) added `?tune=`, the battle report and the hold-line squad.
Plan 6 (cover matters, `docs/superpowers/plans/2026-11-02-plan-6-cover-matters.md`)
made cover soak splash and had the computer's lobbers wait for contact. v1
is complete; what comes next is the roadmap in `docs/decisions.md`, one
design conversation and one plan per item.
