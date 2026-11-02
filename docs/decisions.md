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
