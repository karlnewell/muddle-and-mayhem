# Plan 5: Tuning Tools — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every one of the owner's play sessions cheap to run and informative, so balance can be tuned one measured change at a time: candidate constants from the URL, a per-class battle report on the result screen that pastes into an issue as Markdown, the same numbers from `npm run measure`, and a scripted blue squad that plays more like a person than the AI does. No balance constant changes in this plan.

**Why:** The owner has played and says balance feels off (the Launcher seems not to fire back; its cooldown is 270 ticks and it needs line of sight), but he cannot play many sessions, and the AI-versus-AI numbers differ from human play. Today a hypothesis costs an edit, a build and a deploy, and a game ends with "who won" and nothing else.

**Architecture:** Nothing in `src/sim/` learns about URLs, reports or the browser. Three additions sit beside it. `src/game/tuning.ts` reads `?tune=` and applies it through the existing `overrideTuning` before any battle exists; the live `let` bindings in `constants.ts` carry the values across Play again and Restart for free. `src/stats/` is a new layer that depends only on sim types and events: a collector that watches each stepped state and accumulates per-side, per-class statistics, and a formatter that turns them into fixed-width rows for the canvas and a Markdown block for the clipboard. The session feeds the collector; the measure script feeds the same collector, so the browser and the headless run print the same numbers from the same code. The sim gains one additive field, `sourceId` on the `damage` event, because the stats need to know who dealt splash and flame to a friendly. The scripted blue controller lives under `scripts/`, not `src/sim/ai.ts`, so the shipped opponent is untouched.

**Tech Stack:** TypeScript strict, Vite, Canvas 2D, Vitest, Playwright, Node type stripping for scripts. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-01-muddle-and-mayhem-design.md` section 5 (architecture) and section 7 (testing); the task brief for this plan; `CLAUDE.md`.

## Global Constraints

- No balance constant changes. `src/sim/constants.ts` changes only to add validation and the game-facing comment.
- `src/sim/` keeps its arithmetic allowlist (`npm run lint:sim`), never imports from `render`, `input`, `ui` or `game`, and never touches the DOM or the clock. The only sim change is additive: `sourceId` on the `damage` event and a `validateTuning` helper.
- Nothing outside `src/sim/` mutates sim state. The stats collector reads `state.events` and `state.soldiers` after each step and writes to its own object.
- Every tunable in `constants.ts`; layout numbers in `uiConstants.ts` or `renderConstants.ts`.
- Tests first for logic. Every non-obvious decision a dated line in `docs/decisions.md`.
- Files 200 to 400 lines, 800 max. Plain commit messages, no attribution trailers.
- `npm run check` and `npm run test:e2e` green before every commit.
- Never use the original game's names.

## Decisions this plan makes

Recorded in `docs/decisions.md` as the work lands (Task 8).

1. **URL parameter shape.** `?tune=<JSON>` holds exactly the `TuningOverrides` object the measure script accepts, URL-encoded or not (`URLSearchParams` decodes both). The game validates it with a new side-effect-free `validateTuning` in `constants.ts`; `overrideTuning` now validates before it assigns, so a bad override changes nothing. An invalid value never crashes the page: the battle starts with shipped balance and the error shows in the debug overlay and in `window.__mm.tuneError`.
2. **TUNED badge.** A small yellow "TUNED" label in the top bar beside the title whenever any override is active, so a screenshot is never mistaken for shipped balance. The debug overlay prints the override JSON.
3. **`sourceId` on `damage` events.** Each side has one soldier per class, so a damage event's weapon alone would identify the shooter if there were no friendly fire; splash and flame make it ambiguous. The event gains the shooter's id. The event shape is part of the serialised state, so every state hash changes, but run and replay change together and no test pins a hash value.
4. **Report fields.** Per side and class: shots fired (shot events; for the Scorcher, ticks with the cone active), hits (ticks on which the shooter damaged at least one enemy, so a grenade catching two is one hit and the rate stays at most 100%), hit rate, damage dealt (the amount the weapon asked for, overkill included, as the `damage` event records it), damage taken, downs inflicted on enemies, times downed, instant kills, seconds spent downed (ticks with status `downed`, dead not counted), medic calls spent on that class. Per battle: seed, overrides, ticks, time, winner, first-contact tick.
5. **Copy report.** A Markdown block: a summary list, the per-class table, the overrides JSON, and the full command log as JSON inside a collapsed `<details>`, so an issue reader sees the table and a replayer has everything. Clipboard through `navigator.clipboard.writeText`; when that is missing or rejects, a DOM text area with the same text appears over the canvas so it can be selected by hand.
6. **Hold-line controller.** `--blue=holdline` in the measure script: at tick 0 every soldier moves to a fixed post beside cover west of the left wall gap; at post it holds and, when a majority of the standing squad can fire at the enemy nearest the squad's centre, attacks that one; a soldier whose attack target slips out of reach holds again, and one that has drifted a half tile from its post walks back; it calls the medic for the first downed friendly (in `AI_REVIVE_PRIORITY` order) that no standing enemy has within weapon range, or for anyone once only one soldier stands; it advances (attack orders on the focus target) only while it has more standing soldiers than the enemy, and returns to its posts when it no longer does. It thinks every `AI_THINK_TICKS`, uses no rng, and issues a command only when the order would change.

## Review Focus

Five ways this plan fails quietly, each pinned by a test in the task that owns it.

1. Overrides applied after a battle exists, or lost on Play again. `applyTune` runs in `main.ts` before `createApp`, and the tuning test asserts the constant module sees the value; the e2e test checks the badge survives into the result screen. (Tasks 2, 7)
2. A typo in `?tune=` that half-applies: one scalar changed, then a throw. `overrideTuning` validates the whole object first; a test passes `{ MOVE_SPEED: 1, BOGUS: 2 }` and asserts `MOVE_SPEED` is unchanged. (Task 2)
3. Hits counted twice when one grenade catches two enemies, or friendly-fire damage credited to the enemy. Collector tests build events by hand for both. (Task 3)
4. The report drawn from a stale collector after Play again. The collector belongs to the session, so a new session is a new collector; the session test asserts a fresh session reports zero shots. (Task 3)
5. The hold-line controller spamming commands every think, which would bloat logs and change nothing. A test runs it against no enemies for 600 ticks and asserts the log holds only the five opening moves. (Task 5)

---

### Task 1: Plan document

- [x] Write this plan. Commit `Plan 5: tuning tools plan`.

### Task 2: Live overrides from the URL

**Files:**
- Modify: `src/sim/constants.ts` (add `TUNABLE_NAMES`, `validateTuning`; make `overrideTuning` validate first; update the "the game never calls it" comments)
- Create: `src/game/tuning.ts`
- Modify: `src/game/app.ts`, `src/game/debug.ts`, `src/main.ts`, `src/ui/hud.ts`, `src/ui/uiConstants.ts`, `src/ui/debugText.ts`
- Test: `tests/sim/tuning.test.ts` (extend), `tests/game/tuning.test.ts`, `tests/ui/debugText.test.ts` (extend)

**Interfaces:**
```ts
// src/sim/constants.ts
export const TUNABLE_NAMES: readonly TunableName[];
/** Throws a descriptive Error for an unknown name, unknown class, unknown weapon field or wrong type; changes nothing. */
export function validateTuning(overrides: unknown): asserts overrides is TuningOverrides;
export function overrideTuning(overrides: TuningOverrides): void; // validates the whole object, then assigns

// src/game/tuning.ts
export interface TuneStatus { overrides: TuningOverrides; active: boolean; error: string | null }
export function readTune(search: string): TuneStatus;   // pure: parse and validate `tune`, never throws
export function applyTune(search: string): TuneStatus;  // readTune, then overrideTuning when active

// src/game/app.ts
export interface AppOptions { debugOverlay?: boolean; tuning?: TuneStatus }
interface App { readonly tuning: TuneStatus; ... }

// src/ui/hud.ts
export interface HudView { playerSide: Side; selection: readonly number[]; paused: boolean; tuned: boolean }
export function tunedBadgeRect(): ButtonRect;   // fixed rect from uiConstants.TUNED_BADGE, for the e2e pixel check

// src/ui/debugText.ts
export interface DebugHeaderInfo { seed: number; paused: boolean; hash: number; tuning?: TuneStatus }

// src/game/debug.ts: DebugHook gains
readonly tuned: boolean; readonly overrides: TuningOverrides; readonly tuneError: string | null;
```

- [x] **Step 1: Failing tests in `tests/sim/tuning.test.ts`.** `validateTuning({ MOVE_SPEED: 1 })` does not throw and leaves `constants.MOVE_SPEED` unchanged; `validateTuning({ WEAPONS: { gunner: { bogus: 1 } } })` throws `/unknown weapon field/`; `validateTuning({ WEAPONS: { gunner: { cooldown: 'x' } } })` throws `/must be a number/`; `validateTuning([])` and `validateTuning(null)` throw `/object/`; `overrideTuning({ MOVE_SPEED: 1, BOGUS: 2 } as never)` throws and `MOVE_SPEED` is still the default (all-or-nothing); `TUNABLE_NAMES` contains `'MOVE_SPEED'` and `'AI_SPACING_PENALTY'` and has no duplicates.
- [x] **Step 2: Run `npx vitest run tests/sim/tuning.test.ts`; expect failures on the missing exports.**
- [x] **Step 3: Implement in `constants.ts`.** `TUNABLE_NAMES` is the list the `TunableName` union spells out. `validateTuning` checks: a non-null non-array object; each key either `WEAPONS` (object whose keys are classes in `WEAPONS` and whose fields exist on `WEAPONS[cls]` with the same `typeof` as the current value; numbers must be finite) or a name in `TUNABLE_NAMES` with a finite number value. Messages keep the existing wording where tests already match it (`unknown tunable`, `unknown class`, `must be a number`). `overrideTuning` calls `validateTuning` first and then assigns exactly as today. Replace the "Only `scripts/measure-pacing.mts` calls this" and "The game never calls it" comments: the game applies `?tune=` through it before any battle.
- [x] **Step 4: Failing tests in `tests/game/tuning.test.ts`.** `readTune('')` and `readTune('?seed=7')` give `{ overrides: {}, active: false, error: null }`; `readTune('?tune=%7B%22MOVE_SPEED%22%3A2%7D')` and `readTune('?seed=7&tune={"MOVE_SPEED":2}')` give `overrides { MOVE_SPEED: 2 }`, `active true`, `error null`; `readTune('?tune={"WEAPONS":{"launcher":{"cooldown":180}}}')` gives the nested object; `readTune('?tune=not json')` gives `active false`, empty overrides and an error containing `JSON`; `readTune('?tune={"BOGUS":1}')` gives an error containing `unknown tunable`; `readTune('?tune={}')` is inactive with no error. `applyTune('?tune={"WEAPONS":{"launcher":{"cooldown":180}}}')` makes `constants.WEAPONS.launcher.cooldown` 180 and leaves `damage` alone (restore in `afterEach` with `overrideTuning({ WEAPONS: defaults })`); `applyTune('?tune={"BOGUS":1}')` changes nothing.
- [x] **Step 5: Run; expect failure on the missing module.**
- [x] **Step 6: Implement `src/game/tuning.ts`.** Parse with `URLSearchParams`; `JSON.parse` inside try/catch; `validateTuning` inside try/catch; errors become `error` strings prefixed `tune: `. `active` is `error === null && Object.keys(overrides).length > 0`.
- [x] **Step 7: Failing test additions in `tests/ui/debugText.test.ts`.** With `tuning: { overrides: { MOVE_SPEED: 2 }, active: true, error: null }` the header gains a line `tune {"MOVE_SPEED":2}` after the hash line; with an error it gains `tune error tune: ...`; with no tuning the header is unchanged (three lines); a long override JSON is split into lines of at most 72 characters, continuation lines indented by five spaces.
- [x] **Step 8: Implement in `debugText.ts`**, then run the test.
- [x] **Step 9: Wire it.** `uiConstants.ts` gets `TUNED_BADGE = { x: 180, y: 9, w: 64, h: 22, radius: 4 }`. `hud.ts`: `tunedBadgeRect()` returns that rect with id `tuned` and label `TUNED`; `drawTopBar` fills it with `PALETTE.selection` and writes the label in `PALETTE.pageBackground` with `FONT.smallBold` when `view.tuned`. `app.ts`: store `options.tuning ?? { overrides: {}, active: false, error: null }`, expose it as `app.tuning`, pass `tuned: tuning.active` to `drawHud` and `tuning` to `drawDebugOverlay`. `debug.ts`: `tuned`, `overrides`, `tuneError` getters. `main.ts`: `const tuning = applyTune(window.location.search)` before `createApp`, passed in options.
- [x] **Step 10: `npm run check` green. Commit `Plan 5 task 2: live tuning overrides from ?tune=`.**

### Task 3: Battle statistics

**Files:**
- Modify: `src/sim/types.ts` (`damage` event gains `sourceId: number`), `src/sim/damage.ts`, `src/sim/projectiles.ts`, `src/sim/flame.ts`, `src/sim/index.ts` (export `canFireAt`)
- Modify tests that spell out damage events: `tests/sim/damage.test.ts`, `tests/sim/lobbed.test.ts`, `tests/sim/projectiles.test.ts`, `tests/sim/flame.test.ts`, `tests/render/effects.test.ts`
- Create: `src/stats/battleStats.ts`
- Modify: `src/game/session.ts`
- Test: `tests/stats/battleStats.test.ts`, `tests/game/session.test.ts` (extend)

**Interfaces:**
```ts
// src/sim/types.ts
| { kind: 'damage'; soldierId: number; amount: number; weapon: SoldierClass; sourceId: number }
// src/sim/damage.ts
export function applyDamage(state, target, amount, weapon, sourceId: number): void;
export function applySplash(state, x, y, radius, amount, weapon, excludeId, sourceId: number): void;

// src/stats/battleStats.ts  (imports only from '../sim')
export interface ClassStats {
  shots: number; hits: number; damageDealt: number; damageTaken: number;
  downsInflicted: number; timesDowned: number; instantKills: number; downedTicks: number; medicCalls: number;
}
export interface BattleStats {
  seed: number; overrides: TuningOverrides; ticks: number; winner: Side | 'draw' | null;
  firstContactTick: number | null; sides: Record<Side, Record<SoldierClass, ClassStats>>;
}
export interface StatsCollector { observe(state: BattleState): void; stats(): BattleStats }
export function emptyClassStats(): ClassStats;
export function createStatsCollector(seed: number, overrides: TuningOverrides): StatsCollector;
export function addClassStats(into: ClassStats, from: ClassStats): void;
export function sideTotals(stats: BattleStats, side: Side): ClassStats;
export function hitRate(c: ClassStats): number | null;  // hits / shots, null when shots is 0

// src/game/session.ts
export function createSession(seed: number, overrides?: TuningOverrides): BattleSession;
interface BattleSession { stats(): BattleStats; ... }
```

- [x] **Step 1: Update the sim tests for `sourceId`.** In each listed test, add `sourceId` to the expected damage events: the gunner duel shooter is 0, the splash tests name the thrower, the flame tests the scorcher (id 3), and `tests/sim/damage.test.ts` passes a `sourceId` argument to `applyDamage` and `applySplash` and expects it back. Add one case: `applySplash` from source 7 on two soldiers emits two damage events both with `sourceId: 7`.
- [x] **Step 2: Run `npm test`; expect type errors and failures on the missing field.**
- [x] **Step 3: Implement.** `applyDamage` takes `sourceId` and puts it on the event; `applySplash` passes it through; `projectiles.ts` passes `p.ownerId`; `flame.ts` passes `s.id`. Export `canFireAt` and `inRange` from `src/sim/index.ts`. `npm test` green, including replay determinism.
- [x] **Step 4: Failing tests in `tests/stats/battleStats.test.ts`.** Build a `createBattle({ seed: 1 })` state, set `state.tick` and `state.events` by hand, call `observe`, and assert:
  - a `shot` from soldier 0 (blue gunner) gives `sides.blue.gunner.shots` 1;
  - a standing scorcher (id 3) with `firing: true` gives `sides.blue.scorcher.shots` 1 per observed tick and no shot event is needed;
  - a `damage` from source 0 on soldier 5 for 5 gives blue gunner `damageDealt` 5, `hits` 1, red gunner `damageTaken` 5;
  - two `damage` events from source 2 (blue chucker) on soldiers 5 and 6 in the same tick give `hits` 1 and `damageDealt` 60;
  - a `damage` from source 2 on soldier 1 (friendly fire) gives blue chucker `damageDealt` 30, `hits` 0, blue launcher `damageTaken` 30;
  - `damage` from source 6 on soldier 0 followed by `downed` 0 gives red launcher `downsInflicted` 1, blue gunner `timesDowned` 1; `killed` instead gives `instantKills` 1 as well;
  - a `medic` event for target 1 gives blue launcher `medicCalls` 1;
  - a soldier with status `downed` adds 1 to its class's `downedTicks` per observed tick; a `dead` one adds nothing;
  - `firstContactTick` is `state.tick - 1` of the first observed tick with a damage event, and stays;
  - `stats().ticks` equals the last observed `state.tick` and `winner` the state's winner;
  - `sideTotals` sums the five classes; `hitRate({ shots: 0, ... })` is null and `hitRate({ shots: 4, hits: 1 })` is 0.25;
  - a real battle: `runBattle` seed 7 AI versus AI with `onStep: collector.observe` gives shots > 0 for both gunners and `firstContactTick` within one tick of the measure script's rule (`state.tick - 1` at the first damage event).
- [x] **Step 5: Run; expect failure on the missing module.**
- [x] **Step 6: Implement `src/stats/battleStats.ts`.** `observe` reads `state.tick - 1` as the tick just stepped, walks `state.soldiers` for scorcher cone ticks and downed ticks, then `state.events` in order keeping `lastSource[victimId]` and a per-tick set of shooter ids that hit an enemy; after the loop each id in the set adds one hit. Class and side come from `soldierById`.
- [x] **Step 7: Failing session tests.** `createSession(7).stats()` at tick 0 has zero shots everywhere and `ticks` 0; after 600 `stepOnce` calls, `stats().ticks` is 600 and blue gunner `shots` > 0; `createSession(7, { MOVE_SPEED: 2 }).stats().overrides` equals `{ MOVE_SPEED: 2 }`.
- [x] **Step 8: Implement in `session.ts`**: a collector created with the session, `observe(state)` after every `step` in `stepOnce`, `stats()` returning it. Run `npm test`.
- [x] **Step 9: `npm run check` green. Commit `Plan 5 task 3: battle statistics collector and damage sourceId`.**

### Task 4: The report on the result screen and the clipboard

**Files:**
- Create: `src/stats/reportText.ts`, `src/ui/textOverlay.ts`
- Modify: `src/ui/result.ts`, `src/ui/drawButtons.ts` (`drawOverlayPanel` takes a width), `src/ui/menu.ts` (passes `PANEL.width`), `src/ui/uiConstants.ts`, `src/game/app.ts`, `src/game/debug.ts`, `src/main.ts`
- Test: `tests/stats/reportText.test.ts`, `tests/ui/result.test.ts`, `tests/game/app.test.ts`

**Interfaces:**
```ts
// src/stats/reportText.ts (imports only from '../sim' and './battleStats')
export const REPORT_COLUMNS: string;                    // the fixed-width header row
export function formatReportRows(stats: BattleStats): string[];  // header, then per side 5 class rows and a `total` row
export function formatReportMarkdown(stats: BattleStats, log: readonly Command[]): string;

// src/ui/result.ts
export type CopyState = 'idle' | 'copied' | 'shown';
export interface ResultView { rows: readonly string[]; copyState: CopyState }
export function resultButtons(copyState: CopyState): ButtonRect[];  // playAgain, copyReport, title
export function drawResult(ctx, state, playerSide, view: ResultView): void;

// src/ui/textOverlay.ts (DOM; not imported by anything under test)
export function showTextOverlay(text: string): void;   // a read-only textarea over the canvas with a Close button

// src/game/app.ts
export interface AppOptions { debugOverlay?: boolean; tuning?: TuneStatus; copyText?: (text: string) => Promise<boolean> }
interface App { report(): string | null; ... }   // the Markdown for the current battle

// src/game/debug.ts: DebugHook gains
readonly stats: unknown;   // BattleStats or null
report(): string | null;
```

- [x] **Step 1: Failing tests in `tests/stats/reportText.test.ts`.** Build a `BattleStats` by hand (seed 7, 1860 ticks, winner blue, first contact 288, blue gunner shots 40 hits 10 dealt 50, red launcher downsInflicted 2 instantKills 1 downedTicks 90, medicCalls 1). `formatReportRows` returns 13 lines: `REPORT_COLUMNS`, five blue class rows, `blue total`, five red class rows, `red total`; the blue gunner row contains `40`, `10`, `25%`; a class with no shots prints `-` for the rate; `downedTicks` 90 prints `3.0`; every row has the same length as the header. `formatReportMarkdown` contains `Seed: 7`, `Winner: blue`, `Time: 62.0 s (1860 ticks)`, `First contact: 9.6 s (tick 288)`, a line starting `Overrides:` with the JSON (or `none`), a Markdown table row `| blue | Gunner | 40 | 10 | 25% |`, `<details>`, and the log JSON (`JSON.stringify(log)`), and names `replayBattle`.
- [x] **Step 2: Run; expect failure on the missing module.**
- [x] **Step 3: Implement `reportText.ts`.** Columns: side 4, class 8, shots 5, hits 4, hit 4, dealt 5, taken 5, downs 5, downed 6, kills 5, down s 6, medic 5, joined by single spaces. Class labels from a local `CLASS_LABEL` map (Gunner, Launcher, Chucker, Scorcher, Blaster), not from `render/palette`. Damage amounts rounded to integers for display.
- [x] **Step 4: Failing tests in `tests/ui/result.test.ts`.** `resultButtons('idle')` has ids `playAgain`, `copyReport`, `title` in that order, labels `Play again`, `Copy report`, `Title`; `resultButtons('copied')` labels the middle one `Copied`; `resultButtons('shown')` labels it `Report shown below`; every button lies inside the logical canvas; buttons do not overlap the table rows (the lowest table row's bottom, from `RESULT` constants, is above the first button's top).
- [x] **Step 5: Implement the layout.** `uiConstants.ts`: `RESULT = { panelWidth: 760, panelHeight: 620, headingY: 56, standingY: 92, infoY: 118, tableTop: 150, rowHeight: 19, buttonsTop: 420 }`. `drawOverlayPanel(ctx, canvasW, canvasH, panelW, panelH)`; `menu.ts` passes `PANEL.width`. `drawResult` draws the winner line, standing, time and seed as before, then the rows in `FONT.debug` left-aligned from `panel.x + 24`, the header in `PALETTE.textDim` and total rows in `PALETTE.text` bold, then the three buttons.
- [x] **Step 6: Failing tests in `tests/game/app.test.ts`.** `createApp` with a fixed seed and a stub `copyText` that records the text and resolves true: after `click` on the title, `advanceTicks(30 * 600)` reaches the result screen; `app.report()` contains `Seed:`; clicking the centre of `resultButtons('idle')[1]` calls the stub once with that same text and, once the promise settles, the second button's label is `Copied`; with a stub resolving false the label is `Report shown below`; Play again resets it to `Copy report`; before a battle `app.report()` is null. (Tests pass a minimal fake `CanvasRenderingContext2D` only if `frame` is called; prefer `click` and `advanceTicks`, which do not draw.)
- [x] **Step 7: Implement in `app.ts`.** `copyState` per battle; `resultClick` on `copyReport` builds `formatReportMarkdown(session.stats(), session.log)` and awaits `options.copyText` (default: resolve false); `report()` returns the Markdown or null. `debug.ts`: `stats` and `report()` getters. `src/ui/textOverlay.ts`: a fixed-position `div` with a read-only `textarea` holding the text (selected on open) and a Close button; `main.ts` passes `copyText` that tries `navigator.clipboard.writeText` and on absence or rejection shows the overlay and resolves false.
- [x] **Step 8: `npm run check` green; `npm run build && npm run test:e2e` green (the existing play test clicks Play again by its rect, which has moved). Commit `Plan 5 task 4: battle report on the result screen with Copy report`.**

### Task 5: Hold-line controller and the measure script

Implementation notes: the "at post" tolerance is one tile, not half a tile, because a soldier that arrives stuck beside a teammate stops `ARRIVE_SLACK` (26 units) short, and half a tile would send it back out again; a soldier already walking to its post keeps that order until the sim turns it into hold on arrival. The final review found that a Scorcher downed by another flame on the tick it burned had a hit with no shot (rate 102% in one headless run); the collector now counts that shot when the damage appears.

**Files:**
- Create: `scripts/holdline.mts`
- Modify: `scripts/measure-pacing.mts`
- Test: `tests/scripts/holdline.test.ts`

**Interfaces:**
```ts
// scripts/holdline.mts (imports from '../src/sim/index.ts' only; under 200 lines; no rng)
export const HOLD_TILES: Readonly<Record<SoldierClass, TileCoord>>;
export function createHoldLine(side: Side): Controller;

// scripts/measure-pacing.mts
//   --blue=ai | passive | holdline
//   prints, after the existing rows, one block per side: a header and five class rows with
//   shots, hits, hit%, dealt, downs as totals over all seeds and per-battle medians in brackets.
```

- [x] **Step 1: Failing tests in `tests/scripts/holdline.test.ts`** (import from `'../../scripts/holdline.mts'`).
  - Every `HOLD_TILES` entry is an open tile on `CROSSROADS`, west of the left wall arms (`tx <= 11`), and no two classes share a tile.
  - At tick 0 on a fresh battle `think` returns five `move` commands, one per blue soldier, each to the centre of that soldier's class tile.
  - Determinism: two `runBattle` runs on seed 7 with `[createHoldLine('blue'), createAi('red', 7)]` give equal `hashState` and equal logs, and `replayBattle(7, log, ticks)` matches.
  - Quiet when nothing changes: with every red soldier downed at tick 0 (so no enemies), 600 `step`s with the controller produce only the five opening moves in the log.
  - Medic: a blue soldier downed at tick 0 with no red soldier within weapon range of the body gets a `medic` command on the first think; the same body with a standing red gunner 100 units away gets none (unless blue has one soldier standing).
  - Focus fire: four blue soldiers placed on open ground with line of sight to a lone red soldier 150 units away receive `attack` commands on that soldier; a fifth blue soldier behind a wall with no line of sight does not.
  - Advance: blue five standing against two red standing gives `attack` orders to every blue soldier whether or not it can fire.
- [x] **Step 2: Run; expect failure on the missing module.**
- [x] **Step 3: Implement `scripts/holdline.mts`.** Starting posts (adjust from measurement, record the final set in `docs/decisions.md`): gunner (11, 8), launcher (9, 10), chucker (11, 12), scorcher (11, 7), blaster (10, 11). Rules as in decision 6. Helpers: `standingOf`, `centroid`, `focusTarget(state, own, enemies)` (enemy nearest the centroid that more than half of `own` `canFireAt`), `postOf(s)`, `atPost(s)` (within `TILE_SIZE / 2`), `medicCommand`. Commands only when the order differs from the current one (compare like the AI's `alreadyHolds`).
- [x] **Step 4: Run the tests; green.**
- [x] **Step 5: Measure script.** Replace the hand-rolled counting with `createStatsCollector(seed, options.overrides)` and `collector.observe` in `onStep`; keep every existing output row (downs per side from `timesDowned`, medic calls from `medicCalls`, downs by weapon from `downsInflicted`); add `--blue=holdline`; add the per-side, per-class block. Keep the file under 300 lines (move printing helpers to `scripts/measure-report.mts` if needed).
- [x] **Step 6: Run `npm run measure` with `--blue=ai`, `--blue=passive`, `--blue=holdline` over seeds 1 to 60 and record the three blue win rates and the per-class block in the plan (below) and the PR. If the hold-line squad wins fewer than about 20% or more than about 80%, move posts once or twice (never the rules) and re-measure.**
- [x] **Step 7: `npm run check` green. Commit `Plan 5 task 5: hold-line blue controller and per-class measurement`.**

**Results (seeds 1 to 60, shipped balance):**

| Blue controller | Blue wins | Median length | First damage | Red downs per battle (median) |
|---|---|---|---|---|
| ai | 33 (55%) | 59.0 s | 9.6 s | 8 |
| passive | 0 (0%) | 54.2 s | 15.6 s | 1 |
| holdline | 0 (0%) | 57.3 s | 12.8 s | 3 |

Two post sets were measured. The first (road mouth: gunner (11, 9), launcher (9, 10), chucker (11, 11), scorcher (11, 8), blaster (11, 12)) lost 60 of 60 with a median of one red down per battle; the red Scorcher alone burned for 37,000 cone ticks over the run. The second, kept (gunner (9, 8), launcher (7, 10), chucker (9, 12), scorcher (10, 10), blaster (11, 12)), also lost 60 of 60 but takes three red soldiers down per battle. With the red Scorcher's flame cut to 0.2 per tick the squad still loses 60 of 60 (four red downs per battle), so the loss is structural: a squad that holds cannot beat five converging soldiers with three splash weapons under the shipped balance. The controller is kept as it is: a human-like static baseline whose downs-per-battle and battle length respond to tuning even where its win rate sits at the floor.

### Task 6: README and decisions

**Files:**
- Modify: `README.md` (a "Tuning" section after "Test"), `docs/decisions.md`, `CLAUDE.md` (the `measure` and `?seed` lines mention `?tune=` and the report)

- [x] **Step 1: README "Tuning" section.** How to use `?tune=` (with the Launcher example), what the TUNED badge means, where the report is and what Copy report produces, `npm run measure` with the same JSON and `--blue=holdline`, and the loop: hypothesis, URL test, two or three games, paste reports into the issue, measure over 60 or more seeds, PR with the numbers in the decision line.
- [x] **Step 2: `docs/decisions.md`:** one dated line each for the URL parameter shape and validation, the TUNED badge, `sourceId` on damage events, the report fields and their definitions, the Copy report format and fallback, the hold-line controller's rules and posts with the three win rates, and the measure script's per-class block.
- [x] **Step 3: Commit `Plan 5 task 6: tuning docs and decisions`.**

### Task 7: End-to-end test

**Files:**
- Create: `e2e/tune.spec.ts`

- [x] **Step 1: Write the test.** Load `./?seed=7&tune=` with the URL-encoded `{"WEAPONS":{"launcher":{"cooldown":180}}}`; wait for `window.__mm.screen === 'title'`; assert `__mm.tuned` is true, `__mm.overrides` equals the object and `__mm.tuneError` is null; click to start; read the canvas pixel at the centre of `tunedBadgeRect()` (scaled by `canvas.width / 1280`) and assert it is the badge yellow (`#ffe66d`, within a tolerance of 8 per channel); `advanceTicks(30 * 600)`; wait for `screen === 'result'`; assert `__mm.report()` contains `| blue | Gunner |` and `"WEAPONS"` and the badge pixel is still yellow; grant clipboard permissions, click `resultButtons('idle')[1]`'s centre, and assert `navigator.clipboard.readText()` equals `__mm.report()`. A second test loads `./?seed=7&tune=nonsense`, asserts no page errors, `__mm.tuned` false and `__mm.tuneError` containing `JSON`.
- [x] **Step 2: `npm run build && npm run test:e2e` green.** Commit `Plan 5 task 7: e2e test for ?tune= and the battle report`.

### Task 8: Finish

- [x] Tick every box in this plan, fill in the results table, `npm run check` and `npm run test:e2e` green, push `plan-5-tuning-tools`, open the PR "Plan 5: tuning tools" against `main` with: what was built, how to use each tool, a sample copied report, the three blue win rates, and anything deferred. Do not merge.

## Self-review

- Spec coverage: URL overrides (Task 2), report and clipboard (Tasks 3, 4), measure script parity through the shared collector (Task 5), hold-line controller (Task 5), README and decisions (Task 6), e2e (Task 7). No balance constant changes anywhere.
- Type consistency: `TuneStatus` is defined in Task 2 and consumed by `app.ts`, `debugText.ts` and `debug.ts`; `BattleStats`, `ClassStats`, `StatsCollector` from Task 3 feed Task 4's formatter and Task 5's script; `resultButtons(copyState)` from Task 4 is what Task 7 clicks.
- Proportion: the plan fixes names, signatures, columns and test assertions; bodies are left to the implementer except the controller rules, which are the design.
