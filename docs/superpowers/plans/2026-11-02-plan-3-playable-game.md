# Plan 3: Playable Game — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Muddle & Mayhem playable in the browser on top of the Plan 2 simulation: a title screen, a paused battle on Crossroads against the computer, mouse and keyboard orders through the spec's controls, a fixed 30 Hz simulation with interpolated rendering, a canvas HUD, an Esc menu, a result screen with a rematch, a debug hook that exposes seed, tick and command log, and a Playwright test that plays a few seconds of a battle. Done when the spec's v1 success criterion holds on the deployed site.

**Architecture:** The simulation stays the only source of truth and is never mutated from outside `step`. Three new layers sit on top of it. `src/game/` owns time and the command log: a pure fixed-step accumulator, a `BattleSession` that queues the player's commands for the next tick, asks the red `createAi` controller for its commands, feeds both to `step` in a fixed order and appends them to the log, and the seed. `src/render/` draws: one `Projection` maps world units to logical canvas pixels and back (top-down today, isometric later), a `Viewport` fits the logical canvas to the window, and small draw modules render map, soldiers, projectiles, medics and short-lived effects derived from `state.events`. `src/input/` turns DOM mouse and keyboard events into `Command` objects through pure functions that take the current selection and the soldier under the cursor. `src/ui/` holds the screen state machine (title, battle, menu, result) and the canvas-drawn HUD and screens. `src/main.ts` wires them into one `requestAnimationFrame` loop. Everything is drawn on one canvas; there is no DOM UI.

**Tech Stack:** TypeScript strict, Vite, HTML Canvas 2D, Vitest (node environment, so every tested module is DOM-free), Playwright (Chromium). No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-01-muddle-and-mayhem-design.md`, sections 4.3 (controls), 4.5 (downed and medics), 4.7 (flow), 4.8 (look), 5 (architecture), 9 (left to the builder). Sim API: `src/sim/index.ts`.

**Out of scope (roadmap, `docs/decisions.md`):** sound, terrain effects, close combat, crates and score, squad selection, gamepad, difficulty levels, real art, isometric renderer, remote multiplayer, campaign, commando squad, portraits. None of these is started here.

## Global Constraints

- Nothing under `src/sim/` changes except to fix a bug found during playtest, and then with a failing test first and a note in the PR. `npm run lint:sim` and `npm run typecheck` stay green.
- `src/render/`, `src/input/`, `src/ui/`, `src/game/` never assign to simulation state. They read it and produce `Command`s that go through `step`. The one exception is `src/game/session.ts`, which calls `step` and `createBattle`.
- Every tunable outside the sim (layout sizes, colours, effect lifetimes, pick radius, frame clamps) lives in `src/render/renderConstants.ts` or `src/ui/uiConstants.ts`, never inline in logic.
- Modules under test import nothing that touches `document`, `window`, or `performance` at module load. DOM access is confined to `src/main.ts`, `src/input/dom.ts`, and the draw modules (which take a `CanvasRenderingContext2D` as an argument).
- Tests first for logic: loop timing, session and log order, input to command translation, selection and slot keys, screen state machine, viewport mapping, effects lifetime. The renderer is verified by the Playwright test and screenshots.
- Files small and single-purpose (200-400 lines typical, 800 max). Tests under `tests/<layer>/`, one per source module with logic.
- `npm run check` green before every commit. Commit messages plain, no attribution trailers.
- Never use the original game's names anywhere, including UI strings.

## Decisions this plan makes (spec section 9 and open points)

Recorded in `docs/decisions.md` in Task 10; listed here so every task builds on the same answers.

1. One logical canvas of 1280 by 876 pixels: a 40-pixel top bar, the 1280 by 704 battlefield at 1:1 world units, and a 132-pixel HUD below. The canvas is scaled uniformly to fit the window (letterboxed, `devicePixelRatio` aware) and nothing else moves, so screen-to-world is one `Projection` plus one `Viewport` and an isometric renderer later replaces the projection and the draw modules only.
2. The render loop clamps a frame's delta to `MAX_FRAME_MS` (250) and steps at most `MAX_TICKS_PER_FRAME` (8) ticks per frame, keeping the remainder in the accumulator. The interpolation alpha is accumulator divided by tick length. A frozen tab therefore resumes without a burst of catch-up ticks.
3. Player commands queue for the next unstepped tick (`state.tick` at enqueue time). Each stepped tick feeds the queued player commands first, then the red AI's, and appends them to the log in that order, so `replayBattle(seed, log, tick)` reproduces the battle. A Vitest case asserts this with scripted player commands.
4. Selection lives in the input layer so it works while paused, and every change is mirrored into the sim by a `select` command for the log. Downed soldiers can be selected (so `M` has something to act on); dead ones cannot. Shift-click and shift+slot add to the selection. Left click on empty ground clears it.
5. `M` calls the medic for the first downed soldier in the selection, one call per press. Right-click on a downed enemy or on any dead soldier counts as a ground click. Right-click on a downed friendly calls the medic regardless of selection.
6. Pause starts on. Space toggles it. The Esc menu stops ticks while open and restores the previous pause state on resume; Restart and Title discard the battle.
7. The result overlay appears the frame the sim sets `winner`, over the frozen battlefield. Play again starts a new battle with a new seed; Title returns to the title screen.
8. Seeds come from `?seed=N` in the URL when present, otherwise a random 32-bit value from `Math.random()` (fine outside the sim). With `?seed` set, Play again uses seed plus one so rematches stay reproducible.
9. `window.__mm` is exposed in every build, not only dev: seed, tick, paused, winner, the command log, the state, `hash()`, `replayMatches()`, `advanceTicks(n)` and `worldToClient(x, y)`. Reason: the Playwright test runs against the production build, and the owner can paste a seed and log from the live site into a bug report.
10. Visual effects (impact rings, hit flashes, jam labels, revive pulses) are derived from `state.events`, drained after every step, and expire by sim tick, so pause freezes them and several ticks per frame lose nothing.
11. Look: soldiers are 12-unit circles in side colour with a class letter, a facing mark, an HP bar and a thin cooldown bar; selected soldiers get a dashed ring, a dashed path to their destination and a reticle on their attack target; downed soldiers are flattened ellipses, with a `+` prompt on friendlies while calls remain; dead soldiers are ash smudges. Bullets are small dots, rockets larger dots with a trail, lobbed shots follow a render-only parabola with a ground shadow, the flame cone is a translucent 60-degree wedge of weapon range, the medic is a white disc with a red cross and a dashed line to the body.
12. Palette: blue `#3d7bd6`, red `#d64545`, ground `#3b6b35` (from the Plan 1 placeholder), walls grey, crates brown, trees dark green. Monospace system font. All in `src/render/palette.ts`.
13. Playtest tuning, if any, lands in `src/sim/constants.ts` only and is listed in `docs/decisions.md` (Task 9).

## Review Focus

Things a reviewer should check hardest, because they are the ways this plan fails quietly.

1. A command tagged with a stale tick is silently ignored by `step`. The session tags at enqueue with `state.tick` and a test queues a command between steps and asserts it applied on the next tick. (Task 2)
2. Replay drift: player and AI commands logged in a different order than they were fed, or AI `think` called on a state that differs from the one stepped. The session test replays the log and compares hashes. (Task 2)
3. Spiral of death after a tab switch, or the sim running ahead of the renderer. Frame delta clamp and per-frame tick cap, tested. (Task 1)
4. Clicks landing in the wrong place under letterboxing or a non-1 `devicePixelRatio`. The viewport test round-trips client to world and back; the e2e test clicks the computed client position of a soldier and asserts the selection. (Tasks 1, 8)
5. Events lost when several ticks run in one frame, because `step` clears `state.events` at the start of each call. The session drains events after every single step. (Tasks 2, 5)
6. The HUD or selection ring reading `state.sides.blue.selected`, which lags while paused. Both read the input layer's selection. (Tasks 3, 6)
7. Flaky e2e: wall-clock waits for a battle to end. The test uses a fixed `?seed`, `advanceTicks` for the long stretch, and a short real-time run only to prove the loop ticks. (Task 8)
8. A borrowed name or line in UI text. Title, HUD and result strings use only Muddle, Mayhem, the class words, and the Plan 2 soldier names. (Tasks 6, 10)

---

### Task 1: Fixed-step loop, viewport and projection

**Files:**
- Create: `src/game/loop.ts`, `src/render/viewport.ts`, `src/render/projection.ts`, `src/render/renderConstants.ts`
- Test: `tests/game/loop.test.ts`, `tests/render/viewport.test.ts`

**Interfaces:**
```ts
// src/game/loop.ts
export interface FixedStepper { accumulate(dtMs: number): number; alpha(): number; reset(): void }
export function createFixedStepper(tickMs: number, maxFrameMs: number, maxTicksPerFrame: number): FixedStepper;
// accumulate clamps dt to maxFrameMs, adds it, returns the number of whole ticks to run (at most
// maxTicksPerFrame, dropping the excess so the accumulator never grows unbounded), keeps the remainder.
// alpha() is accumulator / tickMs in [0, 1).

// src/render/projection.ts
export interface Projection { worldToScreen(x: number, y: number): Vec2; screenToWorld(sx: number, sy: number): Vec2 }
export function createTopDownProjection(offsetX: number, offsetY: number): Projection;

// src/render/viewport.ts
export interface Viewport { scale: number; cssWidth: number; cssHeight: number; pixelWidth: number; pixelHeight: number }
export function fitViewport(windowW: number, windowH: number, dpr: number, logicalW: number, logicalH: number): Viewport;
export function clientToLogical(v: Viewport, clientX: number, clientY: number, rectLeft: number, rectTop: number): Vec2;
```
`renderConstants.ts`: `LOGICAL_WIDTH = 1280`, `TOP_BAR_HEIGHT = 40`, `HUD_HEIGHT = 132`, `FIELD_WIDTH/HEIGHT` from `mapWidthUnits(CROSSROADS)` and `mapHeightUnits`, `LOGICAL_HEIGHT`, `MAX_FRAME_MS = 250`, `MAX_TICKS_PER_FRAME = 8`, `TICK_MS = 1000 / TICK_RATE`.

- [x] Write failing tests: stepper returns 0 then 1 after 33.4 ms at 30 Hz; remainder carries; 1000 ms frame yields `maxTicksPerFrame` ticks and alpha in [0, 1); viewport letterboxes a wide window by height and a tall window by width; `clientToLogical` round-trips with dpr 2 and a centred canvas.
- [x] Implement, `npm run check`, commit `Plan 3 task 1: fixed-step loop and viewport`.

### Task 2: Battle session with command log, AI and pause

**Files:**
- Create: `src/game/session.ts`, `src/game/seed.ts`
- Test: `tests/game/session.test.ts`, `tests/game/seed.test.ts`

**Interfaces:**
```ts
export interface BattleSession {
  readonly seed: number;
  readonly state: BattleState;           // read-only for callers; only session.ts steps it
  readonly log: readonly Command[];
  paused: boolean;
  queue(cmd: Command): void;             // player command; cmd.tick must equal state.tick
  stepOnce(): BattleEvent[];             // player queue + AI think, log, step, return that tick's events
  advance(dtMs: number): BattleEvent[];  // 0 ticks when paused or finished, else via the stepper
  alpha(): number;
}
export function createSession(seed: number): BattleSession;
export function seedFromSearch(search: string, random: () => number): number; // src/game/seed.ts
```

- [x] Failing tests: new session is paused at tick 0; `advance` while paused steps nothing; a `move` queued at tick 0 shows up as the soldier's order after `stepOnce`; red commands appear in the log with `side: 'red'`; after 300 ticks with a scripted blue move at tick 0 and a hold at tick 40, `hashState(replayBattle(seed, log, tick))` equals `hashState(state)`; log is in ascending tick order; `advance(1000)` when unpaused runs `MAX_TICKS_PER_FRAME` ticks; a finished battle stops advancing; `seedFromSearch('?seed=42', ...)` is 42 and without it returns the random value as a 32-bit unsigned integer.
- [x] Implement, `npm run check`, commit `Plan 3 task 2: battle session and command log`.

### Task 3: Input interpretation: picking, clicks and keys to commands

**Files:**
- Create: `src/input/picking.ts`, `src/input/interpret.ts`, `src/input/keys.ts`
- Test: `tests/input/picking.test.ts`, `tests/input/interpret.test.ts`

**Interfaces:**
```ts
export function pickSoldier(state: BattleState, x: number, y: number, radius: number): Soldier | null; // nearest non-dead within radius
export interface InputResult { selection: number[]; commands: Command[]; togglePause?: boolean; openMenu?: boolean }
export function interpretClick(state, selection, button: 'left' | 'right', x, y, shift: boolean, side: Side): InputResult;
export function interpretKey(state, selection, key: string, shift: boolean, side: Side): InputResult;
export const KEY_SLOTS = ['1','2','3','4','5'] (keys.ts), plus HOLD_KEY 'h', MEDIC_KEY 'm', PAUSE_KEY ' ', MENU_KEY 'Escape'.
```
Rules are decisions 4 and 5. Every emitted command is tagged `tick: state.tick`, `side`. Selection changes emit a `select` command.

- [x] Failing tests cover: left click own standing soldier selects it; shift adds; left click own downed selects; left click enemy or ground clears; right click ground moves standing selected (downed ones filtered out); right click standing enemy attacks; right click downed friendly emits `medic` with its id; right click downed enemy or dead soldier is a ground move; `H` holds; `M` with a downed soldier in selection emits one `medic`; `M` with none emits nothing; `1`..`5` select blue ids 0..4 (shift adds); dead soldier on slot key gives empty selection change; Space sets `togglePause`; Escape sets `openMenu`; picking prefers the nearest and ignores dead.
- [x] Implement, `npm run check`, commit `Plan 3 task 3: input to commands`.

### Task 4: Screen state machine

**Files:**
- Create: `src/ui/screens.ts`
- Test: `tests/ui/screens.test.ts`

```ts
export type Screen = 'title' | 'battle' | 'result';
export interface ScreenState { screen: Screen; menuOpen: boolean }
export type ScreenEvent = 'start' | 'battleEnded' | 'playAgain' | 'toTitle' | 'toggleMenu' | 'closeMenu' | 'restart';
export function reduceScreen(s: ScreenState, e: ScreenEvent): ScreenState;
```
Rules: `start` from title opens battle with menu closed; `toggleMenu` only in battle; `battleEnded` goes to result and closes the menu; `restart` and `playAgain` open a fresh battle; `toTitle` from anywhere; `closeMenu` idempotent; unknown transitions return the same object.

- [x] Failing tests for each rule, implement, `npm run check`, commit `Plan 3 task 4: screen state machine`.

### Task 5: Top-down renderer and effects

**Files:**
- Create: `src/render/palette.ts`, `src/render/effects.ts`, `src/render/drawMap.ts`, `src/render/drawSoldiers.ts`, `src/render/drawProjectiles.ts`, `src/render/drawEffects.ts`, `src/render/renderer.ts`
- Test: `tests/render/effects.test.ts`

```ts
export interface ViewState { selection: readonly number[]; alpha: number; effects: readonly Effect[]; hoverId: number | null }
export interface BattleRenderer { projection: Projection; draw(ctx: CanvasRenderingContext2D, state: BattleState, view: ViewState): void }
export function createTopDownRenderer(): BattleRenderer;
// effects.ts (pure): export function effectsFromEvents(events, state, tick): Effect[]; export function pruneEffects(effects, tick): Effect[];
```
Draw order: ground and tiles, ash and downed, paths and reticles of selected soldiers, medics, standing soldiers (interpolated by alpha), flame cones, projectiles, effects. Lobbed shots: lerp start to target by `(tick + alpha - launchTick) / (landTick - launchTick)`, arc height `LOB_ARC_HEIGHT * 4t(1-t)` drawn as negative y, shadow at the ground point.

- [ ] Failing tests for effects: an `impact` event yields an effect at its point that expires after `IMPACT_EFFECT_TICKS`; `damage` yields a flash on the soldier; `jam` yields a label; `prune` drops expired ones and keeps the rest.
- [ ] Implement the draw modules (verified visually in Task 8 and by screenshots), `npm run check`, commit `Plan 3 task 5: top-down renderer`.

### Task 6: HUD, title, menu and result screens

**Files:**
- Create: `src/ui/uiConstants.ts`, `src/ui/text.ts`, `src/ui/buttons.ts`, `src/ui/hud.ts`, `src/ui/title.ts`, `src/ui/menu.ts`, `src/ui/result.ts`
- Test: `tests/ui/buttons.test.ts`, `tests/ui/text.test.ts`

HUD (bottom): five blue cards with slot number, name, class, HP bar, cooldown bar, status (OK, DOWN, DEAD, JAM when cooldown exceeds the weapon's); a side panel with medic calls for both sides and a PAUSED badge; top bar: `mm:ss` clock from `tick / TICK_RATE`, enemies standing, a one-line controls hint. Title: name, two placeholder portraits (blue and red discs with a general's initial), "Click to start", controls summary. Menu: Resume, Restart, Title. Result: winner text ("General Muddle wins", "General Mayhem wins", "Draw"), soldiers remaining per side, time, Play again, Title. `buttons.ts` is a pure hit-test over rectangles; `text.ts` has `formatClock(ticks)`.

- [ ] Failing tests: `formatClock(0)` is `00:00`, `formatClock(TICK_RATE * 61)` is `01:01`; `hitButton` returns the id of the rect containing a point and null outside.
- [ ] Implement, `npm run check`, commit `Plan 3 task 6: HUD and screens`.

### Task 7: Wiring: app, DOM input, debug hook, entry point

**Files:**
- Create: `src/game/app.ts`, `src/input/dom.ts`, `src/game/debug.ts`
- Modify: `src/main.ts`, `index.html`

`app.ts` owns the screen state, the session (created on `start`), the selection, effects, the renderer and the frame function: `frame(nowMs)` computes dt, advances the session when the screen is battle and the menu is closed, drains events into effects, detects `winner` to fire `battleEnded`, then draws the current screen. `dom.ts` attaches `mousedown`, `contextmenu` (prevented), `keydown`, `resize`, converts client to logical via the viewport, dispatches to the app. `debug.ts` installs `window.__mm` (decision 9). `index.html` loses the fixed canvas size (set by the viewport) and disables text selection and the context menu on the canvas.

- [ ] Implement; verify in a headless Chromium script that the title shows, a click starts a paused battle, Space unpauses and ticks advance, `replayMatches()` is true after a few seconds. `npm run check`, commit `Plan 3 task 7: wire the game together`.

### Task 8: Playwright test that plays

**Files:**
- Create: `e2e/play.spec.ts`
- Keep: `e2e/smoke.spec.ts` passing unchanged.

The test loads `./?seed=7`, asserts the title, clicks to start, reads `__mm` to confirm tick 0 and paused, computes the client position of blue soldier 0 via `worldToClient`, left-clicks it and asserts the selection, right-clicks a ground point and asserts a `move` command in the log, right-clicks the nearest red soldier's position and asserts an `attack`, snapshots the HUD pixels, presses Space, waits about two seconds, asserts tick grew by at least 30 and the HUD pixels changed, asserts `replayMatches()`, then `advanceTicks(20000)` and asserts a winner and the result text on the canvas via `__mm.winner`. No console errors or failed responses throughout.

- [ ] Write the test, run `npm run build && npm run test:e2e`, commit `Plan 3 task 8: e2e test plays a battle`.

### Task 9: Playtest and tuning

- [ ] Run AI-vs-AI and scripted-player battles over several seeds headless (a scratch script, not committed) and play in headless Chromium with screenshots of title, battle and result. Judge: can the player give the first orders before contact, are battles long enough to use pause and medics, does any class dominate. Tune only `src/sim/constants.ts`, keep `tests/sim/constants.test.ts` green, and list each change in `docs/decisions.md`. If nothing needs changing, record that too.

### Task 10: Docs, decisions, README

- [ ] Append every decision above (and Task 9's) to `docs/decisions.md` as dated lines. Update `README.md` with how to play and the controls, the `?seed` parameter and the `window.__mm` hook. Tick every checkbox in this plan. Update `CLAUDE.md`'s Plans paragraph to say Plan 3 is implemented. `npm run check`, commit `Plan 3 task 10: docs and decisions`.

## Self-review

- Every spec 4.3 control is covered: left click select (Task 3), slot keys 1-5 (3), shift-click add (3), right click move, attack, medic (3), `H` hold (3), `M` medic (3), Space pause (3, 7), Esc menu (3, 4, 7).
- Spec 4.5: downed drawn and selectable, three medic calls shown for both sides (5, 6), revive handled by the sim.
- Spec 4.7: title, battle, result with Play again and Title (4, 6, 7).
- Spec 4.8: shapes, colours, HP bars, selection ring, path, reticle, downed ellipse with prompt, HUD cards with cooldown bar and hotkey, side panel with medic calls and pause state, top bar with timer and enemies remaining (5, 6).
- Spec 5: sim untouched, fixed timestep with interpolation (1, 2), commands only (2, 3), AI through the same log (2), replay check exposed (7) and tested (2), smoke test extended (8).
