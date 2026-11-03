import { describe, expect, it } from 'vitest';
import { createBattle, step } from '../../src/sim/battle';
import { applyCommand } from '../../src/sim/commands';
import {
  DIRECTIONS16, GUNNER_JAM_CHANCE, GUNNER_JAM_TICKS, CLASS_STATS,
  TILE_SIZE, WEAPONS, overrideTuning,
} from '../../src/sim/constants';
import { parseMap } from '../../src/sim/map';
import { createRng } from '../../src/sim/rng';
import type { BattleState, Soldier, TileMap } from '../../src/sim/types';
import { dist2, normalize } from '../../src/sim/vec';
import { fireWeapons, scatterAim } from '../../src/sim/weapons';

import type { SoldierClass } from '../../src/sim/types';
/** Full health of a soldier's class. */
const maxHp = (s: { cls: SoldierClass }): number => CLASS_STATS[s.cls].maxHp;

/** A cooldown no test runs long enough to exhaust: a muzzled soldier never fires. */
const NEVER_FIRES = 1_000_000_000;

/** A 30 by 10 arena: wall down column 15 on rows 0 to 6, open lanes on rows 7 and 8, spawns on row 9. */
function arena(): TileMap {
  const rows: string[] = [];
  for (let ty = 0; ty < 7; ty++) {
    rows.push('...............#..............');
  }
  rows.push('..............................');
  rows.push('..............................');
  rows.push('bbbbb...............rrrrr.....');
  return parseMap('Arena', rows);
}

function place(s: Soldier, x: number, y: number): void {
  s.x = x;
  s.y = y;
  s.prevX = x;
  s.prevY = y;
}

/** Every soldier except `keep` is downed so it plays no part. */
function isolate(state: BattleState, keep: readonly number[]): void {
  for (const s of state.soldiers) {
    if (!keep.includes(s.id)) {
      s.status = 'downed';
      s.hp = 0;
    }
  }
}

/**
 * Blue gunner 0 at (100, 256) and a muzzled red soldier `targetId` at
 * (100 + distance, 256) on the open lane, everyone else downed.
 */
function duel(seed: number, distance = 100, targetId = 5): BattleState {
  const state = createBattle({ seed, map: arena() });
  isolate(state, [0, targetId]);
  place(state.soldiers[0], 100, 256);
  place(state.soldiers[targetId], 100 + distance, 256);
  state.soldiers[targetId].cooldown = NEVER_FIRES;
  return state;
}

function shotEvents(state: BattleState, soldierId: number): number {
  return state.events.filter((e) => e.kind === 'shot' && e.soldierId === soldierId).length;
}

describe('fireWeapons', () => {
  it('fires a gunner round at an enemy 100 units away on the first tick', () => {
    const state = duel(1);
    const g = state.soldiers[0];
    step(state, []);
    expect(state.tick).toBe(1);
    expect(state.projectiles).toHaveLength(1);
    const p = state.projectiles[0];
    expect(p.kind).toBe('direct');
    expect(p.weapon).toBe('gunner');
    expect(p.side).toBe('blue');
    expect(p.ownerId).toBe(0);
    expect(p.vx * p.vx + p.vy * p.vy).toBeCloseTo(WEAPONS.gunner.speed * WEAPONS.gunner.speed, 9);
    expect(p.vx).toBeGreaterThan(0);
    expect(p.maxDistance).toBe(WEAPONS.gunner.range + TILE_SIZE);
    expect(p.landTick).toBe(-1);
    expect(p.startX).toBe(100);
    expect(p.startY).toBe(256);
    expect(p.launchTick).toBe(0);
    expect(state.events).toContainEqual({ kind: 'shot', soldierId: 0, weapon: 'gunner' });
    expect(g.targetId).toBe(5);
    expect(g.firing).toBe(true);
    expect(g.faceX).toBe(1);
    expect(g.faceY).toBe(0);
  });

  it('assigns projectile ids from nextProjectileId', () => {
    const state = duel(1);
    state.nextProjectileId = 7;
    step(state, []);
    expect(state.projectiles[0].id).toBe(7);
    expect(state.nextProjectileId).toBe(8);
  });

  it('fires again exactly cooldown ticks later (or the jam cooldown after a jam)', () => {
    const state = duel(3);
    const g = state.soldiers[0];
    step(state, []);
    expect(shotEvents(state, 0)).toBe(1);
    const jammed = state.events.some((e) => e.kind === 'jam');
    const gap = jammed ? GUNNER_JAM_TICKS : WEAPONS.gunner.cooldown;
    expect(g.cooldown).toBe(gap);
    for (let i = 1; i < gap; i++) {
      step(state, []);
      expect(shotEvents(state, 0)).toBe(0);
    }
    step(state, []);
    expect(shotEvents(state, 0)).toBe(1);
  });

  it('decrements the cooldown before testing it', () => {
    const state = duel(1);
    state.soldiers[0].cooldown = 3;
    step(state, []);
    expect(shotEvents(state, 0)).toBe(0);
    step(state, []);
    expect(shotEvents(state, 0)).toBe(0);
    step(state, []);
    expect(shotEvents(state, 0)).toBe(1);
  });

  it('consumes the rng as direction, distance, then the jam roll', () => {
    const seed = 11;
    const state = duel(seed);
    const g = state.soldiers[0];
    const t = state.soldiers[5];
    const ref = createRng(seed);
    const dir = DIRECTIONS16[ref.int(DIRECTIONS16.length)];
    const d = ref.next() * WEAPONS.gunner.spread;
    const aim = { x: t.x + dir.x * d, y: t.y + dir.y * d };
    const v = normalize(aim.x - g.x, aim.y - g.y);
    const jam = ref.chance(GUNNER_JAM_CHANCE);

    step(state, []);
    const p = state.projectiles[0];
    expect(p.vx).toBeCloseTo(v.x * WEAPONS.gunner.speed, 12);
    expect(p.vy).toBeCloseTo(v.y * WEAPONS.gunner.speed, 12);
    expect(p.targetX).toBeCloseTo(aim.x, 12);
    expect(p.targetY).toBeCloseTo(aim.y, 12);
    expect(g.cooldown).toBe(jam ? GUNNER_JAM_TICKS : WEAPONS.gunner.cooldown);
    expect(state.events.some((e) => e.kind === 'jam')).toBe(jam);
    // Nothing else touched the stream this tick (the round is still in flight).
    expect(state.rng.next()).toBe(ref.next());
  });

  it('jams sometimes over 2000 gunner shots, setting the jam cooldown', () => {
    let shots = 0;
    let jams = 0;
    for (let seed = 0; shots < 2000; seed++) {
      const state = duel(seed);
      const g = state.soldiers[0];
      for (let i = 0; i < 50 && shots < 2000; i++) {
        g.cooldown = 0;
        state.events = [];
        state.projectiles = [];
        fireWeapons(state);
        expect(shotEvents(state, 0)).toBe(1);
        shots++;
        if (state.events.some((e) => e.kind === 'jam' && e.soldierId === 0)) {
          jams++;
          expect(g.cooldown).toBe(GUNNER_JAM_TICKS);
        } else {
          expect(g.cooldown).toBe(WEAPONS.gunner.cooldown);
        }
      }
    }
    expect(jams).toBeGreaterThan(0);
    expect(jams).toBeLessThan(shots * GUNNER_JAM_CHANCE * 3);
  });

  it('never jams a launcher', () => {
    const state = createBattle({ seed: 5, map: arena() });
    isolate(state, [1, 5]);
    place(state.soldiers[1], 100, 256);
    place(state.soldiers[5], 300, 256);
    state.soldiers[5].cooldown = NEVER_FIRES;
    for (let i = 0; i < 300; i++) {
      state.soldiers[1].cooldown = 0;
      state.events = [];
      state.projectiles = [];
      fireWeapons(state);
      expect(state.events).toContainEqual({ kind: 'shot', soldierId: 1, weapon: 'launcher' });
      expect(state.events.some((e) => e.kind === 'jam')).toBe(false);
      expect(state.soldiers[1].cooldown).toBe(WEAPONS.launcher.cooldown);
      const p = state.projectiles[0];
      expect(p.weapon).toBe('launcher');
      expect(p.vx * p.vx + p.vy * p.vy).toBeCloseTo(WEAPONS.launcher.speed * WEAPONS.launcher.speed, 9);
      expect(p.maxDistance).toBe(WEAPONS.launcher.range + TILE_SIZE);
    }
  });

  it('creates no projectile and clears firing when no enemy is in range', () => {
    const state = duel(1, WEAPONS.gunner.range + 50);
    const g = state.soldiers[0];
    g.firing = true;
    g.targetId = 5;
    step(state, []);
    expect(state.projectiles).toHaveLength(0);
    expect(g.firing).toBe(false);
    expect(g.targetId).toBeNull();
    expect(state.events.some((e) => e.kind === 'shot')).toBe(false);
  });

  it('does not fire for downed or dead soldiers', () => {
    const state = duel(1);
    state.soldiers[0].status = 'downed';
    state.soldiers[0].hp = 0;
    state.soldiers[9].status = 'standing';
    state.soldiers[9].cooldown = NEVER_FIRES;
    place(state.soldiers[9], 800, 256);
    step(state, []);
    expect(state.projectiles).toHaveLength(0);
    expect(state.soldiers[0].firing).toBe(false);
  });

  it('faces the target it fires at', () => {
    const state = createBattle({ seed: 1, map: arena() });
    isolate(state, [0, 5]);
    place(state.soldiers[0], 300, 256);
    place(state.soldiers[5], 300, 136);
    state.soldiers[5].cooldown = NEVER_FIRES;
    fireWeapons(state);
    expect(state.soldiers[0].faceX).toBe(0);
    expect(state.soldiers[0].faceY).toBe(-1);
  });

  it('fires while carrying out a move order when its weapon may fire while moving, the default for every class', () => {
    for (const cls of Object.keys(WEAPONS) as (keyof typeof WEAPONS)[]) {
      expect(WEAPONS[cls].fireWhileMoving).toBe(true);
    }
    const state = duel(1);
    applyCommand(state, { tick: 0, side: 'blue', type: 'move', soldierIds: [0], x: 100, y: 230 });
    step(state, []);
    expect(state.soldiers[0].order.kind).toBe('move');
    expect(state.projectiles).toHaveLength(1);
    expect(state.events).toContainEqual({ kind: 'shot', soldierId: 0, weapon: 'gunner' });
  });

  it('holds fire while its path is non-empty when its weapon may not fire while moving', () => {
    overrideTuning({ WEAPONS: { gunner: { fireWhileMoving: false } } });
    try {
      const state = duel(1);
      applyCommand(state, { tick: 0, side: 'blue', type: 'move', soldierIds: [0], x: 100, y: 230 });
      step(state, []);
      expect(state.soldiers[0].order.kind).toBe('move');
      expect(state.soldiers[0].path.length).toBeGreaterThan(0);
      expect(state.projectiles).toHaveLength(0);
      expect(state.soldiers[0].firing).toBe(false);
    } finally {
      overrideTuning({ WEAPONS: { gunner: { fireWhileMoving: true } } });
    }
  });

  it('stops an attacking gunner inside range with clear sight and starts shooting', () => {
    const state = duel(2, 300);
    const g = state.soldiers[0];
    const t = state.soldiers[5];
    applyCommand(state, { tick: 0, side: 'blue', type: 'attack', soldierIds: [0], targetId: 5 });
    // Walk 76 units into range, then enough ticks for several rounds: at the Gunner's spread most miss.
    const budget = Math.ceil(76 / CLASS_STATS.gunner.speed) + 8 * WEAPONS.gunner.cooldown;
    let shots = 0;
    for (let i = 0; i < budget; i++) {
      step(state, []);
      shots += shotEvents(state, 0);
    }
    const d = Math.sqrt(dist2(g.x, g.y, t.x, t.y));
    expect(d).toBeLessThanOrEqual(WEAPONS.gunner.range);
    expect(d).toBeGreaterThan(WEAPONS.gunner.range - 2 * CLASS_STATS.gunner.speed);
    expect(g.order).toEqual({ kind: 'attack', targetId: 5 });
    expect(shots).toBeGreaterThan(0);
    expect(t.hp).toBeLessThan(maxHp(t));
  });
});

describe('scatterAim', () => {
  it('returns the target position with spread 0, still consuming two draws', () => {
    const state = createBattle({ seed: 4 });
    const ref = createRng(4);
    const t = state.soldiers[5];
    const aim = scatterAim(state, t, 0);
    expect(aim).toEqual({ x: t.x, y: t.y });
    ref.next();
    ref.next();
    expect(state.rng.next()).toBe(ref.next());
  });

  it('stays within the spread of the target over 100 draws, and does scatter', () => {
    const state = createBattle({ seed: 8 });
    const t = state.soldiers[5];
    const spread = WEAPONS.gunner.spread;
    let moved = 0;
    for (let i = 0; i < 100; i++) {
      const aim = scatterAim(state, t, spread);
      const d2 = dist2(aim.x, aim.y, t.x, t.y);
      expect(d2).toBeLessThanOrEqual(spread * spread + 1e-9);
      if (d2 > 1) {
        moved++;
      }
    }
    expect(moved).toBeGreaterThan(50);
  });
});
