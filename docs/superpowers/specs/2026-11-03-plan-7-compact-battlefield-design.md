# Plan 7: Compact Battlefield — Design

**Date:** 2026-11-03
**Status:** Approved by the owner in conversation (2026-11-03); this document writes that design up.
**Builds on:** `docs/superpowers/specs/2026-11-01-muddle-and-mayhem-design.md` (sections 4.1 and 4.8), Plans 3 to 6.

## 1. Intent and why

The owner's playtests at half speed say the soldiers look too small and the field too big. The reference is the early-1990s squad-skirmish games: one screen of battlefield, squads that start close, soldiers big enough to read at a glance.

Window scaling cannot fix this. `src/render/viewport.ts` already scales the whole logical canvas to the window, so a soldier is always the same fraction of the screen; a bigger window makes the field bigger too. The only way to draw soldiers bigger is to show fewer tiles. Plan 7 does that: a smaller map, the same tile and soldier size, and a screen layout that gives the field nearly all of the canvas.

Measured on today's map, Crossroads (40 × 22 tiles), over seeds 1 to 60: AI versus AI median battle 64.7 s, first damage 9.7 s, blue wins 63%; a passive blue squad wins 0%; the hold-line squad wins 27%. Those are the numbers the new map is compared against.

## 2. Goals, non-goals

### Goals
- A smaller battlefield, 26 × 15 tiles, that keeps today's tactics: a crossing to contest, walls to hold behind, crates to duck behind.
- On a typical laptop window everything on the battlefield draws about 1.7 times larger than today.
- Battles stay in the paced range Plan 4 set (section 6), measured, not guessed.
- Every report says which map it ran on, so a report from before the switch still replays.

### Non-goals
- No simulation rule changes. The map is data; the sim already takes any `TileMap`.
- No per-class HP or speed (roadmap item 13). It is the known lever for the red Scorcher deciding fights, and it is its own design conversation.
- Nothing about the owner pressing `A` repeatedly like a trigger (each press repeats the same order). Left for a later design conversation.
- No map choice in the game. One default map; the old one stays in code.
- No change to tile size (`TILE_SIZE` 32) or soldier size.

## 3. The map: Compact Crossroads

26 × 15 tiles at `TILE_SIZE` 32, so 832 × 480 world units. A shrunk Crossroads named **Compact Crossroads**, mirror-symmetric left to right and top to bottom. The layout has been checked with the game's own `parseMap`: 26 × 15, five spawns per side, symmetric both ways.

Legend: `.` open, `#` wall, `c` crate, `t` tree, `b` blue spawn, `r` red spawn. The exact rows, top to bottom:

```
..........................
...t..................t...
.......cc.#....#.cc.......
.b.......##....##.......r.
....cc..............cc....
.b.....####....####.....r.
..........................
.b......................r.
..........................
.b.....####....####.....r.
....cc..............cc....
.b.......##....##.......r.
.......cc.#....#.cc.......
...t..................t...
..........................
```

Features, by tile (column, row), zero-based:

- A horizontal road on rows 6 to 8 and a vertical road on columns 11 to 14, both fully open.
- Four 4-tile wall arms box the crossing: columns 7 to 10 and 15 to 18, on rows 5 and 9.
- Small L walls guard the vertical road: (10, 2), (9, 3), (10, 3) and their mirrors.
- A crate pair near each road mouth, (4, 4)–(5, 4) and (4, 10)–(5, 10) with mirrors, and near each top and bottom edge, (7, 2)–(8, 2) and (7, 12)–(8, 12) with mirrors.
- Corner trees at (3, 1), (22, 1), (3, 13), (22, 13).
- Blue spawns down column 1 on rows 3, 5, 7, 9, 11; red down column 24 on the same rows. Opposite spawns are 23 tiles apart (Crossroads: 35).

The constant is `COMPACT_CROSSROADS` in `src/sim/maps/compactCrossroads.ts`, written out row by row like Crossroads. It becomes the default map: `createBattle` uses it when no map is given, and the renderer's field size comes from it. `CROSSROADS` stays in the code for tests, for old measurements and for replaying old reports.

## 4. Ranges first, then measure

Weapon ranges and every constant start unchanged. Gunner and Chucker reach 224 units (7 tiles), the Blaster 160 (5), the Scorcher 72 (a little over 2), the Launcher 352 (11). On the compact map the Launcher covers nearly half the field's width from its spawn, so it is the first suspect, but nothing changes until a measurement says a guard in section 6 fails.

When a guard fails, one measured change per pull request, each with a before-and-after table and a decision line, tried in this order:

1. **Launcher range down.** It must stay longer than the Gunner and Chucker at 224.
2. **A stronger `AI_SPACING_PENALTY`.** A smaller field packs the squads tighter, and splash rewards that.
3. **Splash radius.**

If a guard still fails after those three, the work stops and says which guard, rather than reaching for per-class HP or speed.

## 5. The screen

### 5.1 Layout

The logical canvas becomes **1032 × 520** (today 1280 × 876):

- A **top bar**, 40 high, across the full width. Contents unchanged: the title, the TUNED and SPEED badges, the clock, the squad counts.
- Below it, a **side panel**, 200 wide and 480 high, beside the **field**, 832 × 480 at one logical pixel per world unit.

The side panel sits on **the player's side of the field**: the side the player's squad spawns on. The player commands blue today, which spawns on the left, so the panel is always on the left today. The rule is stated so a future remote second player commanding red gets the panel on the right, with the field shifted to x = 0. The layout is a function of the player's side, not a constant.

Because `viewport.ts` scales the whole logical canvas to the window, a smaller canvas with the same tile size is the whole of the "bigger soldiers" change. On a typical laptop browser window the window's height limits today's canvas, so the gain is close to 876 / 520 ≈ 1.7. On a window whose shape lets the width limit the new canvas it is a little less: on 1440 × 800, today's canvas scales by min(1440 / 1280, 800 / 876) ≈ 0.91 and the new one by min(1440 / 1032, 800 / 520) ≈ 1.40, about 1.5 times larger.

### 5.2 The side panel

Top to bottom:

1. **Five soldier cards**, stacked in slot order 1 to 5. Each shows the slot number, name, class, HP bar and status (OK, DOWN, DEAD, JAM). Clicking a card selects that soldier, exactly as clicking a bottom card does today.
2. **Medic calls** for both sides.
3. **The pause status** (PAUSED while paused).
4. **The build stamp** at the bottom.

The one-line controls hint leaves the battle screen. It stays on the title screen (as the controls list it already has) and appears in the Esc menu.

### 5.3 The field

The field's offset on the canvas is the panel width plus the top bar height, through the existing `Projection` (`createTopDownProjection(offsetX, offsetY)`). Picking, the volley cue, effects, the medic runner, the debug overlay's soldier marks and `window.__mm.worldToClient` all go through that projection, so they follow without their own arithmetic. The paused banner and the debug overlay sit over the field.

### 5.4 Other screens

The title screen, the Esc menu and the result screen are refitted to 520 high, every element inside the canvas and none overlapping. The result screen keeps its per-class table (a header and twelve rows) with tighter rows and margins, and its three buttons. Copy report is unchanged except for section 7.

## 6. Targets

All with `npm run measure` over seeds 1 to 60 on Compact Crossroads; the closing decision line confirms them on seeds 61 to 180 as well.

| Guard | Target |
|---|---|
| AI versus AI median battle length | 55 to 90 s of game time |
| AI versus AI median first damage | 3 to 6 s |
| Hold-line blue wins | 25 to 35% |
| Passive blue wins | 0% |
| Each class's share of enemy downs, AI versus AI | between about 10% and 35% |

Plus two or three reports from the owner's own play on the live site at 0.5x after the map ships. Those are judged by the owner, not by a number.

The hold-line squad needs posts on the new map (section 8). They are chosen from two or three measured candidate sets, and the choice is recorded.

## 7. Reports name the map

Once the default changes, a report written on Crossroads would replay on the wrong map. So:

- The Copy report summary gains a `Map:` line naming the map the battle ran on.
- Its replay instruction names the map too, in a form that can be pasted: `replayBattle(seed, log, ticks, MAPS.compact)` or `MAPS.crossroads`. `replayBattle` already takes an optional map as its fourth argument; a `MAPS` record keyed by a short map id, exported from `src/sim/index.ts`, makes that usable from the instruction. A report from before this change has no `Map:` line and ran on Crossroads.

## 8. Tooling

- `npm run measure` gains `--map=crossroads|compact`. Its default follows the game's default map, so after the switch a bare `npm run measure` measures what players play; the header line prints the map.
- `scripts/holdline.mts` keys its posts by map name. The Crossroads posts stay as they are. The compact posts stand beside the new wall arms and crates at the left road mouth.

## 9. Testing

- **Map:** parses; 26 × 15; mirror-symmetric left-right and top-bottom; five spawns per side on open tiles; every blue spawn has a path to every red spawn (and so, by symmetry of paths, the reverse); line of sight is symmetric over every tile-centre pair, as the Crossroads test already checks.
- **Hold-line posts:** distinct open tiles for both maps, the compact ones west of the left wall arms.
- **Layout:** card rectangles inside the side panel and not overlapping; the panel on the left for blue and the right for red; a click on a card selects the right soldier; every result-screen row and button inside the canvas; title-screen elements inside the canvas and not overlapping; Esc-menu elements inside the canvas.
- **Replay:** a battle run on Crossroads still replays with `MAPS.crossroads` given; the default replay uses Compact Crossroads.
- **Report:** the Markdown has a `Map:` line and a replay instruction that names the map.
- **End to end (Playwright):** start, order and finish a battle on the new layout; the volley cue and the TUNED and SPEED badge pixel checks moved to the new layout.
- **Screenshots:** `docs/screenshots/` regenerated, and the README text that describes the layout or the map updated.
