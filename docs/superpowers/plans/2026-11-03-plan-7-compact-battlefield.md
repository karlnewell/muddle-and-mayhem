# Plan 7: Compact Battlefield — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Draw the soldiers bigger by showing fewer tiles: a 26 × 15 Compact Crossroads as the default map, a 1032 × 520 logical canvas with the soldier cards in a side panel beside the field, every report naming its map, and the battle pacing checked by `npm run measure` against the spec's guards, with at most one measured constant change per pull request.

**Why:** The owner's playtests at 0.5x say the soldiers look too small and the field too big. `viewport.ts` scales the whole logical canvas to the window, so a bigger window cannot help; only fewer tiles on the canvas can. Today, on Crossroads over seeds 1 to 60: AI versus AI 64.7 s median, first damage 9.7 s, blue 63%; passive 0%; hold-line 27%.

**Architecture:** The sim gains data, not rules: a second map file and a `MAPS` registry keyed by a short id, with the default map named once (`DEFAULT_MAP_ID`) and used by `createBattle`, the renderer's field size and the measure script. The screen layout is a pure function of the player's side (`battleLayout`), returning where the side panel and the field sit; the renderer's projection takes the field's x offset from it, so picking, effects, the volley cue and `window.__mm.worldToClient` follow without their own arithmetic. The HUD's cards stack inside the panel and keep their role as buttons. Title, menu and result screens place their elements through layout functions that tests can check for overlap and bounds. The report gains the map from the battle state.

**Tech Stack:** TypeScript strict, Vite, Canvas 2D, Vitest, Playwright, Node type stripping for scripts. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-03-plan-7-compact-battlefield-design.md`; `CLAUDE.md`.

## Global Constraints

- Map 26 × 15 tiles, `TILE_SIZE` 32 (832 × 480 world units), the exact rows in spec section 3. No other sim rule changes.
- Constants unchanged until a section-6 guard fails; then one lever per PR in the order Launcher range (stays above 224), `AI_SPACING_PENALTY`, splash radius; never per-class HP or speed.
- Logical canvas 1032 × 520: top bar 40 high across the full width; side panel 200 × 480 on the player's side; field 832 × 480.
- `src/sim/` keeps its arithmetic allowlist (`npm run lint:sim`) and never imports from `render`, `input`, `ui` or `game`.
- Every tunable in `constants.ts`; layout numbers in `uiConstants.ts` or `renderConstants.ts`.
- Tests first for logic. Every non-obvious decision a dated line in `docs/decisions.md`.
- Files 200 to 400 lines, 800 max. Plain commit messages, no attribution or co-author trailers.
- `npm run check` and `npm run test:e2e` green before every push (`PW_CHROMIUM_PATH=/opt/pw-browsers/chromium` in the cloud).
- One PR per step, each cut from the previous branch while the earlier one awaits review; rebase on `main` after a merge. Never use the original game's names.

## Decisions this plan makes

Recorded in `docs/decisions.md` as the work lands.

1. **Map ids.** `MapId = 'crossroads' | 'compact'`; `MAPS` maps each id to its `TileMap`; `DEFAULT_MAP_ID` names the default and `DEFAULT_MAP` is `MAPS[DEFAULT_MAP_ID]`. The id is what a person types (`--map=compact`, `MAPS.compact`); the `TileMap.name` (`'Compact Crossroads'`) is what a person reads. `mapIdOf(map)` finds the id by identity, then by name.
2. **Measure default follows the game.** `--map` defaults to `DEFAULT_MAP_ID`, so before the switch a bare `npm run measure` still measures Crossroads and after it Compact Crossroads; the header line prints `map <id>`.
3. **Hold-line posts per map.** `HOLD_POSTS: Record<MapId, Record<SoldierClass, TileCoord>>`, looked up from `state.map` on every think, so `createHoldLine(side)` keeps its signature; a map without posts throws at the first think rather than walking soldiers to another map's coordinates.
4. **Panel side.** `battleLayout(playerSide)` puts the panel at x 0 and the field at x 200 for blue, the field at x 0 and the panel at x 832 for red. The game only ever passes blue today.
5. **Card content.** In 184 × 66 cards: slot box, name and status on the first line, class and `HP n` on the second, the HP bar, then a thin cooldown bar. The cooldown bar stays because it is how the player sees a Launcher reloading.
6. **Menu hint.** The battle-screen controls hint (`CONTROLS_HINT`) is split into two lines (`CONTROLS_HINT_LINES`) and drawn at the bottom of the Esc menu panel, which widens to fit them.
7. **Report map.** `formatReportMarkdown` takes the `MapId` as a fifth argument (default `DEFAULT_MAP_ID`); the summary gains `- Map: <name> (\`<id>\`)` after the build, and the replay line reads `replayBattle(<seed>, log, <ticks>, MAPS.<id>)`. The app passes `mapIdOf(session.state.map)`.

## Review Focus

Five ways this plan fails quietly, each pinned by a test in the task that owns it.

1. A click lands a field width off because one path still assumes the field starts at x 0 (picking, `onField`, the debug hook's `worldToClient`). The renderer test checks `onField` and the projection against `battleLayout`; the e2e test clicks a soldier through `worldToClient` and asserts it is selected. (Tasks 4, 7)
2. A card click selects the wrong soldier, or nothing, because the hit test still uses the old horizontal rects. An app test clicks the centre of each stacked card and asserts the selection is that slot's soldier. (Task 4)
3. An old Crossroads report replays on the new default map and silently diverges. A replay test runs a Crossroads battle and asserts `replayBattle(..., MAPS.crossroads)` matches its hash while the default does not. (Task 6)
4. The hold-line squad on the compact map walks to Crossroads coordinates (a post inside a wall, a soldier that never arrives) and the measured win rate means nothing. The holdline test asserts every post of every map is open and that an unknown map throws. (Task 3)
5. Something drawn below 520 or off the side (a result button, the title's controls, the build stamp, the menu hint). Layout tests assert every rect sits inside the canvas and, on the title screen, that no two overlap. (Task 5)

---

### Task 1: Spec and plan (PR 1)

- [x] Write the spec and this plan; add a dated decision line recording the design. Commit `Plan 7 spec and plan`; open PR "Plan 7 spec and plan".

### Task 2: Compact Crossroads and the map registry (PR 2)

**Files:**
- Create: `src/sim/maps/compactCrossroads.ts`, `src/sim/maps/registry.ts`
- Modify: `src/sim/index.ts` (export `COMPACT_CROSSROADS`, `MAPS`, `DEFAULT_MAP`, `DEFAULT_MAP_ID`, `mapIdOf`, type `MapId`; export `findPath` if not already)
- Test: `tests/sim/compactCrossroads.test.ts`, `tests/sim/mapRegistry.test.ts`

**Interfaces:**
```ts
// src/sim/maps/compactCrossroads.ts
export const COMPACT_CROSSROADS_ROWS: readonly string[];   // spec section 3, verbatim
export const COMPACT_CROSSROADS: TileMap;                  // parseMap('Compact Crossroads', rows)
// src/sim/maps/registry.ts
export type MapId = 'crossroads' | 'compact';
export const MAP_IDS: readonly MapId[];
export const MAPS: Readonly<Record<MapId, TileMap>>;
export const DEFAULT_MAP_ID: MapId;   // 'crossroads' in this task; 'compact' from Task 4
export const DEFAULT_MAP: TileMap;
export function mapIdOf(map: TileMap): MapId | null;
```

- [x] **Step 1: Failing tests.** `compactCrossroads.test.ts`: width 26, height 15, `tiles.length` 390, rows all 26 long; `tiles[y*26+x] === tiles[y*26+25-x]` and `tiles[y*26+x] === tiles[(14-y)*26+x]` for every tile; five spawns per side on open tiles, blue in column 1 and red in column 24, rows 3, 5, 7, 9, 11; road rows 6 to 8 and columns 11 to 14 entirely open; walls, crates and trees all present; `findPath` from every blue spawn tile to every red spawn tile returns a non-empty path; line of sight symmetric over every tile-centre pair (reuse the sweep from `tests/sim/los.test.ts`, moved to a shared helper if needed). `mapRegistry.test.ts`: `MAPS.crossroads === CROSSROADS`, `MAPS.compact === COMPACT_CROSSROADS`, `MAP_IDS` lists both, `mapIdOf` of each map is its id, `mapIdOf(parseMap('Other', …))` is null, `DEFAULT_MAP === MAPS[DEFAULT_MAP_ID]`.
- [x] **Step 2: Run `npx vitest run tests/sim/compactCrossroads.test.ts tests/sim/mapRegistry.test.ts`; expect failures on the missing modules.**
- [x] **Step 3: Implement** the two files with a header comment in the Crossroads style; `battle.ts` defaults to `DEFAULT_MAP` (still Crossroads, so nothing changes).
- [x] **Step 4: `npm run check` green.** Commit `Compact Crossroads map and map registry`.

### Task 3: Measure on either map, hold-line posts per map (PR 2)

**Files:**
- Modify: `scripts/measure-pacing.mts` (`--map=`), `scripts/holdline.mts` (`HOLD_POSTS`, `holdTiles`)
- Test: `tests/scripts/holdline.test.ts`

**Interfaces:**
```ts
// scripts/holdline.mts
export const HOLD_POSTS: Readonly<Record<MapId, Readonly<Record<SoldierClass, TileCoord>>>>;
export function holdTiles(map: TileMap): Readonly<Record<SoldierClass, TileCoord>>; // throws `no hold-line posts for map <name>`
```

- [x] **Step 1: Failing tests.** Replace `HOLD_TILES` with `HOLD_POSTS.crossroads` (same five tiles as today); for every map id the posts are five distinct open tiles; the compact posts have `tx <= 7` (west of or beside the left wall arms' west end at column 7) and lie on rows 3 to 11; `holdTiles(MAPS.compact)` equals `HOLD_POSTS.compact`; `holdTiles(parseMap('Other', rows))` throws `/no hold-line posts/`; a hold-line battle on `MAPS.compact` opens with five move commands to the compact posts and replays bit for bit with the map given.
- [x] **Step 2: Run; expect failures.**
- [x] **Step 3: Implement.** `holdTiles` via `mapIdOf`. Measure: `--map=crossroads|compact` (anything else throws `unknown map`), default `DEFAULT_MAP_ID`, passed to `runBattle`; header prints `map <id>`; usage comment updated.
- [x] **Step 4: Choose the compact posts.** Measure two or three candidate sets with `npm run measure -- --map=compact --blue=holdline` (seeds 1 to 60), starting from the Crossroads pattern moved to the new geometry: Gunner and Chucker on the west faces of the wall arms (column 6, rows 5 and 9), Scorcher at the road mouth (6, 7), Launcher rearmost on the road axis, Blaster beside a road-mouth crate. Record each set's blue wins, median length and red downs per battle; keep the set that plays most like a person holding the mouth (not the one that games the number), and say why in the decision line.
- [x] **Step 5: Baseline tables.** On both maps, `--blue=ai`, `passive`, `holdline`: blue wins, median length, first damage, red downs per battle, per-class share of downs. Into the PR body and a decision line.
- [x] **Step 6: `npm run check` green.** Commit `Measure on either map; hold-line posts for Compact Crossroads`. Open PR 2 "Compact Crossroads" from this branch, noting it is cut from PR 1's branch.

### Task 4: The compact battlefield on screen (PR 3)

**Files:**
- Modify: `src/sim/maps/registry.ts` (`DEFAULT_MAP_ID = 'compact'`), `src/render/renderConstants.ts`, `src/render/renderer.ts`, `src/ui/uiConstants.ts`, `src/ui/hud.ts`, `src/game/app.ts`, `src/main.ts` if it reads sizes
- Modify tests that assume Crossroads by default: `tests/sim/battle.test.ts`, `tests/render/viewport.test.ts`, `tests/ui/hud.test.ts`, others found by `npm test`
- Test: `tests/render/layout.test.ts`, `tests/ui/hud.test.ts`, `tests/game/app.test.ts`

**Interfaces:**
```ts
// src/render/renderConstants.ts
export const FIELD_WIDTH: number;      // mapWidthUnits(DEFAULT_MAP) = 832
export const FIELD_HEIGHT: number;     // 480
export const SIDE_PANEL_WIDTH = 200;
export const LOGICAL_WIDTH: number;    // SIDE_PANEL_WIDTH + FIELD_WIDTH = 1032
export const LOGICAL_HEIGHT: number;   // TOP_BAR_HEIGHT + FIELD_HEIGHT = 520
export interface BattleLayout { panelX: number; fieldX: number; top: number }
export function battleLayout(playerSide: Side): BattleLayout;
// src/render/renderer.ts
export function createTopDownRenderer(playerSide: Side): BattleRenderer;  // projection offset (fieldX, TOP_BAR_HEIGHT)
// src/ui/hud.ts
export function hudCardRects(playerSide: Side): ButtonRect[];   // five, stacked, ids slot0..slot4
export function sidePanelRect(playerSide: Side): ButtonRect;
```

- [x] **Step 1: Failing tests.** `layout.test.ts`: `LOGICAL_WIDTH` 1032, `LOGICAL_HEIGHT` 520, field 832 × 480; `battleLayout('blue')` is `{ panelX: 0, fieldX: 200, top: 40 }` and `battleLayout('red')` `{ panelX: 832, fieldX: 0, top: 40 }`; the blue renderer's `worldToScreen(0, 0)` is (200, 40), `onField(199, 100)` false, `onField(200, 40)` true, `onField(1031, 519)` true. `hud.test.ts`: for both sides the five card rects lie inside `sidePanelRect`, are in slot order top to bottom, do not overlap, and leave at least 70 pixels below the last card for medic calls, pause status and build stamp. `app.test.ts`: in a battle, a left click at the centre of card *i* selects blue soldier *i* (and shift-click adds), a click in the panel below the cards selects nothing. `battle.test.ts`: `createBattle({ seed: 1 }).map` is `COMPACT_CROSSROADS`.
- [x] **Step 2: Run; expect failures.**
- [x] **Step 3: Implement.** Switch the default; derive sizes; the renderer takes the player side; `drawHud` draws the top bar across the full width, fills the panel, the stacked cards (content per decision 5), the medic calls, PAUSED and the build stamp; the controls hint is no longer drawn in battle; the paused banner and debug overlay centre or right-align on the field. Fix the tests that pinned Crossroads by default by passing `map: CROSSROADS` where the test is about Crossroads geometry.
- [x] **Step 4: `npm run check` green.** Committed together with Task 5 (they share `uiConstants.ts`, and the result screen had to fit 520 before the suite could pass) as `Compact Crossroads by default, side panel beside the field, screens fitted to 520 high`.

### Task 5: Title, menu and result refitted to 520 (PR 3)

**Files:**
- Modify: `src/ui/title.ts`, `src/ui/menu.ts`, `src/ui/result.ts`, `src/ui/uiConstants.ts`
- Test: `tests/ui/screens.test.ts` (or a new `tests/ui/screenLayout.test.ts`), `tests/ui/result.test.ts`

**Interfaces:**
```ts
// src/ui/title.ts
export interface TitleLayout { title: Rect; subtitle: Rect; portraits: [Rect, Rect]; start: ButtonRect; hint: Rect; speed: ButtonRect[]; controls: Rect; build: Rect }
export function titleLayout(): TitleLayout;   // every element's bounding box; drawTitle draws from it
// src/ui/menu.ts
export function menuPanelRect(): Rect;
export const CONTROLS_HINT_LINES: readonly string[];  // in uiConstants.ts, two lines
// src/ui/result.ts
export function resultPanelRect(): Rect;
export function resultRowY(i: number): number;   // centre line of table row i
```
(`Rect` is `{ x, y, w, h }`; reuse `ButtonRect`'s shape if one exists.)

- [x] **Step 1: Failing tests.** Title: every `titleLayout()` element inside 1032 × 520 and no two overlapping (portraits, start, hint, speed segments, controls block, build). Menu: panel inside the canvas; buttons, speed segments and both hint lines inside the panel; each hint line at `FONT.small` fits the panel width (count characters × 7.8). Result: panel inside the canvas; all thirteen `resultRowY` lines (header plus twelve) inside the panel and above the first button; all three buttons inside the panel and the canvas.
- [x] **Step 2: Run; expect failures.**
- [x] **Step 3: Implement.** Title: portraits flank the title text instead of sitting below it, Skirmish and its hint, the speed selector, then the controls list, build stamp bottom-right. Menu: wider, taller panel with the two hint lines at its foot. Result: panel 760 × 470 below the top bar (so the badges stay visible), rows 15 high, tighter heading, standing and info lines, buttons stacked below the table.
- [x] **Step 4: `npm run check` green.** Commit `Title, menu and result screens fit 520 high`.

### Task 6: Reports name the map (PR 3)

**Files:**
- Modify: `src/stats/reportText.ts`, `src/game/app.ts`
- Test: `tests/stats/reportText.test.ts`, `tests/sim/replay.test.ts`

- [x] **Step 1: Failing tests.** `formatReportMarkdown(stats, log, 1, 'dev', 'compact')` contains `- Map: Compact Crossroads (\`compact\`)\n` after the build line and `replayBattle(<seed>, log, <ticks>, MAPS.compact)`; with `'crossroads'` it names `Crossroads` and `MAPS.crossroads`; with no fifth argument it uses `DEFAULT_MAP_ID`. Replay: a 900-tick AI-versus-AI battle on `MAPS.crossroads` replays to the same hash with `replayBattle(seed, log, 900, MAPS.crossroads)`, and the same call without the map does not match.
- [x] **Step 2: Run; expect failures.**
- [x] **Step 3: Implement**; the app passes `mapIdOf(session.state.map) ?? DEFAULT_MAP_ID`.
- [x] **Step 4: `npm run check` green.** Commit `Battle report names its map`.

### Task 7: End to end, screenshots, README (PR 3)

**Files:**
- Modify: `e2e/play.spec.ts`, `e2e/tune.spec.ts`, `README.md`, `docs/screenshots/*.png`

- [x] **Step 1: Update the e2e tests** to the new layout: start, select a soldier by clicking it through `worldToClient`, order a move, finish via `advanceTicks`; the volley cue pixel check at the new target position; TUNED and SPEED badge pixel checks at their rects; any check that read "the bottom fifth is the HUD" reads the side panel instead.
- [x] **Step 2: `npm run build && PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test:e2e` green.**
- [x] **Step 3: Regenerate** title, battle, medic, result and debug screenshots with a short Playwright script against the build (not committed), and update README text that describes the map size, the layout or the HUD.
- [x] **Step 4: Decision lines** for decisions 4 to 7. Commit `End to end tests, screenshots and README for the compact battlefield`. Open PR 3 "Compact battlefield on screen", cut from PR 2's branch.

### Task 8: Measure on Compact Crossroads; tune only where a guard fails; close

- [ ] **Step 1: Measure** on the compact map (seeds 1 to 60): `--blue=ai`, `--blue=passive`, `--blue=holdline`; check each section-6 guard.
- [ ] **Step 2: For each failing guard, in lever order,** one PR: the candidate values measured (before and after table), the change in `constants.ts`, a decision line. Stop after splash radius and report any guard still failing.
- [ ] **Step 3: Close.** Re-measure on seeds 1 to 60 and 61 to 180; a closing decision line with the final numbers and what was tried and rejected, in the last PR of the plan.
