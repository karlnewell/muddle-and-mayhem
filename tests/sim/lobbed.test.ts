import { describe, expect, it } from 'vitest';
import { createBattle, step } from '../../src/sim/battle';
import { DIRECTIONS16, MAX_HP, WEAPONS } from '../../src/sim/constants';
import { hasLineOfSight } from '../../src/sim/los';
import { parseMap } from '../../src/sim/map';
import { createRng } from '../../src/sim/rng';
import type { BattleEvent, BattleState, Soldier, TileMap } from '../../src/sim/types';
import { dist2 } from '../../src/sim/vec';

/** A cooldown no test runs long enough to exhaust: a muzzled soldier never fires. */
const NEVER_FIRES = 1_000_000_000;

/** A 30 by 10 arena: wall down column 15 on rows 0 to 6 (x in [480, 512)), open lanes on rows 7 and 8, spawns on row 9. */
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

/** A standing soldier that never fires and never moves: a bystander for splash tests. */
function bystander(state: BattleState, id: number, x: number, y: number): Soldier {
  const s = state.soldiers[id];
  s.status = 'standing';
  s.hp = MAX_HP;
  s.cooldown = NEVER_FIRES;
  place(s, x, y);
  return s;
}

/**
 * Blue soldier `shooterId` at (100, 256) and a muzzled red soldier `targetId`
 * `distance` units to its right on the open lane, everyone else downed.
 */
function duel(seed: number, shooterId: number, distance: number, targetId = 5): BattleState {
  const state = createBattle({ seed, map: arena() });
  isolate(state, [shooterId, targetId]);
  place(state.soldiers[shooterId], 100, 256);
  bystander(state, targetId, 100 + distance, 256);
  return state;
}

function ofKind<K extends BattleEvent['kind']>(state: BattleState, kind: K): Extract<BattleEvent, { kind: K }>[] {
  const out: Extract<BattleEvent, { kind: K }>[] = [];
  for (const e of state.events) {
    if (e.kind === kind) {
      out.push(e as Extract<BattleEvent, { kind: K }>);
    }
  }
  return out;
}

describe('lobbed weapons', () => {
  it('lets a chucker fire over a wall at an enemy it cannot see', () => {
    const state = createBattle({ seed: 1, map: arena() });
    isolate(state, [2, 5]);
    const chucker = state.soldiers[2];
    const target = state.soldiers[5];
    place(chucker, 400, 112);
    bystander(state, 5, 550, 112);
    expect(hasLineOfSight(state.map, chucker.x, chucker.y, target.x, target.y)).toBe(false);

    step(state, []);
    expect(state.projectiles).toHaveLength(1);
    const p = state.projectiles[0];
    expect(p.kind).toBe('lobbed');
    expect(p.weapon).toBe('chucker');
    expect(p.side).toBe('blue');
    expect(p.ownerId).toBe(2);
    expect(p.startX).toBe(400);
    expect(p.startY).toBe(112);
    expect(p.vx).toBe(0);
    expect(p.vy).toBe(0);
    expect(p.travelled).toBe(0);
    expect(p.maxDistance).toBe(0);
    expect(p.launchTick).toBe(0);
    expect(p.landTick).toBe(WEAPONS.chucker.flightTicks);
    expect(state.events).toContainEqual({ kind: 'shot', soldierId: 2, weapon: 'chucker' });
    expect(chucker.cooldown).toBe(WEAPONS.chucker.cooldown);
    expect(chucker.targetId).toBe(5);
    expect(chucker.firing).toBe(true);
    expect(chucker.faceX).toBe(1);
    expect(chucker.faceY).toBe(0);
  });

  it('assigns the projectile id from nextProjectileId', () => {
    const state = duel(1, 2, 150);
    state.nextProjectileId = 9;
    step(state, []);
    expect(state.projectiles[0].id).toBe(9);
    expect(state.nextProjectileId).toBe(10);
  });

  it('scatters the landing point with the same two draws as a direct shot', () => {
    const seed = 17;
    const state = duel(seed, 2, 150);
    const t = state.soldiers[5];
    const ref = createRng(seed);
    const dir = DIRECTIONS16[ref.int(DIRECTIONS16.length)];
    const d = ref.next() * WEAPONS.chucker.spread;
    step(state, []);
    const p = state.projectiles[0];
    expect(p.targetX).toBeCloseTo(t.x + dir.x * d, 12);
    expect(p.targetY).toBeCloseTo(t.y + dir.y * d, 12);
    // Nothing else touched the stream this tick (the grenade is still in the air).
    expect(state.rng.next()).toBe(ref.next());
  });

  it('lands within spread of the target position at launch, where the impact is reported', () => {
    const w = WEAPONS.chucker;
    for (let seed = 0; seed < 20; seed++) {
      const state = duel(seed, 2, 150);
      const launchX = state.soldiers[5].x;
      const launchY = state.soldiers[5].y;
      step(state, []);
      const p = state.projectiles[0];
      expect(dist2(p.targetX, p.targetY, launchX, launchY)).toBeLessThanOrEqual(w.spread * w.spread + 1e-9);
      for (let i = 0; i < w.flightTicks; i++) {
        step(state, []);
      }
      const hits = ofKind(state, 'impact');
      expect(hits).toHaveLength(1);
      expect(hits[0].x).toBe(p.targetX);
      expect(hits[0].y).toBe(p.targetY);
    }
  });

  it('lands exactly flightTicks steps after the shot, splashing both sides but not the downed', () => {
    const w = WEAPONS.chucker;
    const state = duel(3, 2, 150);
    const chucker = state.soldiers[2];
    const enemy = state.soldiers[5];

    step(state, []);
    expect(ofKind(state, 'shot')).toHaveLength(1);
    const p = state.projectiles[0];
    expect(p.landTick - p.launchTick).toBe(w.flightTicks);
    const lx = p.targetX;
    const ly = p.targetY;
    // Arrange the bystanders around the known landing point: a friendly and a second
    // enemy inside the radius (and apart from each other so separation leaves them be),
    // a downed soldier right on it, and an enemy just outside.
    const friend = bystander(state, 1, lx + 30, ly);
    const enemyNear = bystander(state, 6, lx - 30, ly);
    const downed = state.soldiers[7];
    place(downed, lx, ly);
    const enemyFar = bystander(state, 8, lx, ly + w.splashRadius + 1);
    expect(downed.status).toBe('downed');

    let impactStep = -1;
    for (let i = 2; i <= w.flightTicks + 5; i++) {
      step(state, []);
      const hits = ofKind(state, 'impact');
      if (hits.length > 0) {
        expect(impactStep).toBe(-1);
        impactStep = i;
        expect(hits).toHaveLength(1);
        expect(hits[0]).toEqual({ kind: 'impact', x: lx, y: ly, weapon: 'chucker', radius: w.splashRadius });
        expect(state.events).toContainEqual({ kind: 'damage', soldierId: 1, amount: w.splashDamage, weapon: 'chucker' });
        expect(state.events).toContainEqual({ kind: 'damage', soldierId: 5, amount: w.splashDamage, weapon: 'chucker' });
        expect(state.events).toContainEqual({ kind: 'damage', soldierId: 6, amount: w.splashDamage, weapon: 'chucker' });
        // Splash is applied before the impact event, as for direct rounds.
        const kinds = state.events.map((e) => e.kind);
        expect(kinds.indexOf('impact')).toBeGreaterThan(kinds.lastIndexOf('damage'));
      }
    }
    expect(impactStep).toBe(1 + w.flightTicks);
    expect(state.projectiles).toHaveLength(0);
    expect(friend.hp).toBe(MAX_HP - w.splashDamage);
    expect(enemy.hp).toBe(MAX_HP - w.splashDamage);
    expect(enemyNear.hp).toBe(MAX_HP - w.splashDamage);
    expect(enemyFar.hp).toBe(MAX_HP);
    expect(downed.hp).toBe(0);
    expect(downed.status).toBe('downed');
    expect(chucker.hp).toBe(MAX_HP);
    expect(state.winner).toBeNull();
  });

  it('flies linearly from start to target, strictly between them on the middle tick', () => {
    const w = WEAPONS.chucker;
    const state = duel(5, 2, 150);
    step(state, []);
    const p = state.projectiles[0];
    expect(p.x).toBe(100);
    expect(p.y).toBe(256);
    const half = Math.floor(w.flightTicks / 2);
    for (let i = 1; i < half; i++) {
      step(state, []);
    }
    expect(state.projectiles[0]).toBe(p);
    expect(p.prevX).toBeLessThan(p.x);
    step(state, []);
    expect(state.projectiles[0]).toBe(p);
    const midX = p.startX + (p.targetX - p.startX) * (half / w.flightTicks);
    const midY = p.startY + (p.targetY - p.startY) * (half / w.flightTicks);
    expect(p.x).toBeCloseTo(midX, 9);
    expect(p.y).toBeCloseTo(midY, 9);
    expect(p.x).toBeGreaterThan(p.startX);
    expect(p.x).toBeLessThan(p.targetX);
    expect(p.prevX).toBeLessThan(p.x);
  });

  it('hurts the thrower when the grenade lands inside its own splash radius', () => {
    const w = WEAPONS.chucker;
    const state = duel(3, 2, 20);
    const thrower = state.soldiers[2];
    for (let i = 0; i <= w.flightTicks; i++) {
      step(state, []);
    }
    expect(ofKind(state, 'impact')).toHaveLength(1);
    expect(thrower.hp).toBe(MAX_HP - w.splashDamage);
  });

  it('ignores cover: a grenade landing beyond a wall still splashes', () => {
    const w = WEAPONS.chucker;
    const state = createBattle({ seed: 2, map: arena() });
    isolate(state, [2, 5]);
    place(state.soldiers[2], 400, 112);
    const target = bystander(state, 5, 550, 112);
    for (let i = 0; i <= w.flightTicks; i++) {
      step(state, []);
    }
    expect(ofKind(state, 'impact')).toHaveLength(1);
    expect(target.hp).toBe(MAX_HP - w.splashDamage);
    expect(state.projectiles).toHaveLength(0);
  });

  /** Count downed and killed outcomes of a single lobbed shot at a 1 hp enemy over seeds 0..199. */
  function outcomes(shooterId: number): { downed: number; killed: number } {
    const w = WEAPONS[shooterId === 4 ? 'blaster' : 'chucker'];
    let downed = 0;
    let killed = 0;
    for (let seed = 0; seed < 200; seed++) {
      const state = duel(seed, shooterId, 100);
      state.soldiers[5].hp = 1;
      // A far, muzzled red soldier keeps the battle alive after the target falls.
      bystander(state, 9, 900, 256);
      for (let i = 0; i <= w.flightTicks; i++) {
        step(state, []);
      }
      expect(ofKind(state, 'impact')).toHaveLength(1);
      expect(state.soldiers[5].hp).toBe(0);
      downed += ofKind(state, 'downed').filter((e) => e.soldierId === 5).length;
      killed += ofKind(state, 'killed').filter((e) => e.soldierId === 5).length;
      expect(state.winner).toBeNull();
    }
    expect(downed + killed).toBe(200);
    return { downed, killed };
  }

  it('lets a blaster kill outright sometimes', () => {
    const r = outcomes(4);
    expect(r.killed).toBeGreaterThan(0);
    expect(r.downed).toBeGreaterThan(0);
    expect(r.killed / 200).toBeGreaterThanOrEqual(0.03);
    expect(r.killed / 200).toBeLessThanOrEqual(0.2);
  });

  it('never lets a chucker kill outright', () => {
    const r = outcomes(2);
    expect(r.killed).toBe(0);
    expect(r.downed).toBe(200);
  });
});
