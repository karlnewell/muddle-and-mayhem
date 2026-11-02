# Muddle & Mayhem — Design

**Date:** 2026-11-01
**Status:** Draft, awaiting owner approval
**Inspired by:** General Chaos (Game Refuge / EA, 1993). Inspired by, not a recreation. Simplify freely.

## 1. Intent and why

A small real-time squad tactics game built in the browser. Two reasons it exists, in order:

1. **Learn vibe coding end to end.** The owner (Python background, new to TypeScript and game dev) wants to experience building a complete game with Claude Code, including the cloud-session and pull-request workflow, not just watch code appear.
2. **Recapture the squad feel of General Chaos.** Five soldiers with different weapons, directed from above, until one squad is wiped out. Play it solo, then eventually against the owner's brother over the internet.

Success for v1: the owner can open a URL on their Mac, play one skirmish against the computer with mouse and keyboard, and it is fun enough to play a second time. The brother can open the same URL on Windows and do the same.

## 2. Goals, non-goals, anti-goals

### Goals (v1)
- One playable skirmish: five player soldiers vs five computer soldiers on one hand-made map, win/lose screen.
- The five classes feel different because their weapons behave differently.
- Cover matters: walls block direct shots, grenades and dynamite go over them.
- Pause to give orders (single-player only, default on, toggleable).
- Downed soldiers and a scarce medic resource.
- Rare instant kills that leave ash instead of a body.
- Runs on Mac and Windows in a current Chrome, Edge, Firefox, or Safari. Nothing to install.
- Every rule lives in a deterministic simulation that can run headless and be replayed from a command log.

### Non-goals (v1, all on the roadmap)
Sound, terrain effects (water, destructible cover), close-combat mini-game, bonus crates and score, squad selection screen, gamepad, campaign map, commando squad, remote multiplayer, isometric rendering, real art.

### Anti-goals (would make this a failure even if it works)
- Copying the original's name, characters, country names, sprites, sounds, or music. See section 8.
- A codebase the owner cannot follow. Plain TypeScript, few files per concern, no engine magic.
- A simulation that depends on the renderer, wall-clock time, or `Math.random()`. That forecloses multiplayer and headless testing.
- Scope creep before the skirmish is fun. Roadmap items wait.

## 3. Constraints

- **Platform:** web, TypeScript, HTML Canvas 2D, no game engine. Vite for dev server and build. Vitest for unit tests. Playwright for browser smoke tests.
- **Hosting:** GitHub repository (required for Claude Code cloud sessions). GitHub Pages serves the built game from the main branch via GitHub Actions.
- **Workflow:** feature work happens in Claude Code cloud sessions and lands as pull requests; the owner pulls branches locally to playtest and uses the Claude Code VS Code extension for small fixes. Every PR must pass tests in CI before merge.
- **Input, v1:** mouse and keyboard only.
- **Licensing:** all assets original or openly licensed (CC0 / CC-BY / OFL); source MIT.

## 4. The game, as decided

### 4.1 The battlefield
- Top-down view of a rectangular field, roughly 16:9, fully visible at once. No scrolling, no fog of war.
- The map is a tile grid (builder picks tile size; 32 px world units per tile is a reasonable default). Tiles are open ground or cover. Cover blocks movement and direct-fire shots. Lobbed shots pass over cover.
- v1 ships one hand-authored map ("Crossroads" in the mockup): open ground, a few wall segments, some clusters of crates/sandbags, trees. Squads start on opposite sides.
- Soldiers move freely in world coordinates (not tile-snapped) but pathfind on the tile grid. Soldiers cannot overlap each other or cover.

### 4.2 Squads and classes
Fixed squads in v1: each side has one of each class. Stats are starting points for the builder to tune; the relationships (which is longest range, which fires fastest) are the design.

| Class | Weapon | Shot type | Range | Fire rate | Damage | Notes |
|---|---|---|---|---|---|---|
| Gunner | Submachine gun | Direct, hitscan-ish burst | Medium | Fastest of direct weapons | Low per bullet | Workhorse. Can briefly jam (short random cooldown spike). |
| Launcher | Rocket | Direct projectile, travels | Longest | Slow | High, small splash | Blocked by cover. Can instant-kill. |
| Chucker | Grenade | Lobbed, lands at target point | Medium | Low | Medium, splash | Goes over cover. Easy to dodge (visible travel time). |
| Scorcher | Flamethrower | Cone, continuous while firing | Shortest | Continuous | Medium per second | Hits everything in cone. Can instant-kill. |
| Blaster | Dynamite | Lobbed, lands at target point | Second shortest | Slowest | Highest, small splash | Goes over cover. Can instant-kill. |

- Every soldier has the same move speed and health (builder tunes; 100 HP is fine).
- Friendly fire: **on**, for splash and flame only (grenade, dynamite, rocket splash, flame cone). Direct bullets and rocket bodies pass through friendly soldiers. Reason: it rewards positioning and punishes careless lobbing without making the Gunner useless in a crowd.

### 4.3 Orders and control
- Left click a friendly soldier to select it. Number keys 1-5 also select. Shift-click adds to selection (group orders are a nicety; builder may defer to roadmap if it complicates v1).
- Right click on ground: **move** there. Right click on an enemy: **attack** it (move into range if needed, then fire until it's down, then hold). Right click on a downed friendly: **medic** (see 4.5). `H`: hold position and fire at anything in range. Soldiers with no order default to hold behaviour.
- Soldiers auto-fire at enemies in range and line of sight while moving or holding, unless the builder finds this makes the player irrelevant; in that case movement suppresses fire and only hold/attack shoot. Builder's call after playtest, record it.
- Space toggles **pause**. While paused, the simulation does not advance, but selection and orders are accepted and queued. Pause is a single-player affordance and will be disabled in future versus mode.
- Escape opens a minimal menu: resume, restart, back to title.

### 4.4 Combat resolution
- Direct shots travel as projectiles with a position each tick and stop at the first cover tile or enemy soldier hit. Gunner bullets may be treated as fast projectiles rather than true hitscan to keep everything in the same code path.
- Lobbed shots follow a parabola in render only; in the simulation they are a timed arrival at the target point, then a splash radius check.
- Flame is a cone check each tick while the Scorcher holds a target in range.
- Damage reduces HP. At 0 HP the soldier is **downed** (see 4.5), unless the hit rolls an **instant kill**.
- Instant kill: Launcher, Scorcher, and Blaster hits that would down a soldier roll a small chance (builder starts at 10%) to kill outright. A killed soldier is removed, an ash/scorch mark is drawn, and no medic can bring them back.

### 4.5 Downed soldiers and medics
- A downed soldier lies where they fell, cannot act, and cannot be targeted. They count as out of the fight.
- Each side starts with 3 medic calls. Right-clicking a downed friendly (or pressing `M` with one selected) spends one call: a medic runs from the player's edge of the map to the body (visible, takes a few seconds), then the soldier gets up at 50% HP. The medic cannot be shot in v1.
- When a side has zero soldiers standing, the other side wins immediately, even if medic calls remain.
- Score and bonus crates (which in the original buy extra medic calls) are on the roadmap, so medic calls are fixed at 3 per battle in v1.

### 4.6 Computer opponent
- The AI issues the same commands a player would, through the same command queue. It has no information a player lacks (the whole map is visible anyway).
- Behaviour per soldier, a simple state machine: pick the nearest enemy; if in range with line of sight, hold and fire; otherwise move toward a tile within range that has line of sight, preferring tiles adjacent to cover; Chucker and Blaster prefer targets behind cover since they can lob. Launcher keeps distance. Scorcher charges. Medic use: revive the most valuable downed soldier when no enemy is within range of the body.
- The AI thinks on a cadence (every N ticks), not every tick, so it is beatable and cheap.
- Difficulty tuning is a roadmap item; v1 has one level.

### 4.7 Flow
1. **Title** screen: game name, the two generals (placeholder portraits), "Skirmish" button, controls summary.
2. **Battle** on the one map.
3. **Result** screen: who won, soldiers remaining, time, "Play again" and "Title".

### 4.8 Look
- Placeholder art in v1: soldiers are circles in team colour (blue player, red enemy) with a class letter; cover is grey/brown blocks; projectiles are dots, lines, and a cone. Health arc or bar over each soldier. Selected soldier has a dashed ring; a dashed path shows its destination; a reticle marks an attack target. Downed soldiers draw as a flattened ellipse with a medic prompt.
- HUD along the bottom: five soldier cards with name, class, HP bar, weapon cooldown bar, and hotkey number; a side panel with medic calls remaining and the pause state. Top bar with timer and enemies remaining.
- Readability over beauty. Real art and an isometric renderer are roadmap items; see section 5 for the architectural rule that makes the swap possible.

## 5. Architecture, as decided

These are design decisions because they protect the multiplayer and testing goals. The builder owns everything below them.

- **Simulation / renderer split.** The simulation lives in world coordinates and never imports from the renderer or touches the DOM, canvas, time, or `Math.random()`. The renderer reads simulation state and draws it. Input handlers translate clicks into world coordinates and into **commands**. Swapping top-down for isometric later means replacing the renderer and the screen-to-world projection only.
- **Fixed timestep.** The simulation advances in fixed ticks (builder picks; 30 or 60 Hz). The render loop interpolates between ticks for smooth motion. Pause stops ticks.
- **Commands, not mutations.** Every player and AI action is a command object (`select`, `move`, `attack`, `hold`, `medic`) tagged with the tick it applies to. The simulation consumes a command list per tick. This is what lockstep multiplayer needs later, and it gives us replays for free.
- **Seeded randomness.** One seeded PRNG inside the simulation, seeded per battle. Same seed plus same command log equals the same battle, bit for bit. A test asserts this.
- **Cross-engine safe arithmetic** (my call, prompted by the builder check). Future versus play means a Mac browser and a Windows browser must compute identical results. IEEE 754 add, subtract, multiply, divide, and `Math.sqrt` are identical across JavaScript engines; `Math.sin`, `cos`, `atan2`, `pow`, `exp`, and friends are not guaranteed to be. So the simulation uses plain numbers but **only** `+ - * / Math.sqrt Math.floor Math.abs Math.min Math.max` and comparisons. Distances use squared comparisons where possible. Anything needing an angle (flame cone, facing) uses dot products or a small precomputed table of unit vectors. Fixed-point integers are not required. A lint rule or a grep in CI enforces the ban inside `src/sim/`.
- **AI is part of the deterministic world.** The computer opponent is a pure function of simulation state plus its own PRNG stream derived from the battle seed. Its commands go through the same command log as the player's, so a replay reproduces the AI's decisions too.
- **Downed soldiers take no damage** from splash or flame, and there is no battle time limit; the AI always advances, so battles end.
- **All tunables in one file** (`src/sim/constants.ts`) so the owner can tune between pull requests without touching logic.
- **Headless.** The simulation runs in Node under Vitest with no browser. Unit tests cover combat math, line of sight, pathfinding, downed/medic rules, win conditions, and determinism (replay a recorded command log, compare final state hash).
- **Browser smoke test.** One Playwright test loads the built game, starts a skirmish, issues a few commands, and asserts the canvas changed and no console errors fired. Runs in CI.
- **Project layout** (builder may adjust): `src/sim/` (rules, no browser imports), `src/render/`, `src/input/`, `src/ai/`, `src/ui/` (title, HUD, result), `src/maps/`, `tests/`. Files small, one concern each.

## 6. Repository and workflow setup

Part of v1 scope, because it is half the point of the project.

- GitHub repo (private is fine), MIT license, `.gitignore` covering `node_modules`, `dist`, `.superpowers/`.
- `CLAUDE.md` at the root: how to run, test, and build; the sim/renderer rule; the determinism rule; the licensing rule; the decision-log convention; "small PRs, tests pass before merge."
- `docs/decisions.md`: running log, one dated entry per decision, including the ones in this document. Also holds the **roadmap** (section 7) so nothing gets lost.
- GitHub Actions: on every PR, install, type-check, Vitest, build, Playwright smoke test. On merge to `main`, build and deploy to GitHub Pages.
- Claude GitHub Action installed so `@claude` mentions on PRs and issues can review or fix. **Owner step:** installing the GitHub App and adding the Claude Code OAuth token or API key as a repository secret cannot be done from a cloud session. If the owner has not done it by the time the scaffold PR merges, the workflow file still ships and simply does nothing until the secret exists.
- **Repository visibility:** see section 10. On GitHub's free plan, Pages hosting, branch protection with required status checks, and unlimited Actions minutes are available only on public repositories. A private repository on the free plan cannot meet the "open a URL" success criterion.
- Vite config with the right `base` path for GitHub Pages.

## 7. Roadmap (everything not in v1, nothing dropped)

Rough order, owner may reorder. Each is a separate design conversation when its turn comes.

1. Sound effects (synthesized or openly licensed).
2. Bonus crates and score, with score buying extra medic calls.
3. Terrain effects: water disables the Scorcher; destructible cover.
4. Squad selection screen (choose your five, duplicates allowed).
5. Gamepad support (cursor on stick; Xbox controllers via the Gamepad API).
6. Close-combat mini-game when soldiers touch (punch/kick/block).
7. AI difficulty levels.
8. Real art: original pixel sprites, then an isometric renderer swap.
9. Remote two-player versus over the internet (lockstep on the deterministic sim; pause disabled; relay or WebRTC).
10. Campaign map, battle by battle toward the enemy capital.
11. Commando squad (two directly controlled soldiers).
12. Title screen art: portraits of General Muddle and General Mayhem.

## 8. Legal rules

Not legal advice; these are the project's rules.
- Never use the names "General Chaos", "General Havoc", "Moronica", "Viceria", or any character or place name from the original.
- No sprites, sounds, music, text, or code from the original or its manual. Generic class words (Gunner, Launcher, Chucker, Scorcher, Blaster) are ordinary words and fine.
- Mechanics are inspiration; expression is ours. The "two bumbling rival generals" premise is a stock comic setup and is the one deliberate wink at the original. No other names, places, lines, or jokes are borrowed.
- Hobby, non-commercial.

## 9. Left to the builder

- Exact numbers: tile size, tick rate, HP, speeds, ranges, damage, cooldowns, splash radii, instant-kill chance, medic travel time. Start from the table in 4.2 and tune by playing.
- Pathfinding algorithm (A* on the tile grid is the obvious choice) and how soldiers avoid each other.
- Whether moving soldiers auto-fire (4.3).
- Whether multi-select ships in v1.
- The one map's layout, beyond "open ground, some walls, some crate clusters, two start zones."
- Soldier names on the HUD cards (five per side, fun, original).
- Font and placeholder colours.
- Test organisation and CI details within the constraints in sections 5 and 6.

## 10. Open items for the owner

- ~~Working title~~ Decided 2026-11-01: **Muddle & Mayhem**. Repo and package `muddle-and-mayhem`. The two rival generals are General Muddle (player, blue) and General Mayhem (computer, red). Searched 2026-11-01: no existing game uses the name.
- Repository visibility: **public**, assumed on 2026-11-01 since the owner did not object. Reason: on the free plan, Pages hosting, branch protection, and unlimited CI minutes are public-only.
- Default pause on (as written) or off. Stays on unless the owner objects.
