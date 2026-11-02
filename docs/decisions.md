# Decisions

One dated line per decision. Newest at the bottom. The roadmap lives at the end.

- 2026-11-01: Web game in TypeScript on HTML Canvas 2D with Vite, Vitest, and Playwright. No game engine, no UI framework. Reason: the owner wants to follow every line.
- 2026-11-01: Hosted on GitHub, not GitLab, because Claude Code cloud sessions require it. GitHub Pages serves the build.
- 2026-11-01: Top-down renderer for v1, with the simulation/renderer split so an isometric renderer can replace it later without touching rules.
- 2026-11-01: Inspired by the early-1990s squad-skirmish genre, not a recreation. Simplify freely; borrow no names, art, sound, or text.
- 2026-11-01: v1 features: one skirmish on one hand-made map, five classes with distinct weapons, cover, pause-to-order, downed soldiers and medics, rare instant kills, win/lose screen.
- 2026-11-01: Pause is a single-player affordance, default on, and will be disabled in future versus play.
- 2026-11-01: Repository is public. On GitHub's free plan, Pages hosting, branch protection with required checks, and unlimited Actions minutes are public-only.
- 2026-11-01: Name is Muddle & Mayhem; repo and package `muddle-and-mayhem`. The rival generals are General Muddle (player, blue) and General Mayhem (computer, red).
- 2026-11-01: Simulation arithmetic is limited to `+ - * /`, `Math.sqrt`, `Math.floor`, `Math.abs`, `Math.min`, `Math.max`, `Math.imul`, integer bit operators, and comparisons, so a Mac browser and a Windows browser compute identical battles. `npm run lint:sim` enforces it.
- 2026-11-01: The computer opponent is deterministic: a pure function of simulation state and its own seeded stream, issuing commands through the same command log as the player, so replays reproduce its decisions.
- 2026-11-01: Downed soldiers take no damage from splash or flame, and there is no battle time limit; the AI always advances so battles end.
- 2026-11-01: Friendly fire applies to splash and flame only (grenade, dynamite, rocket splash, flame cone). Direct bullets and rocket bodies pass through friendlies.
- 2026-11-01: Each side has 3 medic calls per battle, fixed. A revived soldier returns at 50% HP. The medic cannot be shot in v1.
- 2026-11-01: Launcher, Scorcher, and Blaster hits that would down a soldier roll a 10% instant-kill chance to start; tune by play.
- 2026-11-02: The sim arithmetic guard also flags `document`, `window`, and imports from `render`, `input`, or `ui`, since the spec bans them alongside the math and the check is free.
- 2026-11-02: Vite runs with `appType: 'mpa'` so `vite preview` returns 404 outside the base path, like Pages. Without it the smoke test passed with a wrong base path.
- 2026-11-02: The arithmetic guard is an allowlist: any `Math` member other than `sqrt`, `floor`, `abs`, `min`, `max`, `imul` is flagged, so newly added or overlooked functions (`asinh`, `round`) cannot slip through.
- 2026-11-02: The ban on the original game's names applies to code, assets, UI text, README, and CLAUDE.md. The design spec and plans under `docs/superpowers/` may name it, since they document what we are deliberately not copying.
- 2026-11-02: Tick rate 30 Hz, tile 32 world units. Crossroads is 40 by 22 tiles (1280 by 704 units), mirror-symmetric left to right.
- 2026-11-02: HP 100, move speed 3.2 units per tick (3 tiles per second), soldier collision radius 12.
- 2026-11-02: Commands carry explicit soldier ids. `select` is a real command that records the side's selection in state so replays show it, but orders never read it; the input layer fills `soldierIds` from the selection.
- 2026-11-02: `step` mutates the state in place. Soldiers, projectiles, and medics keep `prevX`/`prevY` from the previous tick so the renderer can interpolate.
- 2026-11-02: Soldiers auto-fire at enemies in range while moving or holding (`FIRE_WHILE_MOVING = true`). Plan 3's playtest may flip the constant.
- 2026-11-02: Attack order: approach until the target is in range (and in line of sight for direct and flame weapons), then stop and fire; when the target is downed or dead the order becomes hold.
- 2026-11-02: Downed and dead soldiers do not block movement and are never hit or targeted. Dead soldiers stay in the array with status `dead` and their position so the renderer can draw ash.
- 2026-11-02: Splash is full damage to every standing soldier within the radius, both sides, no falloff. A direct projectile deals its direct damage to the soldier it hits and splash damage to everyone else in radius.
- 2026-11-02: Direct projectiles stop at the first cover tile or standing enemy on their path and vanish at maximum range without detonating.
- 2026-11-02: Lobbed shots are a timed arrival: on the landing tick, a splash check at the landing point regardless of cover.
- 2026-11-02: Flame is a cone check each tick: in range, inside the cone (dot product against a precomputed cosine), and in line of sight. Continuous damage per tick, no cooldown.
- 2026-11-02: Instant kill: a Launcher, Scorcher, or Blaster hit that would down a soldier rolls `INSTANT_KILL_CHANCE` (0.1) on the battle stream; success sets status `dead`.
- 2026-11-02: Gunner jam: each shot rolls `GUNNER_JAM_CHANCE`; on a jam the cooldown becomes `GUNNER_JAM_TICKS`.
- 2026-11-02: Aim scatter: every direct and lobbed shot offsets its aim point by a random direction from the 16-entry unit-vector table and a random distance up to the weapon's `spread`.
- 2026-11-02: The medic is abstract: it appears at its side's map edge level with the body, travels in a straight line at `MEDIC_SPEED` ignoring cover, and cannot be hit. The call is spent when the command is accepted.
- 2026-11-02: Win is checked at the end of every tick; a side with zero standing soldiers loses. Both at zero on the same tick is a draw (`winner: 'draw'`).
- 2026-11-02: A move to a blocked tile snaps to the nearest open tile (ring search). A soldier that makes no progress for `STUCK_TICKS` counts as arrived when its destination is within `ARRIVE_SLACK`, otherwise re-plans with other standing soldiers' tiles treated as blocked, and holds if that fails.
- 2026-11-02: State hash is 32-bit FNV-1a over the UTF-16 code units of `JSON.stringify(state)`. ECMAScript specifies number-to-string conversion, so the hash is engine-independent; the rng's functions are skipped.
- 2026-11-02: The computer opponent lives in `src/sim/ai.ts` (not `src/ai/`) so the arithmetic guard covers it. It thinks every `AI_THINK_TICKS` (15) and issues a command only when it would change a soldier's order, so logs stay small.
- 2026-11-02: Soldier names are five original names per side in `constants.ts`: blue Pip, Bert, Maud, Fitz, Dot; red Grub, Nell, Otto, Sal, Wick.
- 2026-11-02: `%` is treated as outside the sim allowlist; sim code uses `imod(a, b) = a - floor(a / b) * b` from `vec.ts`.
- 2026-11-02: Line of sight recomputes tile-crossing parameters from the grid edge at each step instead of accumulating them, so exact-corner ties compare equal and sight lines never cut corners; verified symmetric over every tile-centre pair on Crossroads.
- 2026-11-02: Stuck detection measures the previous tick's net displacement after separation and cover push-out, not the raw path step, so a soldier shoved back counts as stuck; the first tick of a new order is skipped.
- 2026-11-02: Cover push-out adds a 1e-6 margin so the overlap predicate is reliably false after a push.
- 2026-11-02: The map edge counts as cover for projectiles: a round heading off the map resolves as a cover hit at the border, with splash for rockets, rather than vanishing.
- 2026-11-02: On an exact tie between a soldier hit and a cover hit, the soldier takes the hit.
- 2026-11-02: A `damage` event records the amount requested, not the hp actually removed.
- 2026-11-02: The AI's cover bonus counts only real cover tiles, not the map edge, so Launchers are not drawn to the border.
- 2026-11-02: Battle lengths with the starting constants are 10 to 22 seconds of game time (about 300 to 650 ticks); tuning is Plan 3 playtest territory.
- 2026-11-02: The rng's 32-bit state now serialises into the hash via a `JSON.stringify` replacer, replacing the earlier "rng is skipped" behaviour; this closes the gap where two states differing only in rng position hashed equal.
- 2026-11-02: Direct rounds fly one tile (`TILE_SIZE`) past their weapon's range before vanishing, so a target that steps back at max range can still be hit.
- 2026-11-02: A medic arriving on the very tick the last standing soldier falls keeps that side in the fight, because the medic phase runs before the win check.
- 2026-11-02: `replayBattle` requires the log in ascending tick order and throws otherwise.
- 2026-11-02: Lobbers search for a covered target within `AI_LOBBER_TARGET_REACH` (2) times their range.

## Roadmap

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
