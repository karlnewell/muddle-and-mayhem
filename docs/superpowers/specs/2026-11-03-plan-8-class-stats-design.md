# Plan 8: Per-class Health and Speed — Design

**Date:** 2026-11-03
**Status:** Approved by the owner in conversation (2026-11-03); this document writes that design up.
**Builds on:** `docs/superpowers/specs/2026-11-01-muddle-and-mayhem-design.md`, Plans 4 to 7; roadmap item 13 in `docs/decisions.md`.

## 1. Intent and why

In the owner's playtests the red Scorcher has decided most battles since Plan 4. Plan 6 tried the obvious levers and found they do nothing: slowing the Scorcher while it fires, or silencing it while it walks, changes no result, because it walks in silently, arrives with about half its health and then burns. Plan 6 named per-class health or speed (roadmap item 13) as the lever that is left. Plan 7's closing numbers still have the Scorcher as the top killer on Compact Crossroads (29% of enemy downs AI versus AI over seeds 1 to 60, 28% over seeds 61 to 180).

The owner also finds controlling individual soldiers hard. So the Scorcher must become **fragile, not fiddly**: strongest when it is held at a corner or a gap and the enemy comes to it, dead if it is caught in the open, with no extra steering asked of the player. Health and speed per class give that without a new rule: a Scorcher with less health dies on the walk in unless cover hides the walk, and a faster one spends less of that walk exposed.

Measured on Compact Crossroads today, seeds 1 to 60 (blue wins, median length, first damage, red downs per battle, share of enemy downs Gunner / Launcher / Chucker / Scorcher / Blaster): AI versus AI 24 (40%), 57.6 s, 4.8 s, 7, 13 / 25 / 20 / 29 / 14%; passive 0, 48.0 s; hold-line 17 (28%), 68.6 s. Seeds 61 to 180: AI versus AI 61 (51%), 58.7 s, 14 / 22 / 20 / 28 / 15%; hold-line 35 (29%). Those are the numbers Plan 8 is compared against.

## 2. Goals, non-goals

### Goals
- Each class has its own maximum health and its own walking speed, as data in `constants.ts`.
- The Scorcher becomes a fast glass cannon and stops deciding most battles; the Launcher becomes the slow, slightly fragile heavy weapon.
- `?tune=` and `npm run measure` can try per-class health and speed, so the owner can play a candidate before it ships.
- Battles stay inside the paced range Plans 4 and 7 set (section 6), measured, not guessed.

### Non-goals
- No other rule changes. The AI, the hold-line squad (`scripts/holdline.mts`), cover, medics and weapons are untouched.
- No per-class medic speed, revive fraction, soldier radius or vision.
- No new mechanic if the levers in section 7 cannot meet the targets; the work stops and says which target failed.
- Nothing about the owner pressing `A` repeatedly like a trigger, and nothing about selection (drag-box selection is its own work, roadmap item 14).

## 3. The table and its readers

A per-class table in `src/sim/constants.ts`, beside `WEAPONS`:

```ts
export interface ClassStats {
  maxHp: number;   // health a soldier of this class starts with
  speed: number;   // world units per tick on foot
}
export let CLASS_STATS: Readonly<Record<SoldierClass, Readonly<ClassStats>>>;
```

Values are absolute, not multipliers of a shared base. `CLASS_STATS` replaces `MAX_HP` and `MOVE_SPEED`; both names leave the code.

Exactly five places read the shared values today. Each switches to the soldier's class entry:

| Reader | Today | After |
|---|---|---|
| `src/sim/soldiers.ts` (`createSoldiers`) | starts every soldier at `MAX_HP` | starts each at `CLASS_STATS[cls].maxHp` |
| `src/sim/medic.ts` (`revive`) | `floor(MAX_HP * REVIVE_FRACTION)` | `floor(CLASS_STATS[cls].maxHp * REVIVE_FRACTION)`: the same fraction of the class's own maximum |
| `src/sim/movement.ts` (`followPath`) | `MOVE_SPEED`, times `FIRING_MOVE_FRACTION` on a tick after the weapon discharged | `CLASS_STATS[cls].speed`, times `FIRING_MOVE_FRACTION` likewise |
| `src/render/drawSoldiers.ts` | health bar `hp / MAX_HP` | health bar as a fraction of the class maximum |
| `src/ui/hud.ts` | card health bar `hp / MAX_HP` | card health bar as a fraction of the class maximum |

A full-health Scorcher and a full-health Gunner both show a full bar; the card's `HP n` text shows the absolute number, so the difference is still readable. The two health-bar readers share one function in the simulation's public surface so they cannot disagree.

`REVIVE_FRACTION` and `FIRING_MOVE_FRACTION` stay single values for every class.

## 4. Roles and starting values

| Class | Role | `maxHp` | `speed` |
|---|---|---|---|
| Gunner | reference | 160 | 1.8 |
| Launcher | the heavy weapon: slower and slightly fragile | 140 | 1.53 (15% slower) |
| Chucker | reference | 160 | 1.8 |
| Scorcher | a fast glass cannon | 100 | 2.07 (15% faster) |
| Blaster | unchanged: cut in Plan 7 and near the 10% floor | 160 | 1.8 |

With those, a Scorcher revives at 50 health, a Launcher at 70, the rest at 80.

The work ships in two steps (section 8): first the table with every class at today's values (160, 1.8), a pure refactor that changes no battle; then the starting values above.

## 5. Tuning overrides and the accepted break

`TuningOverrides` gains `CLASS_STATS?: Partial<Record<SoldierClass, Partial<ClassStats>>>`, merged per class exactly like `WEAPONS`: `{"CLASS_STATS":{"scorcher":{"maxHp":100}}}` changes one field of one class and leaves the rest. `validateTuning` checks it the same way it checks `WEAPONS`, and nothing is applied when any part is rejected:

- `CLASS_STATS` not an object, or a class entry not an object: rejected.
- An unknown class (`"medic"`): rejected.
- An unknown field (`"armour"`): rejected.
- A field of the wrong type (`"100"`): rejected.
- A non-finite number (`Infinity`, `NaN`, `null` after JSON): rejected.

`MAX_HP` and `MOVE_SPEED` leave `TunableName` and `TUNABLE_NAMES`, so `?tune={"MAX_HP":120}` is now rejected as an unknown tunable, like any typo. **Accepted break:** a report written before this change whose overrides named `MAX_HP` or `MOVE_SPEED` no longer applies them on replay. None of the owner's reports used overrides, so nothing in hand breaks.

The live-site link for the starting values (section 8), readable and URL-encoded:

```
https://karlnewell.github.io/muddle-and-mayhem/?seed=242832287&tune={"CLASS_STATS":{"scorcher":{"maxHp":100,"speed":2.07},"launcher":{"maxHp":140,"speed":1.53}}}
https://karlnewell.github.io/muddle-and-mayhem/?seed=242832287&tune=%7B%22CLASS_STATS%22%3A%7B%22scorcher%22%3A%7B%22maxHp%22%3A100%2C%22speed%22%3A2.07%7D%2C%22launcher%22%3A%7B%22maxHp%22%3A140%2C%22speed%22%3A1.53%7D%7D%7D
```

## 6. Targets

All with `npm run measure` on Compact Crossroads over seeds 1 to 60, and confirmed on seeds 61 to 180.

| Guard | Target |
|---|---|
| AI versus AI median battle length | 55 to 90 s of game time |
| AI versus AI median first damage | 3 to 6 s |
| Hold-line blue wins | 25 to 35% |
| Passive blue wins | 0% |
| Each class's share of enemy downs, AI versus AI | between 10% and 35% |
| The Scorcher's share of enemy downs, AI versus AI (new) | at most 22%, and not the top killer |

"Share of enemy downs" is a class's downs inflicted, both sides together, over all downs inflicted, as `npm run measure` prints them in its `downs by weapon total` line. "Not the top killer" means at least one other class has a strictly larger share.

## 7. Levers if the starting values miss

If any guard fails on the starting values, in this order, one measured change per pull request, each with a before-and-after table and a decision line:

1. Scorcher health.
2. Scorcher speed.
3. Launcher speed.
4. Launcher health.
5. Reload (`cooldown` in `WEAPONS`), only if the first four cannot meet the targets.

A lever is tried only for a guard that fails, and the next lever only when the one before cannot meet it. If a guard still fails after all five, the work stops and says which guard, rather than adding a new mechanic.

## 8. Order of work and the owner's play

1. **Spec and plan** (this document and its plan) in one pull request with a decision line.
2. **The table at today's values.** `CLASS_STATS` with every class at 160 and 1.8; the five readers switched; `MAX_HP` and `MOVE_SPEED` retired; `CLASS_STATS` accepted by `?tune=` and `npm run measure`; the README's Tuning section updated. Proof that it is a refactor: `npm run measure` for `--blue=ai`, `passive` and `holdline` over seeds 1 to 60 prints byte-identical output before and after. Its description carries the live-site link from section 5 and the same overrides measured headless as a preview against the targets.
3. **The owner plays.** After step 2 merges, the link runs on the live site; the owner plays it and pastes two or three reports.
4. **The starting values shipped** in `CLASS_STATS`, with the before-and-after table on both seed ranges against every guard and a decision line. The owner merges it after step 3.
5. **Levers**, only where a guard fails on step 4's numbers (section 7).
6. **Close.** A decision line in the last pull request with final numbers on both seed ranges, what was tried and rejected, and roadmap item 13 marked done.

## 9. Testing

- **Starting health:** with an override giving every class a different `maxHp`, each soldier of a new battle starts at its own class's `maxHp`.
- **Revive:** under the same override, a revived soldier of each class stands at `floor(maxHp * REVIVE_FRACTION)` of its own class.
- **Speed:** with an override giving every class a different `speed`, one tick of `followPath` moves each class by its own speed; with `FIRING_MOVE_FRACTION` 0.5 and the weapon having discharged, by half its own speed.
- **Health bars:** the shared health-fraction function returns `hp / maxHp` of the soldier's class, clamped to 0 to 1, and both the battlefield bar and the HUD card bar call it.
- **Overrides:** `validateTuning` and `overrideTuning` accept a `CLASS_STATS` entry and merge it per class; reject a non-object, an unknown class, an unknown field, a wrong type and a non-finite value, each with nothing applied; reject `MAX_HP` and `MOVE_SPEED` as unknown tunables; `?tune=` reads the same.
- **Determinism and replay:** the existing determinism, replay and hash tests stay green unchanged.
- **No-op proof:** the byte-identical `npm run measure` comparison in step 2.
- **End to end:** the Playwright tests stay green; a `?tune=` link carrying `CLASS_STATS` shows the TUNED badge.
