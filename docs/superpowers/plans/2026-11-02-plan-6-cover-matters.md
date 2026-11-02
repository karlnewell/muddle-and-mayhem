# Plan 6: Cover Matters — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make cover physically reduce splash damage, then make the attacker's charge cost something, one measured change per pull request, so that a squad holding a covered position is no longer an automatic loss while the AI-versus-AI pacing band and the passive-squad result hold.

**Why:** Plan 5's hold-line squad, a scripted blue side that walks to posts by the left wall gap and holds, lost 60 of 60 under the shipped balance with three red downs per battle, and the owner's own play agrees that holding ground feels pointless. Today cover blocks movement and line of sight only: direct rounds stop at it, but a grenade or rocket splash is full damage to everyone in the radius whatever stands between, and the red Scorcher walks into the line burning (a median 659 cone ticks, 22 seconds, per hold-line battle) because nothing slows it and the defenders cannot kill it before it arrives. The owner wants cover to matter as shot geometry, not as a readable adjacency rule.

**Architecture:** Three small sim changes, each behind one tunable so `?tune=` and `npm run measure` can try it. (1) `applySplash` in `src/sim/damage.ts` traces from the burst point to each soldier in the radius with the existing `firstCoverHit` and applies `COVER_SPLASH_FRACTION` of the damage when a cover tile lies between, or when the burst is flagged as absorbed; `advanceLobbed` in `src/sim/projectiles.ts` sets that flag when the landing tile is cover. (2) Movement reads the soldier's `firing` flag and scales its step by `FIRING_MOVE_FRACTION`, or (3) the Scorcher's `WeaponStats` gains a per-class fire-while-moving rule gated on a non-empty path; which of (2) and (3) ships is decided by measurement. Iteration order, rng draws and event order are unchanged throughout, so replays stay bit for bit. The hold-line posts in `scripts/holdline.mts` are re-sited first, with no sim change, so the instrument reads the rules it is meant to read.

**Tech Stack:** TypeScript strict, Vite, Canvas 2D, Vitest, Playwright, Node type stripping for scripts. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-01-muddle-and-mayhem-design.md` section 4 (cover, weapons) and section 7 (testing); the owner's design decisions of 2026-11-02 recorded in `docs/decisions.md`; `CLAUDE.md`.

## Global Constraints

- One measured change per pull request against `main`, small PRs, nothing merged by the implementer. Each PR body carries the measure table (ai, passive, holdline: blue wins, median length, first damage, red downs per battle) before and after, the command lines used, the decision line text, and what the owner should do next.
- `MAX_HP`, `MOVE_SPEED` and weapon ranges do not change in this plan.
- No random direct-hit cover chance: the owner rejected it. Direct fire is already physical.
- `src/sim/` keeps its arithmetic allowlist (`npm run lint:sim`), never imports from `render`, `input`, `ui` or `game`, never touches the DOM or the clock, and draws randomness only from `createRng`. `createAi` stays a pure function of state and its own rng stream.
- Every tunable in `src/sim/constants.ts` as a `let`, added to `TunableName`, `TUNABLE_NAMES` and the `overrideTuning` switch (or, for a weapon field, to `WeaponStats`, which `validateTuning` already covers).
- Tests first for sim code. Every non-obvious decision a dated line in `docs/decisions.md`. Files 200 to 400 lines, 800 max. Plain commit messages, no attribution trailers.
- `npm run check` and `npm run test:e2e` green before every push (in the cloud, `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium`).
- Never use the original game's names.
- Plan 5's deferred items (`validateTuning` prototype keys, `+` in a raw `?tune=`, empty `WEAPONS` lighting the badge, the clipboard fallback font) stay deferred unless one blocks a task.

## Measurement guards

Every tuning decision in this plan is judged by `npm run measure` over seeds 1 to 60 with `--blue=ai`, `--blue=passive` and `--blue=holdline`. The guards that must hold after every change:

- Passive blue still loses 60 of 60 (the AI is not neutered).
- AI versus AI: median battle length within 60 to 90 s, first damage near 10 s, and no class under about 10% or over about 35% of enemy downs (the "downs by weapon" row).
- The hold-line: win rate and red downs per battle are the measure of "cover matters". Baseline on `main` before this plan: 0 wins of 60, three red downs per battle.

Baseline on `main` (bd4a513), seeds 1 to 60:

| Blue | Blue wins | Median length | First damage | Red downs per battle |
|---|---|---|---|---|
| ai | 33 (55%) | 59.0 s | 9.6 s | 8 |
| passive | 0 (0%) | 54.2 s | 15.6 s | 2 |
| holdline | 0 (0%) | 57.3 s | 12.8 s | 3 |

AI-versus-AI downs by weapon: Gunner 129, Launcher 164, Chucker 116, Scorcher 240 (31%), Blaster 117. Against the hold-line, red downs inflicted: Scorcher 141, Blaster 98, Chucker 91, Gunner 66, Launcher 37.

## Decisions this plan makes

The first four are the owner's, made on 2026-11-02 and recorded in `docs/decisions.md` with Task 1; the rest are implementation decisions recorded as their tasks land.

1. **Holding a covered position should cost the attacker.** It must not be an automatic loss. The hold-line win rate and red downs per battle are the measure.
2. **Cover is shot geometry, not an adjacency rule.** "A soldier whose tile touches cover takes less splash" was rejected in favour of what the shot physically did: a trace from the burst point to the soldier.
3. **Cover soaks a lobbed shot that lands on top of it.** A grenade whose landing point lies inside a cover tile is absorbed, and everyone in its radius takes the reduced fraction.
4. **Expected effect.** The splash rule should move red downs per battle and battle length more than the hold-line win rate; the costly charge is the lever expected to lift the win rate. The random direct-hit cover chance is not wanted.
5. **Posts before rules.** The hold-line posts are re-sited in their own PR with no sim change, chosen by red downs per battle and the blue Blaster hit rate (36% on `main`), so the later PRs measure the rules and not the posts. Where the posts alone move the win rate, the later targets are read as a lift above that new baseline, with the guard that the hold-line must not come to win most battles (camping would then be the dominant play).
6. **`absorbed` is a parameter of `applySplash`, not a field of the `impact` event.** The renderer and the report do not need it; the event shape and the state hash stay as they are.
7. **The `damage` event records the soaked amount**, because it records "the amount requested" (decision of 2026-11-02) and the soaked amount is what the burst asked of the soldier. A soldier fully soaked at fraction 0 still receives a `damage` event of 0, so the stats and the hit flash still show the burst reached it; fraction 0 is a measurement setting, not a shipped value.
8. **A landing point off the map counts as absorbed.** `isBlocked` is true outside the map, and the map edge already counts as cover for projectiles (decision of 2026-11-02).
9. **Fire-while-moving becomes per class.** `WeaponStats.fireWhileMoving: boolean` replaces the global `FIRE_WHILE_MOVING`, gated on a non-empty path rather than on a `move` order, so an attack order still walking in counts as moving. The four other classes keep `true`, so their behaviour is unchanged.
10. **`FIRING_MOVE_FRACTION` reads last tick's `firing` flag**, because movement runs before firing in `step`; for a Scorcher the flag is continuous while it burns, for the other classes it is one tick per cooldown and the slowdown is negligible by design.

## Review Focus

Five ways this plan fails quietly, each pinned by a test in the task that owns it.

1. A grenade landing off the map edge beside a soldier at the border (spread exceeds the clamp margin). Expected: the burst is absorbed and the soldier takes the fraction. (Task 2, `lobbed.test.ts`)
2. A rocket's impact point computed a hair inside the cover tile rather than on its face. Expected: a soldier on the near side still takes full splash, because `firstCoverHit` never tests the start tile and the segment to the near side re-enters only open tiles. (Task 2, `projectiles.test.ts`)
3. `COVER_SPLASH_FRACTION` 0 producing a zero-damage event that the stats count as a hit. Expected and pinned: the event is emitted with amount 0 and hp is unchanged; the decision line says fraction 0 is for measurement only. (Task 2, `damage.test.ts`)
4. A Scorcher with `fireWhileMoving` false ordered to move away while an enemy stands in its cone. Expected: no burn while the path is non-empty, a burn on the first tick after it stops. (Task 3, `flame.test.ts`)
5. A soldier whose `firing` flag is stale after it goes down (`applyDamage` clears it) or after its target falls. Expected: a standing soldier with no target this tick moves at full speed on the next tick. (Task 3, `movement.test.ts`)

---

### Task 1: Plan document and hold-line posts (PR 1)

No sim change. The measure numbers for the sets tried go in the decision line and in the table below.

**Files:**
- Create: `docs/superpowers/plans/2026-11-02-plan-6-cover-matters.md` (this file)
- Modify: `docs/decisions.md` (the four design decision lines, then the posts line), `scripts/holdline.mts` (`HOLD_TILES` and the file comment), `tests/scripts/holdline.test.ts` (the focus-fire case places its enemy where the new posts give a majority), `README.md` (the hold-line sentence in Tuning states the new result)

- [x] **Step 1: Write this plan.**
- [x] **Step 2: Add the four design decision lines to `docs/decisions.md`.**
- [x] **Step 3: Measure candidate post sets.** For each candidate, edit `HOLD_TILES`, run `npm run measure -- --blue=holdline` over seeds 1 to 60, and read blue wins, red downs per battle and the blue Blaster hit rate. Candidates: the west faces of the wall arms ((11, 8) and (11, 12)), the crate groups at (8, 6)/(8, 7)/(9, 7) and (8, 14)/(8, 15)/(9, 15), and tiles just inside the road mouth. Keep the Launcher rearmost on the road axis, the Scorcher where chargers through the gap must pass it, and both lobbers within range of the gap (Chucker 224, Blaster 160 units). Confirm the top two sets on seeds 61 to 120.
- [x] **Step 4: Set `HOLD_TILES` to the chosen set, update the file comment, fix the focus-fire test, update the README sentence.** `npm run check` green.
- [x] **Step 5: Decision line** with every set tried and its numbers. Commit `Plan 6: plan and hold-line posts`.

**Results (seeds 1 to 60, shipped balance, posts only):**

| Posts (G, L, C, S, B) | Blue wins | Median length | Red downs | Blaster hit % |
|---|---|---|---|---|
| main: (9,8) (7,10) (9,12) (10,10) (11,12) | 0 | 57.3 s | 3 | 36% |
| road mouth: (12,9) (7,10) (11,12) (12,11) (11,8) | 1 | 59.3 s | 4 | 62% |
| crates: (9,8) (7,10) (9,14) (11,10) (8,13) | 4 | 66.3 s | 4 | 73% |
| arm faces: (11,8) (7,10) (11,12) (11,10) (10,12) | 5 | 60.3 s | 4 | 71% |
| arm faces, Blaster by the south crate: (11,8) (7,10) (11,12) (11,10) (8,13) | 9 | 67.4 s | 5 | 79% |
| **kept**: (11,8) (8,10) (11,12) (11,10) (8,13) | 16 | 71.4 s | 5 | 82% |

Seeds 61 to 120 confirm the last two: 9 wins (Launcher at (7, 10)) and 10 wins (Launcher at (8, 10)), red downs 4 and 5, Blaster 77% and 83%. The win rate is fragile: moving the Launcher one tile to (8, 9), (8, 11) or (9, 10) drops it to 0, 0 and 2 of 60, while red downs stay at 3 to 4. Red downs per battle and the Blaster hit rate are the robust gains; the win rate is reported, not relied on.

### Task 2: Cover soaks splash (PR 2)

**Files:**
- Modify: `src/sim/constants.ts` (`COVER_SPLASH_FRACTION`), `src/sim/damage.ts`, `src/sim/projectiles.ts`
- Test: `tests/sim/damage.test.ts`, `tests/sim/lobbed.test.ts`, `tests/sim/projectiles.test.ts`, `tests/sim/tuning.test.ts`
- Modify: `docs/decisions.md`, `README.md` (Tuning section only where it states the splash rule)

**Interfaces:**
```ts
// src/sim/constants.ts
export let COVER_SPLASH_FRACTION = 0.5;   // in TunableName, TUNABLE_NAMES and the overrideTuning switch

// src/sim/damage.ts
/**
 * Splash from (x, y). A standing soldier within the radius takes `amount`,
 * or `amount * COVER_SPLASH_FRACTION` when a cover tile lies on the segment
 * from the burst point to the soldier (`firstCoverHit`) or when `absorbed`
 * is true (a lobbed shot that landed inside cover). Id order, as before.
 */
export function applySplash(
  state: BattleState, x: number, y: number, radius: number, amount: number,
  weapon: SoldierClass, excludeId: number | null, sourceId: number, absorbed?: boolean,
): void;

// src/sim/projectiles.ts (internal)
// advanceLobbed: const t = worldToTile(p.targetX, p.targetY); applySplash(..., p.ownerId, isBlocked(state.map, t.tx, t.ty));
// advanceDirect: unchanged call (absorbed defaults to false): a rocket bursts at the face it struck.
```

- [ ] **Step 1: Failing tests in `tests/sim/tuning.test.ts`.** `TUNABLE_NAMES` contains `'COVER_SPLASH_FRACTION'`; `overrideTuning({ COVER_SPLASH_FRACTION: 0.25 })` makes `constants.COVER_SPLASH_FRACTION` 0.25 (restore in `afterEach`).
- [ ] **Step 2: Failing tests in `tests/sim/damage.test.ts`** on a hand-built map (`parseMap`) with one crate at tile (15, 3), x in [480, 512), y in [96, 128), and open ground around it:
  - `a soldier behind a crate takes the fraction and one in the open beside it takes full damage from the same burst`: burst at (470, 112), radius 80, amount 40; soldier 7 at (530, 112) (beyond the crate) ends at `MAX_HP - 40 * COVER_SPLASH_FRACTION`; soldier 2 at (470, 160) (open, 48 away) ends at `MAX_HP - 40`; events are `damage` 2 then `damage` 7 with those amounts.
  - `an absorbed burst gives everyone the fraction`: `absorbed = true`, burst at (496, 112) inside the crate, soldiers 2 at (470, 112) and 7 at (522, 112), radius 40: both end at `MAX_HP - 40 * COVER_SPLASH_FRACTION`.
  - `a soaked soldier still receives a damage event of the soaked amount`: with `overrideTuning({ COVER_SPLASH_FRACTION: 0 })`, the soldier behind the crate keeps `MAX_HP` and the event has `amount: 0`; restore the constant afterwards.
  - The existing open-ground splash tests are unchanged and still pass (no cover on the default map between the test points).
- [ ] **Step 3: Failing tests in `tests/sim/lobbed.test.ts`** with hand-built lobbed projectiles (copy the arena's wall at column 15):
  - `a grenade landing inside a wall tile is absorbed: everyone in the radius takes the fraction`: landing (496, 112), bystanders at (470, 112) and (522, 112): both take `splashDamage * COVER_SPLASH_FRACTION`.
  - `a grenade landing in the open beside a wall soaks only the far side`: landing (470, 112), bystander at (440, 112) takes full `splashDamage`, bystander at (522, 112) takes the fraction (the chucker's radius 40 reaches 52 only if the test uses its own radius; hand-build with `blaster` or set the bystanders within the weapon's radius).
  - `a grenade landing off the map is absorbed`: landing (-5, 256), bystander at (20, 256): takes the fraction.
  - Rename `ignores cover: a grenade landing beyond a wall still splashes` to say it arcs over cover and splashes at full strength when no cover lies between the landing point and the soldier; its assertions stand.
- [ ] **Step 4: Failing test in `tests/sim/projectiles.test.ts`.** In `splashes around a rocket stopped by cover`, move soldier 6 to the near side at (455, 112) (25 from the face, inside the 32 radius, open tile) and assert full `splashDamage`; add `a rocket that strikes a crate face deals full splash to the near side` as its own case if the existing one is kept for soldier 5's miss.
- [ ] **Step 5: Run `npx vitest run tests/sim`; expect failures on the missing tunable and the unchanged amounts.**
- [ ] **Step 6: Implement.** `constants.ts`: the `let`, the union member, the list entry, the switch case. `damage.ts`: import `firstCoverHit` from `./los` and `COVER_SPLASH_FRACTION`; inside the radius test, `const covered = absorbed || firstCoverHit(state.map, x, y, s.x, s.y) !== null;` then `applyDamage(state, s, covered ? amount * COVER_SPLASH_FRACTION : amount, weapon, sourceId)`. `projectiles.ts`: import `isBlocked, worldToTile` from `./map`; `advanceLobbed` computes the landing tile and passes `isBlocked(...)`. Update the file comments in both (`advanceLobbed` no longer says cover is never consulted). `npm run check` green, replay and hash tests included.
- [ ] **Step 7: Measure.** `npm run measure -- --blue=<ai|passive|holdline>` with `'{"COVER_SPLASH_FRACTION":0.5}'`, `0.25` and `0` (nine runs), seeds 1 to 60. Check the guards. Pick the shipped value by the guards and the hold-line numbers; set the `let` to it.
- [ ] **Step 8: Decision line** with the three-value table and the shipped value. README: the Tuning section mentions the new tunable only if it lists tunables by name (it refers to `constants.ts`); the Headless or gameplay text that says splash ignores cover is corrected. Commit `Plan 6: cover soaks splash`.

### Task 3: A costly charge (PR 3)

Measure both variants alone before choosing. Target: hold-line win rate lifted toward 25 to 35% (read against the Task 1 baseline, see decision 5) with four or more red downs in its losses, and the three guards intact. If the hold-line comes to win most battles, back the constant off rather than add a lever.

**Files:**
- Modify: `src/sim/constants.ts` (`FIRING_MOVE_FRACTION`; `WeaponStats.fireWhileMoving`; remove `FIRE_WHILE_MOVING`), `src/sim/movement.ts`, `src/sim/weapons.ts`
- Test: `tests/sim/movement.test.ts`, `tests/sim/weapons.test.ts`, `tests/sim/flame.test.ts`, `tests/sim/tuning.test.ts`, `tests/sim/constants.test.ts`
- Modify: `docs/decisions.md`, `README.md` (only where it states the rule)

**Interfaces:**
```ts
// src/sim/constants.ts
export let FIRING_MOVE_FRACTION = 1;      // variant (a); 1 means no slowdown; in TunableName, TUNABLE_NAMES, the switch
export interface WeaponStats { /* ... */ fireWhileMoving: boolean }   // variant (b); true for every class but as measured
// FIRE_WHILE_MOVING is removed.

// src/sim/movement.ts (internal): followPath(s) steps MOVE_SPEED * (s.firing ? FIRING_MOVE_FRACTION : 1)
// src/sim/weapons.ts (internal): after the cooldown check,
//   if (!weapon.fireWhileMoving && s.path.length > 0) continue;   // replaces the FIRE_WHILE_MOVING / order.kind === 'move' check
```

- [ ] **Step 1: Failing tests, variant (a), `tests/sim/movement.test.ts`.** A standing soldier with a one-waypoint path 100 units east and `firing = true` moves `MOVE_SPEED * FIRING_MOVE_FRACTION` in one `moveSoldiers` call (set `overrideTuning({ FIRING_MOVE_FRACTION: 0.5 })` for the test and restore); with `firing = false` it moves `MOVE_SPEED`; a soldier downed by `applyDamage` has `firing` false (already covered in `damage.test.ts`; assert the next tick's speed is full for a standing soldier whose `firing` was cleared by `fireWeapons` finding no target).
- [ ] **Step 2: Failing tests, variant (b), `tests/sim/flame.test.ts` and `tests/sim/weapons.test.ts`.** With `overrideTuning({ WEAPONS: { scorcher: { fireWhileMoving: false } } })`: a scorcher with a target in its cone and a non-empty path does not set `firing` and deals no damage that tick; the same scorcher with an empty path burns; a scorcher under an attack order walks in without burning a different enemy it passes within 72 of, and burns once it stops in range of its target. A gunner with a `move` order still fires (`fireWhileMoving` true by default); replace the two `it.runIf(FIRE_WHILE_MOVING)` cases with these.
- [ ] **Step 3: Run; expect failures on the missing field and tunable.**
- [ ] **Step 4: Implement both** behind their defaults (`FIRING_MOVE_FRACTION` 1, every `fireWhileMoving` true) so shipped behaviour is unchanged until the measurement picks. `validateTuning` accepts the boolean field already (same `typeof`). `npm run check` green.
- [ ] **Step 5: Measure each variant alone**, seeds 1 to 60, ai, passive and holdline: `'{"FIRING_MOVE_FRACTION":0.5}'`, `'{"FIRING_MOVE_FRACTION":0.25}'`, `'{"WEAPONS":{"scorcher":{"fireWhileMoving":false}}}'`. Record the table. Then the chosen variant together with the shipped `COVER_SPLASH_FRACTION` (already in the code from PR 2).
- [ ] **Step 6: Ship the choice**: set the default(s) in `constants.ts`; if a variant is kept as a tunable but not used, say so in the decision line. If red needs an AI change to stay competent (for example the Scorcher waiting for a direct weapon to engage), it goes in `src/sim/ai.ts` as a pure function of state with the determinism tests green, and gets its own line.
- [ ] **Step 7: Decision line** with what each variant did and which shipped. README: the paragraph on firing while moving, if any. Commit `Plan 6: a costly charge`.

### Task 4: Attacker spread (PR 4, only if Task 3 leaves the hold-line below target)

**Files:**
- Modify: `src/sim/ai.ts` (and `src/sim/aiPositions.ts` if the rule needs a tile score), `src/sim/constants.ts` (one tunable)
- Test: `tests/sim/ai.test.ts`

Two candidate rules, each a pure function of state: (a) stagger the approach: a lobber (Chucker, Blaster) holds its current tile until a friendly direct-fire soldier (Gunner, Launcher) has an enemy within range, read from `inRange` over the state; (b) spread the columns: `bestFiringTile` penalises a tile within `AI_APPROACH_SPACING` tiles of another friendly's destination, so the squad does not arrive through the gap as one file. Measure each alone as in Task 3; ship at most one; keep `createAi` deterministic (the ai determinism test, replay test and hash test stay green).

- [ ] Steps as Tasks 2 and 3: failing test, implement, measure, decision line, commit `Plan 6: attacker spread`.

### Task 5: Finish

- [ ] Tick every box, fill in the result tables, `npm run check` and `npm run test:e2e` green on the last PR, and close the plan with a decision line giving the final numbers (ai, passive, holdline) and what was tried and rejected.

## Self-review

- Spec coverage: decisions 1 to 4 land in Task 1's decision lines; the splash geometry in Task 2; the charge in Task 3; the conditional AI lever in Task 4; the guards in Measurement guards; the closing line in Task 5.
- Type consistency: `applySplash`'s ninth parameter `absorbed?: boolean` is what `advanceLobbed` passes and `damage.test.ts` calls; `COVER_SPLASH_FRACTION`, `FIRING_MOVE_FRACTION` and `WeaponStats.fireWhileMoving` are named the same in every task.
- Proportion: bodies are given only where the signature and tests leave a choice (the covered predicate, the gate expression); everything else is signatures, test names and assertions.
