# Plan 8: Per-class Health and Speed — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each class its own maximum health and walking speed through a `CLASS_STATS` table in `constants.ts`, first at today's values as a measured no-op, then with a fragile, fast Scorcher and a slower, slightly fragile Launcher, judged by `npm run measure` against the spec's guards with at most one measured change per pull request.

**Why:** The red Scorcher has decided most of the owner's battles since Plan 4. Plan 6 showed that slowing it while firing or silencing it while walking changes nothing (it walks in silently, arrives with half its health and burns) and named per-class health or speed as the lever. The owner finds steering single soldiers hard, so the fix must make the Scorcher fragile, not fiddly. Today, on Compact Crossroads over seeds 1 to 60: AI versus AI 24 blue wins (40%), 57.6 s median, first damage 4.8 s, share of enemy downs 13 / 25 / 20 / 29 / 14% (Gunner / Launcher / Chucker / Scorcher / Blaster); passive 0; hold-line 17 (28%).

**Architecture:** One data table replaces two scalars. `CLASS_STATS` is a `let` binding beside `WEAPONS`, so `overrideTuning` can merge candidate values per class the way it merges weapon fields, and the validation is the weapon validation generalised to a second per-class table. The three simulation readers index the table by `s.cls`; the two health-bar readers call one exported `hpFraction(s)` in `src/sim/soldiers.ts`, so the battlefield bar and the HUD card bar cannot disagree. No rule changes: with every class at 160 and 1.8 the battle is the same bit for bit, which the measure output proves.

**Tech Stack:** TypeScript strict, Vite, Canvas 2D, Vitest, Playwright, Node type stripping for scripts. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-03-plan-8-class-stats-design.md`; `CLAUDE.md`.

## Global Constraints

- `CLASS_STATS: Record<SoldierClass, { maxHp: number; speed: number }>`, absolute values, in `src/sim/constants.ts` beside `WEAPONS`. `MAX_HP` and `MOVE_SPEED` leave the code, `TunableName` and `TUNABLE_NAMES`.
- Starting values (Task 3): Scorcher 100 and 2.07; Launcher 140 and 1.53; Gunner, Chucker, Blaster 160 and 1.8.
- No other rule changes: the AI, `scripts/holdline.mts`, cover, medics, weapons and `REVIVE_FRACTION` / `FIRING_MOVE_FRACTION` untouched.
- Targets (Compact Crossroads, seeds 1 to 60, confirmed on 61 to 180): AI versus AI median 55 to 90 s, first damage 3 to 6 s; hold-line 25 to 35%; passive 0%; every class 10% to 35% of enemy downs AI versus AI; the Scorcher at most 22% and not the top killer.
- Levers, one measured PR each, only for a failing guard: Scorcher health, Scorcher speed, Launcher speed, Launcher health, then reload (`cooldown`). After all five, stop and name the guard.
- `src/sim/` keeps its arithmetic allowlist (`npm run lint:sim`) and never imports from `render`, `input`, `ui` or `game`.
- Tests first for logic. Every non-obvious decision a dated line in `docs/decisions.md`.
- Files 200 to 400 lines, 800 max. Plain commit messages, no attribution or co-author trailers.
- `npm run check` and `npm run test:e2e` green before every push (`PW_CHROMIUM_PATH=/opt/pw-browsers/chromium` in the cloud).
- One PR per step, each cut from the previous branch while the earlier one awaits review; rebase on `main` after a merge. Never use the original game's names.

## Decisions this plan makes

Recorded in `docs/decisions.md` as the work lands.

1. **One health-fraction function.** `hpFraction(s: Soldier): number` in `src/sim/soldiers.ts`, exported from `src/sim/index.ts`, returns `hp / CLASS_STATS[s.cls].maxHp` clamped to 0 to 1. The renderer and the HUD both call it; neither reads `CLASS_STATS` for the bar itself.
2. **Validation shared between per-class tables.** `validateTuning` checks `WEAPONS` and `CLASS_STATS` with one helper that takes the table name, the current table and the noun for its fields (`weapon field`, `class stat`), so both reject the same five ways with the same message shapes: `overrideTuning: unknown class <cls>`, `overrideTuning: unknown class stat <cls>.<field>`, `overrideTuning: <cls>.<field> must be a number`.
3. **Tests that pin a hit against a soldier's health use that soldier's class.** Existing tests that compared with `MAX_HP` compare with `CLASS_STATS[target.cls].maxHp`, so they keep meaning the same thing when Task 3 changes the Scorcher and the Launcher; tests that compared a walk with `MOVE_SPEED` use the walker's class `speed`.
4. **Preview before shipping.** Task 2's PR body carries the starting values measured headless as overrides; Task 3 ships them only after the owner has played the live `?tune=` link.

## Review Focus

Five ways this plan fails quietly, each pinned by a test in the task that owns it.

1. A reader still uses one class's value for every class (for instance `CLASS_STATS.gunner.maxHp`), which no test notices while every class is 160 and 1.8. The sim tests override every class to a different value before asserting starting health, revive health and step length per class. (Task 2)
2. Revive uses the class maximum but the bar uses another maximum, so a revived Scorcher reads 50% on one bar and 31% on the other. Both readers call `hpFraction`, and its test covers an overridden class. (Task 2)
3. A partial `CLASS_STATS` override replaces the whole table, so `{"CLASS_STATS":{"scorcher":{"maxHp":100}}}` leaves the Scorcher with no `speed` (`NaN` positions) or every other class missing. The tuning test applies a one-field override and asserts the other field and the other four classes are unchanged. (Task 2)
4. A bad `CLASS_STATS` value is half applied: an earlier valid class is merged before a later one is rejected. The tuning test passes a valid class then an invalid one and asserts the table is unchanged. (Task 2)
5. The refactor changes a battle (an order of reads, a speed computed differently) and every later measurement compares against the wrong baseline. The byte-identical measure comparison in the PR body, plus the existing determinism and replay tests. (Task 2)

---

### Task 1: Spec and plan (PR 1)

- [x] Write the spec and this plan; add a dated decision line recording the design. Commit `Plan 8 spec and plan`; open PR "Plan 8 spec and plan".

### Task 2: Per-class health and speed at today's values (PR 2)

**Files:**
- Modify: `src/sim/constants.ts` (`ClassStats`, `CLASS_STATS`, override types, validation, merge; drop `MAX_HP`, `MOVE_SPEED`), `src/sim/soldiers.ts` (start hp, `hpFraction`), `src/sim/medic.ts` (`revive`), `src/sim/movement.ts` (`followPath`), `src/sim/index.ts` (export `hpFraction`), `src/render/drawSoldiers.ts`, `src/ui/hud.ts`, `scripts/measure-pacing.mts` (usage comment), `README.md` (Tuning section), `e2e/tune.spec.ts`
- Modify tests that import `MAX_HP` or `MOVE_SPEED`: `tests/sim/{damage,lobbed,projectiles,weapons,flame,medic,battle,movement,tuning}.test.ts`, `tests/game/tuning.test.ts`, `tests/ui/debugText.test.ts`, `tests/stats/battleStats.test.ts`, `tests/game/session.test.ts`
- Test: `tests/sim/classStats.test.ts`, `tests/sim/tuning.test.ts`, `tests/game/tuning.test.ts`

**Interfaces:**
```ts
// src/sim/constants.ts
export interface ClassStats { maxHp: number; speed: number }
export let CLASS_STATS: Readonly<Record<SoldierClass, Readonly<ClassStats>>>;  // every class { maxHp: 160, speed: 1.8 } in this task
export type TuningOverrides = Partial<Record<TunableName, number>> & {
  WEAPONS?: Partial<Record<SoldierClass, Partial<WeaponStats>>>;
  CLASS_STATS?: Partial<Record<SoldierClass, Partial<ClassStats>>>;
};
// src/sim/soldiers.ts
export function hpFraction(s: Soldier): number;  // clamp(hp / CLASS_STATS[s.cls].maxHp, 0, 1)
```

- [x] **Step 1: Failing tests.** `tests/sim/classStats.test.ts`, each test restoring `CLASS_STATS` afterwards:
  - `CLASS_STATS` lists exactly the five classes of `CLASS_ORDER`, each `{ maxHp: 160, speed: 1.8 }`.
  - With `{ gunner: 150, launcher: 140, chucker: 130, scorcher: 100, blaster: 120 }` as `maxHp` overrides, every soldier of `createBattle({ seed: 1 })` has `hp === CLASS_STATS[s.cls].maxHp`.
  - Under the same override, a downed soldier of each class revived by a medic run stands at `Math.floor(CLASS_STATS[cls].maxHp * REVIVE_FRACTION)` (Scorcher 50, Launcher 70); reuse the medic test's call-and-arrive helper.
  - With `speed` overrides `{ gunner: 1.8, launcher: 1.5, chucker: 1.7, scorcher: 2.1, blaster: 1.6 }`, a soldier of each class ordered 5 tiles east along an open row moves `speed` in x on its first moving tick; with `FIRING_MOVE_FRACTION` 0.5 and `firing` true, `speed * 0.5`.
  - `hpFraction`: a Scorcher with `maxHp` 100 at hp 50 is 0.5; a Gunner at hp 80 is 0.5; hp -5 is 0; hp above the maximum is 1.

  `tests/sim/tuning.test.ts` additions:
  - `overrideTuning({ CLASS_STATS: { scorcher: { maxHp: 100 } } })` sets the Scorcher's `maxHp` to 100 and leaves its `speed` 1.8 and the other four classes as they were.
  - `validateTuning` rejects `{ CLASS_STATS: 3 }` (`/CLASS_STATS must be an object/`), `{ CLASS_STATS: { medic: { maxHp: 1 } } }` (`/unknown class medic/`), `{ CLASS_STATS: { scorcher: { armour: 1 } } }` (`/unknown class stat scorcher.armour/`), `{ CLASS_STATS: { scorcher: { maxHp: '100' } } }` and `{ CLASS_STATS: { scorcher: { speed: Infinity } } }` and `{ CLASS_STATS: { scorcher: { speed: NaN } } }` (`/must be a number/`), `{ CLASS_STATS: { scorcher: 5 } }` (`/must be an object of fields/`).
  - `overrideTuning({ CLASS_STATS: { scorcher: { maxHp: 100 }, launcher: { armour: 1 } } })` throws and leaves `CLASS_STATS` equal to its value before the call.
  - `MAX_HP` and `MOVE_SPEED` are not in `TUNABLE_NAMES`; `validateTuning({ MAX_HP: 120 })` throws `/unknown tunable MAX_HP/`.

  `tests/game/tuning.test.ts`: `readTune('?tune={"CLASS_STATS":{"scorcher":{"maxHp":100,"speed":2.07}}}')` is active with those overrides; `?tune={"MOVE_SPEED":2}` comes back inactive with an `unknown tunable` error.
- [x] **Step 2: Run `npx vitest run tests/sim/classStats.test.ts tests/sim/tuning.test.ts tests/game/tuning.test.ts`; expect failures on the missing exports.**
- [x] **Step 3: Implement** per the interfaces and decisions 1 and 2; `hud.ts` and `drawSoldiers.ts` call `hpFraction`. Update the other tests per decision 3, and the tests that used `MOVE_SPEED` as an example override to use another tunable (`MEDIC_SPEED`) so they keep testing what they tested. `e2e/tune.spec.ts`: the override gains `CLASS_STATS: { scorcher: { maxHp: 100 } }` and the test asserts the red Scorcher (id 8) starts the battle at hp 100.
- [x] **Step 4: README.** The Tuning section says scalars go by name and `WEAPONS` and `CLASS_STATS` are merged per class, with a `CLASS_STATS` example; the measure script's usage comment uses an existing tunable in its example.
- [x] **Step 5: `npm run check` and `npm run build && npm run test:e2e` green.** Commit `Per-class health and speed table at today's values`.
- [x] **Step 6: No-op proof.** With `main` checked out in a worktree, `npm run measure -- --blue=ai`, `--blue=passive` and `--blue=holdline` (seeds 1 to 60) into one directory per tree; `diff -r before after` prints nothing. Command and empty result into the PR body.
- [x] **Step 7: Preview.** `npm run measure` with `{"CLASS_STATS":{"scorcher":{"maxHp":100,"speed":2.07},"launcher":{"maxHp":140,"speed":1.53}}}` for `ai`, `passive`, `holdline` on seeds 1 to 60 and 61 to 180; a table against every guard into the PR body with the live-site link (readable and encoded, spec section 5). Open PR 2 "Per-class health and speed", noting it is cut from PR 1's branch.

### Task 3: Fragile Scorcher, heavy Launcher (PR 3)

**Files:**
- Modify: `src/sim/constants.ts` (`CLASS_STATS` starting values), `docs/decisions.md`
- Modify: tests that pin a whole-battle outcome or a hash, if any change (determinism tests compare two runs and need nothing)
- Test: `tests/sim/classStats.test.ts`

- [x] **Step 1: Failing test.** Replace the "every class 160 and 1.8" assertion with the shipped table: Gunner, Chucker, Blaster `{ maxHp: 160, speed: 1.8 }`, Launcher `{ maxHp: 140, speed: 1.53 }`, Scorcher `{ maxHp: 100, speed: 2.07 }`.
- [x] **Step 2: Run; expect the one failure.**
- [x] **Step 3: Set the values** and a comment on `CLASS_STATS` naming the roles (spec section 4).
- [x] **Step 4: `npm run check` and the e2e tests green.**
- [x] **Step 5: Measure** `ai`, `passive`, `holdline` on seeds 1 to 60 and 61 to 180 before (today's values) and after; a table of every guard, before and after, into the PR body and a decision line. Commit `Fragile Scorcher, heavy Launcher`. Open PR 3 "Fragile Scorcher, heavy Launcher", cut from PR 2's branch; its body asks the owner to play the PR 2 link and paste two or three reports before merging.
- [ ] **Step 6: Stop and report.** Lever PRs start only if a guard fails on Step 5's numbers.

### Task 4: Levers, only where a guard fails (PR 4 onward)

- [ ] **Step 1:** For the first failing guard, the first lever in order (Scorcher health, Scorcher speed, Launcher speed, Launcher health, reload) that has not been tried: measure two or three candidate values as overrides on seeds 1 to 60, keep the one that meets the guard without breaking another, confirm on 61 to 180.
- [ ] **Step 2:** One PR: the change in `CLASS_STATS` (or `WEAPONS[cls].cooldown` for reload), the test in `classStats.test.ts` updated first, before-and-after table, decision line.
- [ ] **Step 3:** Repeat for the next failing guard; after the fifth lever, stop and name the guard still failing.

### Task 5: Close (last PR of the plan)

- [ ] Re-measure on seeds 1 to 60 and 61 to 180; a closing decision line with the final numbers, what was tried and rejected; roadmap item 13 marked done in the roadmap's style (removed from the roadmap, which lists only work still to do, and the closing line says so). If no lever PR is needed, this goes in PR 3.
