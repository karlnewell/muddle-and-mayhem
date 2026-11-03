# Muddle & Mayhem

A small real-time squad-tactics game for the browser. Five soldiers per side,
each with a different weapon, directed from above until one squad is wiped
out. Written in plain TypeScript on HTML Canvas with no game engine, built
with Claude Code as a learning project.

**Play it:** https://karlnewell.github.io/muddle-and-mayhem/

![A paused battle on Compact Crossroads, with the squad's cards in the side panel](docs/screenshots/battle.png)

## How to play

You are General Muddle (blue, left). The computer is General Mayhem (red,
right). Each side has five soldiers, one per class: Gunner, Launcher,
Chucker, Scorcher, Blaster. Last squad standing wins.

The battlefield is **Compact Crossroads**: 26 by 15 tiles, the whole field
on one screen, two roads crossing between four wall arms, with crates and
trees for cover and the squads starting 23 tiles apart. Beside it, on your
side, a side panel holds your five soldier cards (name, class, HP and
status, in slot order), both sides' medic calls, the pause status and the
build. The top bar shows the clock and how many soldiers each side has
standing.

The battle starts **paused** so you can give the first orders. Press Space
to let it run; press Space again whenever you want to think. Orders given
while paused are taken at once and shown as faint markers.

| Input | What it does |
|---|---|
| Left click a blue soldier | Select it (Shift adds to the selection) |
| Left drag a box on the battlefield | Select every blue soldier inside it, downed ones too (Shift adds); a box with nobody inside clears the selection. Works while paused |
| Keys 1 to 5, or click a soldier card in the side panel | Select by slot (Shift adds) |
| S | Select the whole squad, so the next right click moves or attacks with everyone |
| Right click the ground | Move the selected soldiers there |
| Right click an enemy | Attack it: move into range, fire until it drops, then hold |
| Right click a downed friend | Call the medic (three calls per side, back at half health) |
| A | Volley: every standing soldier, selected or not, fires at the enemy nearest the cursor from where it stands; out of range, it fires at the nearest enemy it can hit and never moves. Lines from each soldier to the target and a VOLLEY flash show the order for about half a second, paused or not |
| H | Hold position and fire at anything in range |
| M | Call the medic for a selected downed soldier |
| Space | Pause and resume |
| Esc | Menu: resume, restart, back to the title, game speed, and a reminder of the keys |
| Left / Right arrows | On the title screen or in the menu, step the game speed between 0.5x, 0.75x and 1x |

Walls, crates and trees block movement and straight shots. Grenades and
dynamite go over them. Rockets, flame and dynamite can kill outright; a
killed soldier leaves ash and no medic can help.

The game runs at **half speed** by default. Pick 0.5x, 0.75x or 1x with
the Game speed selector on the title screen or in the Esc menu (click a
segment, or use the Left and Right arrow keys); the choice applies at once
and is remembered in this browser. The battle is exactly the same at any
speed, only slower on screen. A SPEED badge in the top bar shows whenever
the speed is not 0.5x, and the copied report always lists it. Add
`?speed=0.5`, `0.75` or `1` to the URL to override the remembered choice
for that visit; any other value falls back to it (or to half speed) and
the debug overlay says why.

Add `?seed=123` to the URL to replay the same battle. The page exposes
`window.__mm` with the seed, tick, command log and state, so a bug report
can carry everything needed to reproduce a battle.

The build the page came from (package version, short commit and UTC build
date, for example `0.0.0+b11b13d 2026-11-03`) shows small in the
bottom-right corner of the title screen and at the foot of the side panel, and as
`window.__mm.build`, so a playtest can say exactly what it ran on.

Press D during a battle for a debug overlay listing every soldier's HP,
status, order and cooldown, with the seed, tick, state hash and build; add
`?debug=1` to the URL to start with it showing.

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (the game lives at `/muddle-and-mayhem/`).

## Test

```bash
npm run check
```

That runs the type check, the simulation arithmetic guard, the unit tests,
and the production build. The browser tests (a smoke test and one that
plays a few seconds of a battle) need a build first:

```bash
npm run build
npm run test:e2e
```

If your Playwright has no browser of its own, point it at one with
`PW_CHROMIUM_PATH=/path/to/chromium`.

## Tuning

Balance changes are measured, not guessed, and the tools below make one
play session cheap enough to count as a measurement.

**Try values in the browser.** Add `tune=` to the URL with a JSON object of
constant overrides, the same shape `npm run measure` accepts. Scalars go by
name; weapon fields are merged per class:

```
https://karlnewell.github.io/muddle-and-mayhem/?seed=7&tune={"WEAPONS":{"launcher":{"cooldown":180}}}
```

The values apply before the battle exists and stay for Play again and
Restart. A yellow **TUNED** badge sits in the top bar whenever any override
is active, so a screenshot is never mistaken for shipped balance. The debug
overlay (`D`) prints the overrides, or the error if the JSON was rejected;
a rejected `tune=` starts the battle with shipped balance rather than
failing. The names it accepts are the tunables in `src/sim/constants.ts`.

**Read the report.** The result screen shows a table per side and class:
shots, hits, hit rate, damage dealt and taken, downs inflicted, times
downed, instant kills, seconds spent downed and medic calls used. **Copy
report** puts a Markdown block on the clipboard with that table, the seed,
the build, the map, the overrides, the speed and the full command log, ready to paste into an issue;
anyone can replay the battle from it with the `replayBattle` call it names
(reports from before the map changed have no `Map:` line and ran on
Crossroads: `replayBattle(seed, log, ticks, MAPS.crossroads)`). When the clipboard is unavailable the
text appears in a box you can select by hand. `window.__mm.report()`
returns the same text and `window.__mm.stats` the raw numbers.

**Measure the same change headless.** `npm run measure` runs sixty
computer-versus-computer battles and prints battle length, time to first
damage, downs, medic use, the winner split and the same per-class numbers
the browser report shows. Pass the same JSON:

```bash
npm run measure -- '{"WEAPONS":{"launcher":{"cooldown":180}}}'
```

`--seeds=N`, `--first-seed=N` and `--cap=SECONDS` widen the run;
`--map=compact` (the default, the map the game plays) or `--map=crossroads`
(the larger map before Plan 7) picks the battlefield.
`--blue=passive` plays a blue squad that never moves; `--blue=holdline` a
scripted squad that walks to cover by the left wall gap, holds, focuses
fire on the enemy most of the squad can see, calls medics when a body is
not under fire and advances only when it outnumbers the enemy; it has its
own posts on each map. On Crossroads under the shipped balance, over 180
seeds, the computer wins 55% against itself,
100% against the passive squad and 72% against the hold-line squad (100%
before Plan 6 moved its posts beside the wall arms, made cover soak splash
and had the computer's lobbers wait for contact), which is a result about
static defence as much as about balance. On Compact Crossroads, the map
the game plays, over 180 seeds a blue computer squad wins 47% against the red one, and red wins 100%
against the passive squad and 71% against the hold-line squad.

**The loop, one change at a time.**

1. Write down the hypothesis: which constant, which direction, what you
   expect to see in the report.
2. Open the game with `?tune=` carrying that one change and play two or
   three battles. Copy each report into the issue.
3. Run `npm run measure` with the same JSON over 60 or more seeds, with
   `--blue=ai` and `--blue=holdline`, and compare against a run without
   the override.
4. If the numbers agree with the hypothesis, change the constant in
   `src/sim/constants.ts` in a pull request whose decision line in
   `docs/decisions.md` carries the before and after numbers.

## Headless simulation

The whole battle runs without a browser. `runBattle` drives it with
controllers and records every command; `replayBattle` rebuilds it from the
seed and that log alone (pass the map as a fourth argument, for example
`MAPS.crossroads`, for a battle that did not run on the default map). Same
seed plus same log gives the same state, bit
for bit, which is what `tests/sim/replay.test.ts` asserts under `npm test`.
`state.events` holds only the current tick's events and is cleared at the
start of every `step`, so a caller that runs several steps per frame must
drain them after each step:

```ts
import { expect, it } from 'vitest';
import { createAi, hashState, replayBattle, runBattle } from '../../src/sim';

it('replays bit for bit', () => {
  const seed = 42;
  const run = runBattle({ seed, maxTicks: 18000, controllers: [createAi('blue', seed), createAi('red', seed)] });
  const replayed = replayBattle(seed, run.log, run.ticks);
  expect(hashState(replayed)).toBe(hashState(run.state));
});
```

## Code layout

- `src/sim/` the rules: deterministic, headless, no browser, no clock, no `Math.random`.
- `src/game/` the clock, the battle session, the command log, the seed, the debug hook.
- `src/render/` the top-down renderer behind a small `BattleRenderer` interface.
- `src/input/` mouse and keyboard to `Command` objects.
- `src/ui/` the HUD, title, menu and result screens, all drawn on the canvas.
- `src/main.ts` wires them together.

## Repository setup (owner, one time)

These cannot be done from a cloud session.

1. **Pages:** Settings → Pages → Build and deployment → Source → **GitHub Actions**.
   The `deploy` workflow publishes `dist/` on every push to `main`.
2. **Branch protection:** Settings → Branches → add a rule for `main` that
   requires the **`ci`** status check to pass before merging.
3. **Claude on PRs:** install the Claude GitHub App on this repository and add
   a repository secret named `CLAUDE_CODE_OAUTH_TOKEN`. Until then the
   `claude` workflow ships but does nothing. After that, `@claude` in a PR
   or issue comment asks it to review or fix.

## Project rules

See `CLAUDE.md` for the architecture and working rules, `docs/decisions.md`
for the decision log and roadmap, and `docs/superpowers/specs/` for the design.

## Credit and license

Inspired by the squad-tactics genre of the early 1990s. All code, art, and
names are original. Source is MIT licensed; see `LICENSE`.
