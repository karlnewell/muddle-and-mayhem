# Plan 2: Headless Simulation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The whole battle as a deterministic, headless TypeScript module under `src/sim/`: the Crossroads tile map, line of sight, A* pathfinding with soldier separation, five soldier classes with distinct weapons, damage with downed and instant-kill outcomes, medic calls, the win condition, a per-tick command queue, a fixed-tick `step`, a deterministic computer opponent that issues commands through the same log, and a replay test that proves seed plus command log reproduces a battle bit for bit.

**Architecture:** One mutable `BattleState` object created by `createBattle` and advanced by `step(state, commands)`, which applies that tick's commands and then runs the tick phases in a fixed order: soldier orders and movement, firing, projectile flight and impacts, flame cones, medic runs, collision separation, win check. Everything is plain data (so `JSON.stringify` yields a canonical form to hash) except the seeded `Rng`. The computer opponent is a controller object (`createAi`) with its own seeded stream that reads state and returns commands; a headless runner feeds controller commands into `step` and records the log. No file under `src/sim/` may touch the browser or the clock.

**Tech Stack:** TypeScript strict, Vitest. No new dependencies. `npm run lint:sim` enforces the arithmetic and import rules on every file under `src/sim/`.

**Spec:** `docs/superpowers/specs/2026-11-01-muddle-and-mayhem-design.md`, sections 4.1 to 4.7 and 5. Section 9 lists what this plan decides; each such decision is also a dated line in `docs/decisions.md` (Task 12).

**Out of scope (Plan 3):** rendering, DOM, input, pause, HUD, title and result screens, Playwright changes.

## Global Constraints

- Every file under `src/sim/` obeys CLAUDE.md rule 5: only `+ - * /`, `Math.sqrt`, `Math.floor`, `Math.abs`, `Math.min`, `Math.max`, `Math.imul`, integer bit operators, and comparisons. No other `Math` member, no `**`, no `Date`, `performance`, `document`, `window`, no imports from `render`, `input`, or `ui`. Squared distances everywhere; dot products against precomputed cosines for cones; a 16-entry unit-vector table of plain literals for scatter directions.
- Randomness only through `createRng` from `src/sim/rng.ts`. The battle has one stream (`state.rng`); each AI side has its own stream derived from the battle seed. Every call site consumes the stream in a fixed order (soldiers by ascending id, projectiles in array order) so replays match.
- Every tunable lives in `src/sim/constants.ts`. Logic files import them; none defines a magic number for speed, range, damage, cooldown, radius, chance, or interval.
- Units: world units, 32 per tile. Time: ticks, 30 per second. Speeds are world units per tick, durations are ticks.
- Files small and single-purpose (200-400 lines typical, 800 max). Tests under `tests/sim/`, one test file per source file.
- Tests first: each task writes the failing Vitest case, runs it to see it fail, then implements.
- `npm run check` green before every commit. Commit messages plain, no attribution trailers.
- Never use the original game's names anywhere (CLAUDE.md, Legal rules).

## Decisions this plan makes (spec section 9 and open points)

Recorded in `docs/decisions.md` in Task 12; listed here so every task builds on the same answers.

1. Tick rate 30 Hz. Tile 32 world units. Crossroads is 40 by 22 tiles (1280 by 704 world units), mirror-symmetric left to right.
2. HP 100, move speed 3.2 units per tick (3 tiles per second), soldier collision radius 12.
3. Commands carry explicit soldier ids. `select` is a real command that records the side's selection in state (so replays show it) but orders never read it; the input layer fills `soldierIds` from the selection. Group orders therefore cost the simulation nothing; whether the UI exposes multi-select is Plan 3's call.
4. `step` mutates the state in place. Every soldier, projectile, and medic keeps `prevX`/`prevY` from the previous tick so the renderer can interpolate.
5. Soldiers auto-fire at enemies in range while moving or holding (`FIRE_WHILE_MOVING = true`). Plan 3's playtest may flip the constant.
6. Attack order: approach until the target is in range (and in line of sight for direct and flame weapons), then stop and fire; when the target is downed or dead the order becomes hold.
7. Downed and dead soldiers do not block movement and are never hit or targeted. Downed soldiers take no damage; dead ones are removed from play but stay in the array (status `dead`, position kept) so the renderer can draw ash.
8. Splash is full damage to every standing soldier within the radius, both sides, no falloff. A direct projectile deals its direct damage to the soldier it hits and splash damage to everyone else in radius.
9. Direct projectiles stop at the first cover tile or standing enemy on their path and vanish at maximum range without detonating.
10. Lobbed shots are a timed arrival: on the landing tick a splash check at the landing point, regardless of cover.
11. Flame is a cone check each tick: in range, inside the cone (dot product against a precomputed cosine), and in line of sight. Continuous damage per tick, no cooldown.
12. Instant kill: a hit from a Launcher, Scorcher, or Blaster that would down a soldier rolls `INSTANT_KILL_CHANCE` (0.1) on the battle stream; success sets status `dead`.
13. Gunner jam: each shot rolls `GUNNER_JAM_CHANCE`; on a jam the cooldown becomes `GUNNER_JAM_TICKS`.
14. Aim scatter: every direct and lobbed shot offsets its aim point by a random direction from the 16-entry table and a random distance up to the weapon's `spread`.
15. The medic is abstract: it appears at its side's map edge level with the body, travels in a straight line at `MEDIC_SPEED` ignoring cover, and cannot be hit. The call is spent when the command is accepted.
16. Win: checked at the end of every tick; a side with zero standing soldiers loses. Both at zero on the same tick is a draw (`winner: 'draw'`).
17. A move to a blocked tile snaps to the nearest open tile (ring search). A soldier that makes no progress for `STUCK_TICKS` counts as arrived if its destination is within `ARRIVE_SLACK`, otherwise re-plans with other standing soldiers' tiles treated as blocked; if that fails, it holds.
18. State hash: 32-bit FNV-1a over the UTF-16 code units of `JSON.stringify(state)`. Number-to-string conversion is specified by ECMAScript, so the hash is engine-independent. Functions (the rng) are skipped by `JSON.stringify`.
19. The computer opponent lives under `src/sim/ai.ts` (not `src/ai/`) so the arithmetic guard covers it. It thinks every `AI_THINK_TICKS` (15) and only issues a command when it would change a soldier's order, so logs stay small.
20. Soldier names are five per side, original, in `constants.ts`: blue `Pip, Bert, Maud, Fitz, Dot`; red `Grub, Nell, Otto, Sal, Wick`.

## Review Focus

Things a reviewer should check hardest, because they are the ways this plan fails quietly.

1. A replay matches only because the test replays the same process. The replay test must build a fresh state from the seed and feed only the recorded log, never the AI, and compare both the hash and the full JSON. (Task 12)
2. A hidden source of nondeterminism: iteration over a `Set` or `Map` keyed by object identity, `Object.keys` on objects built in varying order, sorting without a total order, or an rng call inside a branch whose condition depends on floating-point tie-breaks that differ between runs. Review every `sort` comparator and every `rng` call site. (Tasks 4, 7 to 11)
3. Arithmetic that slips past the guard: `**`, `Math.round`, `Math.hypot`, `Math.trunc`, `Number.prototype.toFixed`, `parseFloat` on computed strings. Only `JSON.stringify` of state (Task 11) converts numbers to strings. (All tasks)
4. Corner cutting in A*: a diagonal step between two cover tiles lets a soldier pass through a wall corner. Diagonal moves require both orthogonal neighbours open. (Task 4)
5. Tunneling: a projectile moving 16 units per tick skipping a soldier of radius 12. Hit tests are segment-versus-circle and segment-versus-tiles over the whole tick's travel, never point samples. (Task 7)
6. Rng consumption order that depends on command order within a tick. Commands are applied in the order given; the runner records them in that same order. (Tasks 5, 12)
7. Battles that never end in the AI-vs-AI test (two Launchers keeping distance, or everyone stuck). The AI always falls back to an attack order on the nearest enemy, and the test asserts a winner within `maxTicks` for several seeds. (Tasks 11, 12)

---

### Task 1: Constants, types, and vector helpers

**Files:**
- Create: `src/sim/constants.ts`, `src/sim/types.ts`, `src/sim/vec.ts`
- Test: `tests/sim/vec.test.ts`, `tests/sim/constants.test.ts`

**Interfaces:**

`src/sim/types.ts` (types only, no runtime code except `const` arrays):
```ts
import type { Rng } from './rng';

export type Side = 'blue' | 'red';
export type SoldierClass = 'gunner' | 'launcher' | 'chucker' | 'scorcher' | 'blaster';
export type SoldierStatus = 'standing' | 'downed' | 'dead';
export type ShotKind = 'direct' | 'lobbed' | 'flame';

export interface Vec2 { x: number; y: number }
export interface TileCoord { tx: number; ty: number }

export type Order =
  | { kind: 'hold' }
  | { kind: 'move'; x: number; y: number }
  | { kind: 'attack'; targetId: number };

export interface Soldier {
  id: number;
  side: Side;
  cls: SoldierClass;
  name: string;
  x: number; y: number;
  prevX: number; prevY: number;
  faceX: number; faceY: number;     // unit vector, last firing or moving direction
  hp: number;
  status: SoldierStatus;
  order: Order;
  path: Vec2[];                     // remaining waypoints in world units, first is next
  cooldown: number;                 // ticks until the weapon may fire again
  targetId: number | null;          // soldier fired at this tick, or null
  firing: boolean;                  // true on ticks the weapon discharged (flame: cone active)
  stuckTicks: number;
  lastRepathTick: number;
}

export interface Projectile {
  id: number;
  kind: 'direct' | 'lobbed';
  weapon: SoldierClass;
  side: Side;
  ownerId: number;
  x: number; y: number;
  prevX: number; prevY: number;
  vx: number; vy: number;           // direct: units per tick; lobbed: 0
  startX: number; startY: number;
  targetX: number; targetY: number; // lobbed: landing point; direct: aim point
  launchTick: number;
  landTick: number;                 // lobbed only; direct: -1
  travelled: number;                // direct only
  maxDistance: number;              // direct only
}

export interface MedicRun {
  side: Side;
  targetId: number;
  x: number; y: number;
  prevX: number; prevY: number;
}

export interface SideState { medicCalls: number; selected: number[] }

export type BattleEvent =
  | { kind: 'shot'; soldierId: number; weapon: SoldierClass }
  | { kind: 'jam'; soldierId: number }
  | { kind: 'impact'; x: number; y: number; weapon: SoldierClass; radius: number }
  | { kind: 'damage'; soldierId: number; amount: number; weapon: SoldierClass }
  | { kind: 'downed'; soldierId: number }
  | { kind: 'killed'; soldierId: number }
  | { kind: 'medic'; side: Side; targetId: number }
  | { kind: 'revived'; soldierId: number }
  | { kind: 'victory'; winner: Side | 'draw' };

export type Command =
  | { tick: number; side: Side; type: 'select'; soldierIds: number[] }
  | { tick: number; side: Side; type: 'move'; soldierIds: number[]; x: number; y: number }
  | { tick: number; side: Side; type: 'attack'; soldierIds: number[]; targetId: number }
  | { tick: number; side: Side; type: 'hold'; soldierIds: number[] }
  | { tick: number; side: Side; type: 'medic'; targetId: number };

export interface TileMap {
  name: string;
  width: number;                    // tiles
  height: number;                   // tiles
  tiles: number[];                  // row-major, TILE_OPEN or a cover kind
  spawns: Record<Side, Vec2[]>;     // five world-unit points per side, class order
}

export interface BattleState {
  tick: number;
  seed: number;
  map: TileMap;
  soldiers: Soldier[];              // ids 0..9, blue first, class order per side
  projectiles: Projectile[];
  medics: MedicRun[];
  sides: Record<Side, SideState>;
  winner: Side | 'draw' | null;
  nextProjectileId: number;
  events: BattleEvent[];            // this tick's events; cleared at the start of step
  rng: Rng;
}
```

`src/sim/constants.ts` exports (values are the starting numbers; the owner tunes them):
```ts
export const TICK_RATE = 30;
export const TILE_SIZE = 32;
export const MAX_HP = 100;
export const MOVE_SPEED = 3.2;
export const SOLDIER_RADIUS = 12;
export const MEDIC_CALLS = 3;
export const MEDIC_SPEED = 6;
export const REVIVE_FRACTION = 0.5;
export const INSTANT_KILL_CHANCE = 0.1;
export const GUNNER_JAM_CHANCE = 0.03;
export const GUNNER_JAM_TICKS = 45;
export const FLAME_CONE_COS = 0.8660254037844387; // cos 30°, so a 60° cone
export const FIRE_WHILE_MOVING = true;
export const REPATH_TICKS = 15;
export const STUCK_TICKS = 10;
export const STUCK_EPSILON = 0.5;   // moved less than this in a tick counts as no progress
export const WAYPOINT_EPSILON = 1;  // within this of a waypoint counts as reached
export const ARRIVE_SLACK = 26;     // 2 * SOLDIER_RADIUS + 2: a stuck soldier this close to its destination counts as arrived
export const AI_THINK_TICKS = 15;
export const AI_COVER_BONUS = 2;
export const AI_RANGE_FRACTION = 0.9;
export const AI_LAUNCHER_DISTANCE_WEIGHT = 3;
export const AI_TRAVEL_WEIGHT = 1;
export const AI_JITTER = 0.5;
export const AI_SEED_SALT: Record<Side, number> = { blue: 0x9e3779b9, red: 0x7f4a7c15 };
export const AI_REVIVE_PRIORITY: SoldierClass[] = ['launcher', 'blaster', 'chucker', 'gunner', 'scorcher'];
export const CLASS_ORDER: readonly SoldierClass[] = ['gunner', 'launcher', 'chucker', 'scorcher', 'blaster'];
export const SIDES: readonly Side[] = ['blue', 'red'];
export const SQUAD_NAMES: Record<Side, readonly string[]> = {
  blue: ['Pip', 'Bert', 'Maud', 'Fitz', 'Dot'],
  red: ['Grub', 'Nell', 'Otto', 'Sal', 'Wick'],
};
export const TILE_OPEN = 0;
export const TILE_WALL = 1;
export const TILE_CRATE = 2;
export const TILE_TREE = 3;

export interface WeaponStats {
  shot: ShotKind;
  range: number;          // world units
  cooldown: number;       // ticks between shots (flame: 0)
  damage: number;         // direct hit damage; flame: damage per tick; lobbed: 0
  splashRadius: number;   // world units, 0 for none
  splashDamage: number;   // damage to each standing soldier in the splash
  speed: number;          // direct: units per tick
  flightTicks: number;    // lobbed: ticks from launch to landing
  spread: number;         // max aim offset in world units
  instantKill: boolean;
}
export const WEAPONS: Record<SoldierClass, WeaponStats> = {
  gunner:   { shot: 'direct', range: 224, cooldown: 6,   damage: 8,  splashRadius: 0,  splashDamage: 0,  speed: 16, flightTicks: 0,  spread: 14, instantKill: false },
  launcher: { shot: 'direct', range: 352, cooldown: 75,  damage: 45, splashRadius: 40, splashDamage: 25, speed: 10, flightTicks: 0,  spread: 10, instantKill: true },
  chucker:  { shot: 'lobbed', range: 224, cooldown: 60,  damage: 0,  splashRadius: 48, splashDamage: 35, speed: 0,  flightTicks: 30, spread: 20, instantKill: false },
  scorcher: { shot: 'flame',  range: 96,  cooldown: 0,   damage: 1,  splashRadius: 0,  splashDamage: 0,  speed: 0,  flightTicks: 0,  spread: 0,  instantKill: true },
  blaster:  { shot: 'lobbed', range: 160, cooldown: 105, damage: 0,  splashRadius: 40, splashDamage: 70, speed: 0,  flightTicks: 36, spread: 16, instantKill: true },
};
/** 16 unit vectors at 22.5° steps, as literals (no Math.sin/cos in sim code). */
export const DIRECTIONS16: readonly Vec2[] = [
  { x: 1, y: 0 }, { x: 0.9238795325112867, y: 0.3826834323650898 },
  { x: 0.7071067811865476, y: 0.7071067811865476 }, { x: 0.3826834323650898, y: 0.9238795325112867 },
  { x: 0, y: 1 }, { x: -0.3826834323650898, y: 0.9238795325112867 },
  { x: -0.7071067811865476, y: 0.7071067811865476 }, { x: -0.9238795325112867, y: 0.3826834323650898 },
  { x: -1, y: 0 }, { x: -0.9238795325112867, y: -0.3826834323650898 },
  { x: -0.7071067811865476, y: -0.7071067811865476 }, { x: -0.3826834323650898, y: -0.9238795325112867 },
  { x: 0, y: -1 }, { x: 0.3826834323650898, y: -0.9238795325112867 },
  { x: 0.7071067811865476, y: -0.7071067811865476 }, { x: 0.9238795325112867, y: -0.3826834323650898 },
];
```
Range relationships to preserve when tuning: Launcher longest, Gunner and Chucker medium, Blaster second shortest, Scorcher shortest. Gunner fastest of direct weapons, Blaster slowest overall.

`src/sim/vec.ts`:
```ts
export function dist2(ax: number, ay: number, bx: number, by: number): number;
export function length(x: number, y: number): number;              // Math.sqrt(x*x + y*y)
export function normalize(x: number, y: number): Vec2;              // {x:0,y:0} stays {x:0,y:0}
export function dot(ax: number, ay: number, bx: number, by: number): number;
export function clamp(v: number, lo: number, hi: number): number;   // Math.min/Math.max
```

- [ ] **Step 1: Write the failing tests**

`tests/sim/vec.test.ts`: `dist2(0,0,3,4)` is 25; `length(3,4)` is 5; `normalize(3,4)` is `{x:0.6,y:0.8}` and `normalize(0,0)` is `{x:0,y:0}`; `dot(1,0,0,1)` is 0; `clamp(5,0,3)` is 3 and `clamp(-1,0,3)` is 0.

`tests/sim/constants.test.ts`: `WEAPONS` has exactly the five classes in `CLASS_ORDER`; range ordering holds (`launcher > gunner`, `gunner === chucker` or `>=`, `chucker > blaster > scorcher`); `gunner.cooldown` is the smallest non-zero cooldown; `blaster.cooldown` is the largest; `scorcher.cooldown` is 0; every entry of `DIRECTIONS16` has `x*x + y*y` within `1e-12` of 1; `SQUAD_NAMES` has five distinct names per side; `FLAME_CONE_COS` is between 0 and 1.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL, cannot resolve `../../src/sim/vec` and `../../src/sim/constants`.

- [ ] **Step 3: Implement the three files exactly as specified above**

`types.ts` carries a short header comment: "Plain data only. `JSON.stringify(state)` is the canonical serialisation used for hashing, so no class instances, Maps, Sets, or typed arrays."

- [ ] **Step 4: Run the tests and the guard**

Run: `npm test` then `npm run lint:sim`
Expected: PASS; the guard prints nothing and exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/sim/constants.ts src/sim/types.ts src/sim/vec.ts tests/sim/vec.test.ts tests/sim/constants.test.ts
git commit -m "Add simulation constants, state and command types, and vector helpers"
```

---

### Task 2: Tile map and the Crossroads map

**Files:**
- Create: `src/sim/map.ts`, `src/sim/maps/crossroads.ts`
- Test: `tests/sim/map.test.ts`, `tests/sim/crossroads.test.ts`

**Interfaces:**

`src/sim/map.ts`:
```ts
export function parseMap(name: string, rows: readonly string[]): TileMap;
// Legend: '.' open, '#' wall, 'c' crate, 't' tree, 'b' blue spawn (open), 'r' red spawn (open).
// Spawns are listed top to bottom; their world point is the tile centre. Throws if any row
// length differs from the first or if either side has a spawn count other than 5.
export function tileIndex(map: TileMap, tx: number, ty: number): number;     // ty * width + tx
export function isBlocked(map: TileMap, tx: number, ty: number): boolean;    // out of bounds counts as blocked
export function worldToTile(x: number, y: number): TileCoord;                // Math.floor(x / TILE_SIZE)
export function tileCenter(tx: number, ty: number): Vec2;                    // (tx + 0.5) * TILE_SIZE
export function mapWidthUnits(map: TileMap): number;
export function mapHeightUnits(map: TileMap): number;
export function nearestOpenTile(map: TileMap, tx: number, ty: number): TileCoord;
// Ring search outward (Chebyshev rings 0, 1, 2, ...), scanning each ring top-left to
// bottom-right, so the result is deterministic. Throws if the map has no open tile.
export function circleOverlapsCover(map: TileMap, x: number, y: number, r: number): boolean;
// True if the circle intersects any blocked tile (nearest-point test per candidate tile).
```

`src/sim/maps/crossroads.ts`: `export const CROSSROADS_ROWS: readonly string[]` (22 strings of 40 characters) and `export const CROSSROADS: TileMap = parseMap('Crossroads', CROSSROADS_ROWS)`. The left half of each row is authored; the right half is its mirror with `b` replaced by `r`. Author the left 20 columns as:
```
row  0  ....................
row  1  ....t.......t.......
row  2  ..........cc........
row  3  ..........cc...##...
row  4  ...............#....
row  5  ....t...............
row  6  ..b.....c...........
row  7  ........cc..........
row  8  ..b.........######..
row  9  ....................
row 10  ..b.................
row 11  ....................
row 12  ..b.........######..
row 13  ....................
row 14  ..b.....c...........
row 15  ........cc..........
row 16  ....t...............
row 17  ...............#....
row 18  ..........cc...##...
row 19  ..........cc........
row 20  ....t.......t.......
row 21  ....................
```
Write the full 40-character rows out literally in the file (do not build them with string code at module load; the file is data a human reads). The result is an open vertical road through columns 18 to 21 and an open horizontal road through rows 9 to 11, boxed by four wall arms, with crate clusters in each quadrant, small L walls near the edges, and trees in the corners.

- [ ] **Step 1: Write the failing tests**

`tests/sim/map.test.ts` on a tiny inline map (`['b.#', '...', 'r..']` padded to five spawns is awkward, so use a 5-row map with five `b` and five `r`):
- `parseMap` gives `width`, `height`, tiles with `TILE_WALL` at `#`, `TILE_OPEN` at `.`, `b`, `r`; spawns at tile centres in top-to-bottom order; throws on ragged rows; throws on four spawns.
- `isBlocked` is true for wall tiles and for `(-1, 0)`, `(width, 0)`.
- `worldToTile(33, 31)` is `{tx:1, ty:0}`; `tileCenter(1, 0)` is `{x:48, y:16}`.
- `nearestOpenTile` on a blocked tile returns an adjacent open tile, and the same one every call; on an open tile returns itself.
- `circleOverlapsCover` is true for a circle of radius 12 centred 10 units from a wall tile's edge and false at 13 units.

`tests/sim/crossroads.test.ts`: width 40, height 22; every row 40 characters; mirror symmetry (`tiles[y*40 + x] === tiles[y*40 + 39 - x]` for all x, y); five spawns per side, all on open tiles, blue x less than 20 tiles and red x greater; a path corridor exists in the sense that the centre tile `(20, 10)` is open and so are `(19, 10)`, `(20, 11)`; at least one wall, one crate, one tree present.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `map.ts` and `maps/crossroads.ts`**

`circleOverlapsCover`: candidate tiles are those whose bounding box intersects the circle's bounding box (`floor((x - r)/TILE_SIZE)` to `floor((x + r)/TILE_SIZE)`); for each blocked candidate, clamp the circle centre to the tile rectangle and compare squared distance with `r*r`.

- [ ] **Step 4: Run tests and guard**

Run: `npm test` then `npm run lint:sim`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sim/map.ts src/sim/maps/crossroads.ts tests/sim/map.test.ts tests/sim/crossroads.test.ts
git commit -m "Add tile map helpers and the Crossroads map"
```

---

### Task 3: Line of sight

**Files:**
- Create: `src/sim/los.ts`
- Test: `tests/sim/los.test.ts`

**Interfaces:**
```ts
/** Parameter t in [0, 1] along the segment at which it first enters a blocked tile, or null. */
export function firstCoverHit(map: TileMap, ax: number, ay: number, bx: number, by: number): number | null;
export function hasLineOfSight(map: TileMap, ax: number, ay: number, bx: number, by: number): boolean;
```
Algorithm: grid traversal (Amanatides and Woo). Start tile `floor(a / TILE_SIZE)`; the start tile is never tested (a soldier stands on open ground, and this lets shots leave a tile edge cleanly). Step along x or y by comparing `tMaxX` and `tMaxY`; a zero component uses `tMax = 2` (beyond the segment) instead of a division by zero. Each entered tile is tested; the first blocked one returns the `t` at which it was entered. Stop when the end tile has been tested or `t` exceeds 1. Ties (`tMaxX === tMaxY`, an exact corner) step x first, then y, testing both tiles; this is the no-corner-cutting rule for sight lines.

- [ ] **Step 1: Write the failing tests**

Use `parseMap` with a 10 by 6 map containing a vertical wall at column 5, rows 1 to 4, with a gap at row 0 and row 5.
- Clear sight across open ground: `hasLineOfSight` true, `firstCoverHit` null.
- Blocked straight across the wall: false; `firstCoverHit` is between 0 and 1 and its point `a + t*(b - a)` lies on the wall tile's left edge (x within `1e-9` of `5 * TILE_SIZE`).
- Through the gap at row 0: true.
- Diagonal that passes exactly through a wall corner (both neighbouring tiles blocked): false.
- Zero-length segment: true.
- Vertical segment (`ax === bx`) along a column with a wall: false; without: true.
- Symmetry: `hasLineOfSight(a, b) === hasLineOfSight(b, a)` for a handful of pairs.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test` — FAIL, module not found.

- [ ] **Step 3: Implement `los.ts`**

- [ ] **Step 4: Run tests and guard**

Run: `npm test` then `npm run lint:sim` — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sim/los.ts tests/sim/los.test.ts
git commit -m "Add grid line of sight"
```

---

### Task 4: A* pathfinding on the tile grid

**Files:**
- Create: `src/sim/path.ts`
- Test: `tests/sim/path.test.ts`

**Interfaces:**
```ts
/**
 * Tile path from start to goal, excluding start and including goal, or null if unreachable.
 * 8-connected; diagonal steps need both orthogonal neighbours open. Cost 1 orthogonal,
 * SQRT2 diagonal; octile heuristic. `blocked` holds extra tile indices to treat as cover
 * (other soldiers' tiles); the goal is always allowed.
 */
export function findPath(map: TileMap, start: TileCoord, goal: TileCoord, blocked?: ReadonlySet<number>): TileCoord[] | null;
/** World-unit waypoints: the centres of the path tiles, with the last replaced by `dest` when given. */
export function pathToWaypoints(path: TileCoord[], dest?: Vec2): Vec2[];
export const SQRT2 = 1.4142135623730951;
```
Open list: a binary heap ordered by `f`, then `h`, then insertion sequence number, so ties resolve identically on every run. Closed and `g` tables are plain arrays indexed by tile index. Start equals goal returns `[]`. A blocked goal returns null (callers snap first with `nearestOpenTile`). Neighbour order is fixed: E, W, S, N, SE, SW, NE, NW.

- [ ] **Step 1: Write the failing tests**

- Straight line on an open 10 by 10 map from `(0,0)` to `(3,0)` gives three tiles ending at `(3,0)`.
- Diagonal from `(0,0)` to `(3,3)` gives exactly three tiles (diagonals allowed).
- Around a wall: a wall at column 4 rows 0 to 8 on a 10 by 10 map; path from `(2,4)` to `(6,4)` exists, contains no blocked tile, and goes through row 9.
- No corner cutting: tiles `(1,0)` and `(0,1)` blocked; path from `(0,0)` to `(1,1)` is null (the only neighbour is diagonal through the corner).
- Unreachable goal (walled room) returns null; start equals goal returns `[]`.
- `blocked` set: a tile marked blocked is avoided; the goal tile is still reachable when it is in the set.
- Determinism: run the around-the-wall case 20 times and compare `JSON.stringify` of the results.
- `pathToWaypoints([{tx:1,ty:0},{tx:2,ty:0}], {x:70,y:20})` gives `[{x:48,y:16},{x:70,y:20}]`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test` — FAIL.

- [ ] **Step 3: Implement `path.ts`**

Keep the heap in the same file (under 60 lines); if it grows, split to `src/sim/heap.ts`.

- [ ] **Step 4: Run tests and guard**

Run: `npm test` then `npm run lint:sim` — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sim/path.ts tests/sim/path.test.ts
git commit -m "Add A* pathfinding on the tile grid"
```

---

### Task 5: Battle state, commands, and movement

**Files:**
- Create: `src/sim/battle.ts`, `src/sim/soldiers.ts`, `src/sim/commands.ts`, `src/sim/movement.ts`
- Test: `tests/sim/battle.test.ts`, `tests/sim/commands.test.ts`, `tests/sim/movement.test.ts`

**Interfaces:**

`src/sim/soldiers.ts`:
```ts
export function createSoldiers(map: TileMap): Soldier[];
// Ten soldiers: blue ids 0-4 then red ids 5-9, each side in CLASS_ORDER, placed on map.spawns[side][i],
// names from SQUAD_NAMES, hp MAX_HP, status 'standing', order hold, facing toward the other side
// (blue faceX 1, red faceX -1), cooldown 0, targetId null, firing false, stuckTicks 0, lastRepathTick -1.
export function standingCount(state: BattleState, side: Side): number;
export function soldierById(state: BattleState, id: number): Soldier | undefined;
export function isActive(s: Soldier): boolean;  // status === 'standing'
```

`src/sim/commands.ts`:
```ts
/** Apply one command. Silently ignores anything invalid: wrong side, unknown id, non-standing soldier. */
export function applyCommand(state: BattleState, cmd: Command): void;
```
Semantics: `select` sets `state.sides[side].selected` to the ids that belong to that side (any status). `move` snaps the target point to the nearest open tile when the tile is blocked (keep the exact point when open), sets `order = {kind:'move', x, y}`, computes the path with `findPath` + `pathToWaypoints(path, dest)`, resets `stuckTicks`, sets `lastRepathTick = state.tick`. If no path exists the order becomes hold. `attack` requires the target to exist, be on the other side, and be standing; sets `order = {kind:'attack', targetId}` and clears `path` (the movement phase plans toward the target). `hold` sets `order = {kind:'hold'}` and clears `path`. `medic` is implemented in Task 10; until then it is ignored.

`src/sim/movement.ts`:
```ts
/** Advance every standing soldier along its order for one tick, then separate overlaps and push out of cover and map bounds. */
export function moveSoldiers(state: BattleState, canFireAt: (s: Soldier, target: Soldier) => boolean): void;
```
Per standing soldier, in id order:
- `prevX/prevY = x/y`.
- Attack order: target lookup; if the target is not standing, order becomes hold and path clears. Else if `canFireAt(s, target)` the soldier stops (path cleared) and faces the target. Else, when `path.length === 0` or `state.tick - lastRepathTick >= REPATH_TICKS`, re-plan from the soldier's tile to the target's tile (`findPath`, waypoints with `dest` = target position).
- Move order with a path: step toward `path[0]` by `MOVE_SPEED`; when within `WAYPOINT_EPSILON` after the step (or the step overshoots), land on it and shift the path. When the path empties, order becomes hold. Update `faceX/faceY` to the movement direction when it is non-zero.
- Stuck handling: if the soldier had a path and moved less than `STUCK_EPSILON`, `stuckTicks++`; at `STUCK_TICKS`, when the order is `move` and the destination is within `ARRIVE_SLACK`, the soldier counts as arrived (order hold, path cleared; this is what happens when two soldiers are sent to one point); otherwise re-plan with `blocked` = tiles of other standing soldiers (not the goal tile); if null, order becomes hold; reset `stuckTicks` either way.
Then separation, over ordered pairs `i < j` of standing soldiers: if `dist2 < (2 * SOLDIER_RADIUS)^2`, push each half the overlap apart along the centre line (if the centres coincide, push along `DIRECTIONS16[(i + j) % 16]`). Then each standing soldier: if `circleOverlapsCover`, push out of the deepest-penetrating tile along the axis of least penetration (nearest-point rule), repeat up to 3 times; finally clamp to the map rectangle inset by `SOLDIER_RADIUS`.

`src/sim/battle.ts`:
```ts
export interface BattleOptions { seed: number; map?: TileMap }
export function createBattle(options: BattleOptions): BattleState;   // map defaults to CROSSROADS
export function step(state: BattleState, commands: readonly Command[]): void;
```
`createBattle`: `tick 0`, `rng = createRng(seed)`, `sides` with `MEDIC_CALLS` and empty selection, `winner null`, `nextProjectileId 0`, `events []`. `step`: if `winner !== null` return (frozen). Clear `events`; apply each command whose `tick === state.tick` in the given order (others are ignored); run the phases in this order, calling into the modules that exist yet and leaving labelled `// phase:` lines for the rest: orders+movement (`moveSoldiers`), firing (Task 7), projectiles (Task 7), flame (Task 9), medics (Task 10), win check (Task 6); `tick++`. In this task `canFireAt` is a stub returning false so attack orders approach.

- [ ] **Step 1: Write the failing tests**

`tests/sim/battle.test.ts`:
- `createBattle({seed: 1})` has 10 soldiers, ids 0..9, five per side in `CLASS_ORDER`, placed on the Crossroads spawns, all standing at `MAX_HP`, `tick 0`, `winner null`, each side `MEDIC_CALLS` calls.
- `step` with no commands increments `tick`, and `prevX/prevY` equal `x/y` for idle soldiers.
- A command tagged with a different tick is ignored (soldier order stays hold).
- Two states with the same seed, stepped 100 times with the same commands, are `JSON.stringify`-equal.

`tests/sim/commands.test.ts`:
- `select` records ids of own side only; `move` sets order and a non-empty path toward an open point; `move` onto a wall tile snaps to an open tile; `attack` on an enemy sets the order and on a friendly is ignored; `hold` clears; commands from the wrong side for a soldier are ignored; a downed soldier (set status by hand) ignores `move`.

`tests/sim/movement.test.ts`:
- A soldier given `move` to a point 64 units right along open ground arrives within 25 ticks (64 / 3.2 = 20) and ends with order hold at the exact point.
- A soldier ordered through a wall arrives at the far side after walking around (position within 2 units of the destination; never inside cover on any tick: assert `!circleOverlapsCover` each tick).
- Two soldiers ordered to the same point end at least `2 * SOLDIER_RADIUS - 0.01` apart.
- An attack order on a far enemy moves the soldier closer each tick (distance decreases) while `canFireAt` is false.
- Soldiers never leave the map rectangle.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test` — FAIL.

- [ ] **Step 3: Implement the four files**

Keep each under 250 lines. The `canFireAt` callback lets Task 7 supply weapon rules without `movement.ts` importing weapons.

- [ ] **Step 4: Run tests and guard**

Run: `npm test` then `npm run lint:sim` — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sim/battle.ts src/sim/soldiers.ts src/sim/commands.ts src/sim/movement.ts tests/sim/battle.test.ts tests/sim/commands.test.ts tests/sim/movement.test.ts
git commit -m "Add battle state, command application, and soldier movement"
```

---

### Task 6: Damage, downed, instant kill, and the win condition

**Files:**
- Create: `src/sim/damage.ts`, `src/sim/victory.ts`
- Modify: `src/sim/battle.ts` (win check phase)
- Test: `tests/sim/damage.test.ts`, `tests/sim/victory.test.ts`

**Interfaces:**
```ts
// damage.ts
/** Apply damage from `weapon` to a soldier. Downed and dead soldiers ignore it. Emits damage/downed/killed events. */
export function applyDamage(state: BattleState, target: Soldier, amount: number, weapon: SoldierClass): void;
/** Splash from a point: every standing soldier within radius, both sides, except `excludeId`, in id order. */
export function applySplash(state: BattleState, x: number, y: number, radius: number, amount: number, weapon: SoldierClass, excludeId: number | null): void;

// victory.ts
/** Sets state.winner when a side has no standing soldiers; 'draw' when neither does. Emits a victory event once. */
export function checkVictory(state: BattleState): void;
```
`applyDamage`: `hp = Math.max(0, hp - amount)`; if `hp === 0`: when `WEAPONS[weapon].instantKill && state.rng.chance(INSTANT_KILL_CHANCE)` status becomes `dead`, else `downed`; in both cases `order = hold`, `path = []`, `targetId = null`, `firing = false`. The rng is consulted only when a hit downs a soldier with an instant-kill weapon, in that order, so the stream is stable. Splash uses squared distance against `radius * radius` (centre inside radius counts; soldier radius is not added).

- [ ] **Step 1: Write the failing tests**

`tests/sim/damage.test.ts`:
- Gunner damage reduces hp; at 0 the soldier is downed, never dead, over 200 seeds.
- Launcher damage that would down the soldier produces `dead` for some seeds and `downed` for others across seeds 0..199, with the dead fraction between 0.03 and 0.2.
- A downed soldier takes no further damage (hp stays 0, status unchanged, no event).
- Splash hits both sides within radius, skips `excludeId`, skips a soldier just outside the radius, and applies in ascending id order (check event order).
- `applyDamage` emits a `damage` event, then `downed` or `killed`.

`tests/sim/victory.test.ts`:
- All red downed: winner blue, one `victory` event; calling again adds no event.
- Mixed downed and dead counts the same; one standing red keeps winner null.
- Both sides at zero: `'draw'`.
- Through `step`: after a win, further `step` calls do not change `tick`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test` — FAIL.

- [ ] **Step 3: Implement and wire `checkVictory` into `step` as the last phase before `tick++`**

- [ ] **Step 4: Run tests and guard**

Run: `npm test` then `npm run lint:sim` — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sim/damage.ts src/sim/victory.ts src/sim/battle.ts tests/sim/damage.test.ts tests/sim/victory.test.ts
git commit -m "Add damage, downed and instant-kill outcomes, and the win check"
```

---

### Task 7: Targeting and direct-fire weapons (Gunner, Launcher)

**Files:**
- Create: `src/sim/targeting.ts`, `src/sim/weapons.ts`, `src/sim/projectiles.ts`
- Modify: `src/sim/battle.ts` (firing and projectile phases; pass the real `canFireAt` to `moveSoldiers`)
- Test: `tests/sim/targeting.test.ts`, `tests/sim/weapons.test.ts`, `tests/sim/projectiles.test.ts`

**Interfaces:**
```ts
// targeting.ts
export function inRange(s: Soldier, target: Soldier): boolean;            // dist2 <= range^2
/** In range, and for direct/flame weapons also in line of sight. Target must be standing and on the other side. */
export function canFireAt(state: BattleState, s: Soldier, target: Soldier): boolean;
/** Attack-order target when fireable, else the nearest fireable enemy by squared distance (ties: lower id), else null. */
export function chooseTarget(state: BattleState, s: Soldier): Soldier | null;

// weapons.ts
/** Firing phase for one tick: every standing soldier in id order. */
export function fireWeapons(state: BattleState): void;
/** Aim point = target position + DIRECTIONS16[rng.int(16)] * (rng.next() * spread). Exposed for tests. */
export function scatterAim(state: BattleState, target: Soldier, spread: number): Vec2;

// projectiles.ts
/** Advance every projectile one tick in array order, resolving impacts, removing finished ones. */
export function advanceProjectiles(state: BattleState): void;
```
`fireWeapons` per soldier: `targetId = null; firing = false`; skip when `cooldown > 0` after decrementing it (`cooldown = Math.max(0, cooldown - 1)` first, then test). Skip when `!FIRE_WHILE_MOVING && order.kind === 'move'`. `t = chooseTarget`; if null continue. Face the target. By shot kind:
- `direct`: aim = `scatterAim`; direction = `normalize(aim - s)`; push a `Projectile` with `vx/vy = dir * speed`, `maxDistance = range + TILE_SIZE`, `travelled 0`, `landTick -1`, start at the soldier's position; `cooldown = WEAPONS.cooldown`; event `shot`. Gunner only: if `rng.chance(GUNNER_JAM_CHANCE)` then `cooldown = GUNNER_JAM_TICKS` and event `jam`. Rng order per shot: `int(16)`, `next()`, then the jam roll.
- `lobbed`: Task 8. `flame`: Task 9. Both are no-ops now (leave the branches with `// Task 8` / `// Task 9` comments).
- Set `targetId = t.id`, `firing = true`.

`advanceProjectiles`, direct kind: `prev = pos; next = pos + v`. Find the earliest hit along the segment: `tCover = firstCoverHit(map, prev, next)`; for each standing soldier of the other side, segment-versus-circle with radius `SOLDIER_RADIUS` giving the smallest `t` of entry (a soldier already overlapping the start point counts as `t = 0`); choose the smallest `t` overall, soldier before cover on exact ties. On a soldier hit: impact point at `t`; `applyDamage(target, damage, weapon)`; if `splashRadius > 0`, `applySplash(point, splashRadius, splashDamage, weapon, excludeId = target.id)`; event `impact`; remove. On a cover hit: event `impact` at the entry point with the splash (if any, `excludeId null`); remove. Otherwise move, `travelled += speed`; remove when `travelled >= maxDistance` or the position leaves the map rectangle. Lobbed kind: Task 8.

`battle.ts` phases become: commands, `moveSoldiers(state, (s, t) => canFireAt(state, s, t))`, `fireWeapons`, `advanceProjectiles`, flame (Task 9), medics (Task 10), `checkVictory`, `tick++`.

- [ ] **Step 1: Write the failing tests**

`tests/sim/targeting.test.ts`: `inRange` at exactly range is true and one unit beyond is false; `canFireAt` false across a wall for a gunner and true for a chucker (lobbed ignores cover); `chooseTarget` prefers the attack-order target when fireable, else the nearest fireable enemy, lower id on ties; downed enemies are never chosen.

`tests/sim/weapons.test.ts` (build a state with `createBattle`, then place soldiers by hand and set `status: 'downed'` on the ones to keep out of the way):
- A gunner with an enemy 100 units away and clear sight produces a projectile on tick 1 with `weapon 'gunner'`, speed `16` (`vx*vx + vy*vy` within `1e-9` of 256), and a `shot` event; the next shot comes exactly `cooldown` ticks later when no jam occurs (choose a seed and assert from observed events that no `jam` event occurred, or set `GUNNER_JAM_CHANCE`-independent expectations by checking `cooldown` right after the shot is either `WEAPONS.gunner.cooldown` or `GUNNER_JAM_TICKS`).
- Over 2000 gunner shots across seeds, at least one `jam` event occurs and jammed soldiers show `cooldown === GUNNER_JAM_TICKS` right after the shot.
- `scatterAim` with spread 0 returns the target position; with spread 14 every result lies within 14 units of the target over 100 draws.
- No target in range: no projectile, `firing false`.
- A soldier with `FIRE_WHILE_MOVING` true fires while it has a move order (if the constant is true at test time; guard the test with the constant).

`tests/sim/projectiles.test.ts`:
- A direct projectile aimed straight at an enemy 100 units away hits within 7 ticks, deals `damage`, emits `impact`, and is removed.
- A bullet stops at a wall between shooter and target: the target's hp is unchanged and the impact event's x is within 1 unit of the wall's near edge.
- No tunneling: a soldier placed so the bullet's per-tick segment straddles it (centre 8 units past the segment midpoint) is still hit.
- Friendlies on the line are passed through (a friendly between shooter and enemy takes no damage and the enemy is hit).
- A launcher rocket hitting an enemy applies `damage` to it and `splashDamage` to another soldier (either side) within `splashRadius`, not to one outside it.
- A projectile that reaches `maxDistance` without hitting is removed without an impact event.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test` — FAIL.

- [ ] **Step 3: Implement the three files and wire them into `step`**

Segment-versus-circle: with `d = next - prev`, `f = prev - c`, solve `|f + t d|^2 = r^2` for the smallest `t` in `[0, 1]` using the quadratic formula with `Math.sqrt` only; when `|f|^2 <= r^2` return `t = 0`; when the discriminant is negative, no hit.

- [ ] **Step 4: Run tests and guard**

Run: `npm test` then `npm run lint:sim` — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sim/targeting.ts src/sim/weapons.ts src/sim/projectiles.ts src/sim/battle.ts tests/sim/targeting.test.ts tests/sim/weapons.test.ts tests/sim/projectiles.test.ts
git commit -m "Add targeting, direct-fire weapons, and projectile flight"
```

---

### Task 8: Lobbed weapons (Chucker, Blaster)

**Files:**
- Modify: `src/sim/weapons.ts`, `src/sim/projectiles.ts`
- Test: `tests/sim/lobbed.test.ts`

**Behaviour:** In `fireWeapons`, the `lobbed` branch pushes a `Projectile` with `kind 'lobbed'`, `targetX/targetY` = `scatterAim(target, spread)`, `startX/startY` = shooter position, `x/y` = start, `vx/vy 0`, `launchTick = state.tick`, `landTick = state.tick + flightTicks`, `travelled 0`, `maxDistance 0`; `cooldown = WEAPONS.cooldown`; event `shot`. In `advanceProjectiles`, a lobbed projectile each tick sets `prevX/prevY` and moves `x/y` linearly along start to target by `(tick - launchTick) / flightTicks` (the renderer adds the arc); when `state.tick >= landTick` it lands: event `impact` at the target point with `splashRadius`, `applySplash(target, splashRadius, splashDamage, weapon, null)`, removed. Cover is never consulted. Lobbed shots need range only (`canFireAt` already allows this).

- [ ] **Step 1: Write the failing tests**

- A chucker with an enemy behind a wall at 150 units fires (a `lobbed` projectile appears) even though `hasLineOfSight` is false.
- The projectile lands exactly `flightTicks` ticks after launch (`landTick - launchTick`), emits one `impact`, and damages every standing soldier within `splashRadius` of the landing point on both sides, including a friendly, and not a downed one.
- With spread 0 (temporarily place the target so scatter cannot matter: assert the landing point is within `spread` of the target's position at launch).
- A blaster kill: over seeds 0..199 a blaster landing on a soldier at 1 hp produces some `killed` and some `downed` events (instant kill applies to lobbed Blaster hits); a chucker landing on a soldier at 1 hp never kills.
- Mid-flight position is between start and target (`x` strictly between the two for a horizontal throw on the middle tick).

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test` — FAIL (no projectile is created).

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run tests and guard**

Run: `npm test` then `npm run lint:sim` — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sim/weapons.ts src/sim/projectiles.ts tests/sim/lobbed.test.ts
git commit -m "Add lobbed grenades and dynamite"
```

---

### Task 9: Flame cone (Scorcher)

**Files:**
- Create: `src/sim/flame.ts`
- Modify: `src/sim/weapons.ts` (flame branch sets facing, `firing`, `targetId`; creates no projectile), `src/sim/battle.ts` (flame phase after projectiles)
- Test: `tests/sim/flame.test.ts`

**Interfaces:**
```ts
/** Each standing scorcher with `firing` true damages every standing soldier (both sides, not itself) within range, inside the cone, and in line of sight. */
export function applyFlame(state: BattleState): void;
/** Exposed for tests: in the cone when dist2 <= range^2 and dot(face, toTarget) >= FLAME_CONE_COS * |toTarget|. */
export function inCone(s: Soldier, x: number, y: number, range: number): boolean;
```
Damage per tick is `WEAPONS.scorcher.damage` per soldier in the cone, through `applyDamage(target, damage, 'scorcher')` in id order, so a flame tick that downs a soldier rolls the instant kill. `firing` for the scorcher is set in `fireWeapons` whenever `chooseTarget` returns a target (no cooldown).

- [ ] **Step 1: Write the failing tests**

- `inCone`: a point straight ahead at half range is in; at range plus one unit is out; a point 45° off axis at half range is out (cone half angle is 30°); a point 20° off axis is in (use a precomputed point like `(0.9396926, 0.3420201) * 40` written as literals).
- A scorcher facing an enemy at 60 units damages it by exactly `damage` per tick over 10 ticks (hp drops by `10 * damage`), and a friendly standing inside the cone also takes damage.
- A soldier behind cover inside the cone takes no damage.
- A downed soldier in the cone takes no damage.
- A scorcher with no target in range has `firing false` and deals no damage.
- Over seeds 0..199, a scorcher finishing a 1 hp enemy produces some `killed` events.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test` — FAIL.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run tests and guard**

Run: `npm test` then `npm run lint:sim` — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sim/flame.ts src/sim/weapons.ts src/sim/battle.ts tests/sim/flame.test.ts
git commit -m "Add the Scorcher flame cone"
```

---

### Task 10: Medic calls

**Files:**
- Create: `src/sim/medic.ts`
- Modify: `src/sim/commands.ts` (`medic` command), `src/sim/battle.ts` (medic phase after flame)
- Test: `tests/sim/medic.test.ts`

**Interfaces:**
```ts
/** Validate and accept a medic command: own side, target downed, calls remaining, no run already heading to that target. */
export function callMedic(state: BattleState, side: Side, targetId: number): boolean;
/** Advance every medic run by MEDIC_SPEED toward its target; on arrival revive at floor(MAX_HP * REVIVE_FRACTION). */
export function advanceMedics(state: BattleState): void;
```
`callMedic` decrements `medicCalls`, pushes `MedicRun` starting at `x = SOLDIER_RADIUS` for blue or `mapWidthUnits - SOLDIER_RADIUS` for red, `y = target.y`, emits `medic`. `advanceMedics` in array order: `prev = pos`; if within `MEDIC_SPEED` of the target, revive: `hp = Math.floor(MAX_HP * REVIVE_FRACTION)`, `status 'standing'`, `order hold`, `path []`, `cooldown 0`, `stuckTicks 0`, event `revived`, remove the run; else move straight toward the target by `MEDIC_SPEED` (cover ignored). If the target is no longer downed (cannot happen in v1, but be safe) the run is dropped.

- [ ] **Step 1: Write the failing tests**

- A valid medic command spends one call, creates a run at the correct edge, and emits `medic`.
- Invalid cases spend nothing and create no run: target standing; target on the other side; zero calls left; a second call for the same downed target while a run is under way.
- The medic reaches a body 300 units from the edge in about `300 / MEDIC_SPEED` ticks (assert revived by `ceil(300 / 6) + 2` ticks and not before `floor(300 / 6) - 2`).
- Revived soldier: hp 50, standing, hold order; event `revived`.
- Victory still goes to the other side when a side's last standing soldier falls while a medic is en route (step once more after the last soldier is downed: `winner` is set).
- Through `step` with a `medic` command in the command list.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test` — FAIL.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run tests and guard**

Run: `npm test` then `npm run lint:sim` — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sim/medic.ts src/sim/commands.ts src/sim/battle.ts tests/sim/medic.test.ts
git commit -m "Add medic calls and revives"
```

---

### Task 11: State hash and the computer opponent

**Files:**
- Create: `src/sim/hash.ts`, `src/sim/ai.ts`
- Test: `tests/sim/hash.test.ts`, `tests/sim/ai.test.ts`

**Interfaces:**
```ts
// hash.ts
/** 32-bit FNV-1a over the UTF-16 code units of JSON.stringify(state), as an unsigned integer. */
export function hashState(state: BattleState): number;
export function serializeState(state: BattleState): string;   // the JSON used by hashState

// ai.ts
export interface Controller { readonly side: Side; think(state: BattleState): Command[] }
/** Deterministic opponent: own rng from createRng((seed ^ AI_SEED_SALT[side]) >>> 0); acts every AI_THINK_TICKS. */
export function createAi(side: Side, seed: number): Controller;
```
`hashState`: `h = 0x811c9dc5; for each code unit c: h ^= c; h = Math.imul(h, 0x01000193); return h >>> 0`.

`think(state)`: returns `[]` unless `state.tick % AI_THINK_TICKS === 0` and `state.winner === null`. Otherwise, for each standing soldier of its side in id order, with `enemies` = standing enemies (if none, nothing):
1. `nearest` = nearest enemy by squared distance (lower id on ties).
2. Chucker and Blaster prefer a target behind cover: among enemies within `2 * range`, the nearest one for which `hasLineOfSight` from the soldier is false; else `nearest`. Call it `target`.
3. If `canFireAt(state, s, target)`: desired order is `attack target`.
4. Else if the class is Scorcher: desired order is `attack target` (charge).
5. Else search tiles in the bounding box of `target`'s position plus `range` for the best firing position: skip blocked tiles and tiles holding another standing soldier; require `dist2(centre, target) <= (range * AI_RANGE_FRACTION)^2`; direct weapons require `hasLineOfSight(centre, target)`. Score = `AI_COVER_BONUS` if any of the four orthogonal neighbours is cover, plus for the Launcher `AI_LAUNCHER_DISTANCE_WEIGHT * sqrt(dist2(centre, target)) / range`, minus for everyone `AI_TRAVEL_WEIGHT * sqrt(dist2(centre, s)) / range`, plus `rng.next() * AI_JITTER`. Desired order is `move` to the best tile's centre; if no tile qualifies, `attack target`.
6. Emit the command only when it differs from the soldier's current order (`move` differs when the destination tile differs; `attack` when the target id differs; a soldier whose order is already `hold` but who should attack gets the command).
Then medic: if `medicCalls > 0`, the downed friendlies without a run under way, ordered by `AI_REVIVE_PRIORITY` then id; the first whose body has no standing enemy within that enemy's weapon range gets a `medic` command (one per think). Rng calls happen only in step 5 (one `next()` per candidate tile, in scan order), so the stream is a function of state.

All commands carry `tick: state.tick` and `side`.

- [ ] **Step 1: Write the failing tests**

`tests/sim/hash.test.ts`: the same state hashes equal; changing one soldier's `x` by 1 changes the hash; the hash is an integer in `[0, 2^32)`; `serializeState` does not contain `"rng"` with function bodies (it is `{}` or absent) and does contain `"tick"`.

`tests/sim/ai.test.ts`:
- `think` on a tick that is not a multiple of `AI_THINK_TICKS` returns `[]`.
- On tick 0 of a fresh battle, the red AI returns at least one command per standing red soldier, all with `side 'red'` and `tick 0`, and no command touches a blue soldier.
- Two AIs with the same seed given `JSON`-equal states return `JSON`-equal commands; different seeds may differ (do not assert that they do).
- A soldier already holding the desired attack order gets no new command on the next think.
- Medic: with a red soldier downed and no blue soldier within range of the body, the AI issues `medic` for it; with a blue gunner 50 units from the body, it does not.
- A scorcher far from every enemy gets an `attack` command (charges), a launcher 50 units from an enemy gets a `move` command whose destination is farther from that enemy than the launcher is now (or, if no tile qualifies, an `attack`); assert one of the two and, for `move`, the distance property.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test` — FAIL.

- [ ] **Step 3: Implement**

Keep `ai.ts` under 300 lines; split tile scoring into `src/sim/aiPositions.ts` if needed.

- [ ] **Step 4: Run tests and guard**

Run: `npm test` then `npm run lint:sim` — PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sim/hash.ts src/sim/ai.ts tests/sim/hash.test.ts tests/sim/ai.test.ts
git commit -m "Add the state hash and the deterministic computer opponent"
```

---

### Task 12: Headless runner, replay determinism test, public API, and docs

**Files:**
- Create: `src/sim/headless.ts`, `src/sim/index.ts`
- Modify: `docs/decisions.md`, `README.md` (one paragraph: how to run the sim headless in Vitest), `CLAUDE.md` (Plans section: Plan 2 done, link)
- Test: `tests/sim/replay.test.ts`

**Interfaces:**
```ts
// headless.ts
export interface RunOptions { seed: number; maxTicks: number; controllers: Controller[]; map?: TileMap }
export interface RunResult { state: BattleState; log: Command[]; ticks: number }
/** Create a battle, and each tick collect every controller's commands (in controller order), append them to the log, and step. Stops at a winner or maxTicks. */
export function runBattle(options: RunOptions): RunResult;
/** Create a battle from the seed and feed only the log, grouped by tick, for `ticks` ticks. Never calls a controller. */
export function replayBattle(seed: number, log: readonly Command[], ticks: number, map?: TileMap): BattleState;

// index.ts re-exports the public surface Plan 3 consumes:
export { createBattle, step } from './battle';
export { createAi } from './ai';
export type { Controller } from './ai';
export { hashState, serializeState } from './hash';
export { runBattle, replayBattle } from './headless';
export { CROSSROADS } from './maps/crossroads';
export { parseMap, worldToTile, tileCenter, isBlocked, mapWidthUnits, mapHeightUnits } from './map';
export { hasLineOfSight } from './los';
export { createRng } from './rng';
export * from './constants';
export type * from './types';
```

- [ ] **Step 1: Write the failing replay test**

`tests/sim/replay.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { createAi } from '../../src/sim/ai';
import { hashState, serializeState } from '../../src/sim/hash';
import { replayBattle, runBattle } from '../../src/sim/headless';
import { TICK_RATE } from '../../src/sim/constants';

const MAX_TICKS = TICK_RATE * 600; // ten minutes of battle, far more than any seed needs

describe('replay determinism', () => {
  for (const seed of [1, 7, 42, 2026]) {
    it(`AI-vs-AI battle from seed ${seed} ends and replays bit for bit`, () => {
      const run = runBattle({ seed, maxTicks: MAX_TICKS, controllers: [createAi('blue', seed), createAi('red', seed)] });
      expect(run.state.winner).not.toBeNull();
      expect(run.ticks).toBeLessThan(MAX_TICKS);
      const replayed = replayBattle(seed, run.log, run.ticks);
      expect(hashState(replayed)).toBe(hashState(run.state));
      expect(serializeState(replayed)).toBe(serializeState(run.state));
    });
  }
  it('a different seed gives a different battle', () => {
    const a = runBattle({ seed: 1, maxTicks: MAX_TICKS, controllers: [createAi('blue', 1), createAi('red', 1)] });
    const b = runBattle({ seed: 2, maxTicks: MAX_TICKS, controllers: [createAi('blue', 2), createAi('red', 2)] });
    expect(hashState(a.state)).not.toBe(hashState(b.state));
  });
  it('a tampered log gives a different final state', () => {
    const run = runBattle({ seed: 42, maxTicks: MAX_TICKS, controllers: [createAi('blue', 42), createAi('red', 42)] });
    let drop = run.log.findIndex((c) => c.type === 'move');
    if (drop < 0) drop = run.log.findIndex((c) => c.type !== 'select');
    expect(drop).toBeGreaterThanOrEqual(0);
    const log = run.log.filter((_, i) => i !== drop);
    const replayed = replayBattle(42, log, run.ticks);
    expect(hashState(replayed)).not.toBe(hashState(run.state));
  });
});
```
Also assert in the first case that `run.log.length` is below `run.ticks` (the AI dedups orders) and that both sides issued at least one command.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test` — FAIL, `headless` module not found.

- [ ] **Step 3: Implement `headless.ts` and `index.ts`; run the test**

If a seed does not end within `MAX_TICKS`, do not raise the limit: inspect the final state (who is standing, their orders, positions) and fix the stall in the AI or movement, then record the fix in `docs/decisions.md`. Report the tick counts of the four battles in the PR description.

- [ ] **Step 4: Document**

`docs/decisions.md`: append one dated (2026-11-02) line per item in "Decisions this plan makes" above, in the same terse style as the existing lines, plus any decision made during implementation. Do not edit existing lines. `README.md`: add a short "Headless simulation" paragraph showing `runBattle` and `replayBattle` in a Vitest test. `CLAUDE.md` Plans section: note that Plan 2 is implemented and link this plan.

- [ ] **Step 5: Full check and commit**

Run: `npm run check`
Expected: typecheck, lint:sim, all tests (including `replay determinism › AI-vs-AI battle from seed ... ends and replays bit for bit`), and build succeed.
```bash
git add src/sim/headless.ts src/sim/index.ts tests/sim/replay.test.ts docs/decisions.md README.md CLAUDE.md
git commit -m "Add headless runner, replay determinism test, public API, and decisions"
```

- [ ] **Step 6: Whole-branch review, then the pull request**

A fresh reviewer reads the whole diff against `main` with the Review Focus list above and CLAUDE.md. Fix findings in follow-up commits. Then push and open a non-draft pull request against `main` titled "Plan 2: headless simulation". The description: the public API with exact signatures (`BattleState`, `Command`, `createBattle`, `step`, `createAi`, `runBattle`, `replayBattle`, `hashState`), deviations from this plan and from the spec with reasons, the four battle lengths in ticks, and the final `npm run check` output including the replay test name. Do not merge.

---

## Self-review

- Spec coverage: 4.1 map, tiles, cover, world-coordinate movement with tile pathfinding, no overlap (Tasks 2, 4, 5). 4.2 classes, stat relationships, same speed and HP, friendly fire on splash and flame only (Tasks 1, 7, 8, 9). 4.3 commands `select`/`move`/`attack`/`hold`/`medic`, hold-by-default, auto-fire decision (Tasks 5, 10, decision 5). 4.4 direct projectiles stopping at cover or enemy, lobbed as timed arrival with splash, flame cone per tick, downed at 0, instant kill 10% for Launcher/Scorcher/Blaster, dead removed from play (Tasks 6 to 9). 4.5 downed cannot act or be targeted, 3 medic calls, medic travels from own edge, 50% revive, win when none standing (Tasks 6, 10). 4.6 same command queue, state machine per soldier, cover preference, lobbers prefer covered targets, Launcher distance, Scorcher charge, medic when safe, cadence (Task 11). 4.7 flow is Plan 3. Section 5: split, fixed ticks, commands with tick tags, seeded rng, arithmetic ban, deterministic AI, downed immune, no time limit, constants file, headless, replay test (all tasks, Task 12).
- Placeholders: none. Every task names its files, signatures, and tests. Task 5 leaves labelled phase hooks that later tasks fill, which is sequencing, not a gap.
- Type consistency: `Order`, `Command`, `Projectile`, `MedicRun`, `BattleEvent` are defined once in Task 1 and used unchanged in Tasks 5 to 12. `canFireAt` is passed into `moveSoldiers` as a callback from Task 5 on and implemented in Task 7. `Controller` is defined in Task 11 and consumed in Task 12.
- Task count: 12, under the 14-task threshold, so one pull request.
