# Plan 4: Pacing Tuning — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Battles against the computer that last about 60 to 90 seconds of game time, with first contact around 10 seconds in and enough time between contact and the end for the player to pause, re-order and call the medic two or three times, and a computer opponent that actually spends its medic calls. Measured, not guessed: a script runs the real simulation over many seeds and prints the numbers before and after.

**Why:** The owner's first hands-on matches ended in 11 to 22 seconds. First contact came at about 5 seconds because `MOVE_SPEED` 3.2 is three tiles a second on a 40-tile map, and the Gunner (8 damage every 6 ticks) downs a 100 HP soldier in 2.5 seconds. On seed 7, five of ten soldiers were down four seconds after contact. Two defects showed up at the same time: the red AI never called a medic in a close fight, and pressing `M` twice called the medic for the same soldier twice.

**Approach:** This is a tuning pass, not a feature. Values change only in `src/sim/constants.ts` (plus any new `AI_*` constant). The two defects are fixed tests-first. A measurement script (`npm run measure`) is the source of truth for every claim about pacing, and it imports `src/sim` so it measures the shipped code. Class identity is preserved: Launcher longest range, Scorcher shortest, Gunner fastest firing, Blaster slowest.

**Out of scope:** AI difficulty levels, new weapons or classes, map changes, any renderer or UI change beyond what the `M` fix needs. Those stay on the roadmap in `docs/decisions.md`.

## Global Constraints

- `src/sim/` keeps its arithmetic allowlist (`npm run lint:sim`), its determinism, and its replay guarantee. No new rng draws that depend on anything but state and the AI's own stream.
- Every tunable in `constants.ts`; every constant change gets a dated line in `docs/decisions.md` with old value, new value and why.
- Tests first for the AI medic change and the `M` key change. Existing tests that encode old numbers may be updated when they are about the numbers; determinism and replay tests are never weakened.
- `npm run check` and the Playwright tests green before every commit. Plain commit messages, no attribution trailers.
- Files 200 to 400 lines, 800 max.

## Decisions this plan makes

Recorded in `docs/decisions.md` as the work lands.

1. **Measurement script.** `scripts/measure-pacing.mts` runs `runBattle` AI versus AI over 60 seeds by default and prints median and range of battle length in seconds, median tick of first damage, downs per side, medic calls spent per side, the winner split, and the share of draws or tick-cap hits. It takes constant overrides as a JSON argument (`npm run measure -- '{"MOVE_SPEED":2}'`) or the `MM_OVERRIDES` environment variable, so candidate sets are compared without editing the file. To make that possible, the gameplay tunables in `constants.ts` are `let` bindings and `overrideTuning` reassigns them; ES module live bindings mean every sim module sees the new value. The game never calls it. `runBattle` gains an optional `onStep` observer so the script can count events without copying the runner.
2. **Runner.** The script is plain TypeScript run by Node's own type stripping, with `scripts/ts-resolve.mjs` adding the `.ts` extension to the extensionless relative imports under `src/`. No new dependency.
3. **AI medic use.** `bodyIsSafe` stays as the preferred case, and two more cases let the AI revive under pressure: the side has fewer than `AI_MEDIC_DESPERATE_STANDING` soldiers standing, or the body has been down for at least `AI_MEDIC_PATIENCE_TICKS`. Soldiers carry a `downedTick` field in the simulation state (the tick they went down, -1 while standing), so the AI stays a pure function of state and needs no memory of its own.
4. **Double `M`.** The key skips downed soldiers that already have a medic run under way (`state.medics` entries carry `targetId`), so a second press targets the next downed selected soldier, or does nothing when none is left. Right-click on a downed friendly already fails inside the sim (`callMedic` rejects a duplicate), so it needs no change.
5. **Tuning direction.** Slow the approach (`MOVE_SPEED`), lengthen cooldowns, trim damage, widen spread so most rounds miss, shrink splash so one grenade rarely catches two, and raise `MAX_HP` once the weapons are weak enough for it to matter. The exact values are whatever the script says reaches the goal across seeds; the starting candidate is listed in Task 4.
6. **AI spacing.** The one AI behaviour added: `bestFiringTile` penalises a tile with a standing friendly on any of its eight neighbours by `AI_SPACING_PENALTY`. The measurements showed splash on the AI's own bunching accounted for most downs, which is the collapse the task describes.

## Tasks

### Task 1: Plan document

- [x] Write this plan. Commit `Plan 4: pacing tuning plan`.

### Task 2: Measurement before tuning

**Files:** `scripts/measure-pacing.mts`, `scripts/ts-resolve.mjs`, `package.json` (`measure` script), `src/sim/constants.ts` (the `tuning` object), every sim module that reads a tunable.

- [x] Script prints the statistics above over at least 50 seeds and accepts overrides.
- [x] Baseline recorded here and in the pull request.

**Baseline (current `main`, seeds 1 to 60, AI versus AI):**

| Statistic | Value |
|---|---|
| Battle length, median | 14.6 s |
| Battle length, range | 9.9 to 19.5 s |
| First damage, median | 5.4 s (range 5.0 to 5.4) |
| Contact to end, median | 9.2 s |
| Downs per battle, median | blue 5, red 4 |
| Medic calls used, total over 60 battles | blue 16, red 11 (of 180 each) |
| Winner split | blue 29, red 31 |
| Draws, tick-cap hits | 0, 0 |

With a passive blue squad that never moves: median 17.7 s, first damage 9.2 s, red wins all 60.

### Task 3: Fix the two defects, tests first

- [x] `tests/sim/ai.test.ts`: a soldier downed in the middle of a fight, with enemies in range of the body, gets a medic call within `AI_MEDIC_PATIENCE_TICKS` plus one think interval; a side down to fewer than `AI_MEDIC_DESPERATE_STANDING` standing calls at once; a safe body still calls at once; a body with a run under way is still skipped.
- [x] `src/sim/ai.ts`: implement, keep determinism (the AI test that compares two runs stays green).
- [x] `tests/input/interpret.test.ts`: `M` with two downed soldiers selected and a run already heading for the first targets the second; with runs for both, emits nothing.
- [x] `src/input/interpret.ts`: implement.
- [x] `npm run check`, commit `Plan 4 task 3: AI uses its medic calls; M skips soldiers already being revived`.

### Task 4: Tune

Starting candidate, measured first and then adjusted from the numbers: `MOVE_SPEED` 3.2 to 2.0; Gunner cooldown 6 to 10, damage 8 to 6, spread 14 to 24; Launcher cooldown 75 to 120; Chucker cooldown 60 to 90; Blaster cooldown 105 to 150; Scorcher damage per tick 1 to 0.6. `AI_THINK_TICKS` may rise if the AI's rush needs slowing. One small deterministic AI behaviour is allowed, behind constants, if the straight-line group rush is what collapses fights.

- [x] Iterate with `npm run measure` until median battle length is 60 to 90 seconds with first contact near 10 seconds over 60 seeds.
- [x] Check that a passive blue squad (never moves) still loses, so the AI is not neutered.
- [x] Update tests that are legitimately about the old numbers. `npm run check` and `npm run test:e2e` green.
- [x] Commit `Plan 4 task 4: pacing constants and AI spacing`.

**Final (seeds 1 to 60, AI versus AI):**

| Statistic | Baseline | Final |
|---|---|---|
| Battle length, median | 14.6 s | 62.8 s |
| Battle length, range | 9.9 to 19.5 s | 49.9 to 101.1 s |
| First damage, median | 5.4 s | 9.6 s |
| Contact to end, median | 9.2 s | 53.5 s |
| Downs per battle, median | blue 5, red 4 | blue 7, red 8 |
| Medic calls used, total of 180 each | blue 16, red 11 | blue 180, red 180 |
| Winner split | blue 29, red 31 | blue 36, red 24 |
| Draws, tick-cap hits | 0, 0 | 0, 0 |

Seeds 61 to 160 give a median of 64.1 s. A passive blue squad still loses 60 of 60, median 59.7 s, first damage 15.6 s.

Constants: `MOVE_SPEED` 3.2 to 1.8; `MAX_HP` 100 to 160; Gunner cooldown 6 to 18, damage 8 to 5, spread 14 to 40; Launcher cooldown 75 to 270, damage 45 to 35, splash radius 40 to 32, splash damage 25 to 20, spread 10 to 16; Chucker cooldown 60 to 210, splash radius 48 to 40, splash damage 35 to 30, spread 20 to 36; Blaster cooldown 105 to 300, splash radius 40 to 32, splash damage 70 to 55, spread 16 to 30; Scorcher damage per tick 1 to 0.2. New: `AI_SPACING_PENALTY` 3, `AI_MEDIC_PATIENCE_TICKS` 90, `AI_MEDIC_DESPERATE_STANDING` 3. Ranges unchanged.

### Task 5: Docs

- [x] A dated line in `docs/decisions.md` for every constant change and for both fixes. README updated only where it states a changed number. Tick every box here. Commit `Plan 4 task 5: decisions and docs`.

## Self-review

- Does `npm run measure` import `src/sim` and nothing copied from it? Yes: the overrides go through the `tuning` object the sim itself reads.
- Can the AI's new medic rule change its commands without a state change? No: the down tick memory is written only from observed states, and `createAi` with the same seed over the same state sequence writes the same memory.
- Could the `M` fix drop a legitimate call? Only a soldier that already has a run heading for it is skipped, and `callMedic` would have rejected that call anyway.
