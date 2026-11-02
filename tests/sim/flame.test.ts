import { describe, expect, it } from 'vitest';
import { createBattle, step } from '../../src/sim/battle';
import { MAX_HP, WEAPONS, overrideTuning } from '../../src/sim/constants';
import { applyFlame, inCone } from '../../src/sim/flame';
import { applyCommand } from '../../src/sim/commands';
import { fireWeapons } from '../../src/sim/weapons';
import { hasLineOfSight } from '../../src/sim/los';
import { parseMap } from '../../src/sim/map';
import type { BattleEvent, BattleState, Soldier, TileMap } from '../../src/sim/types';

/** A cooldown no test runs long enough to exhaust: a muzzled soldier never fires. */
const NEVER_FIRES = 1_000_000_000;

const SCORCHER = WEAPONS.scorcher;

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

/** A standing soldier that never fires and never moves: a bystander for cone tests. */
function bystander(state: BattleState, id: number, x: number, y: number): Soldier {
  const s = state.soldiers[id];
  s.status = 'standing';
  s.hp = MAX_HP;
  s.cooldown = NEVER_FIRES;
  place(s, x, y);
  return s;
}

/**
 * The blue scorcher (id 3) at (100, 256) and a muzzled red soldier `targetId`
 * `distance` units to its right on the open lane, everyone else downed.
 */
function duel(seed: number, distance: number, targetId = 5): BattleState {
  const state = createBattle({ seed, map: arena() });
  isolate(state, [3, targetId]);
  place(state.soldiers[3], 100, 256);
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

describe('inCone', () => {
  /** A scorcher at (100, 256) facing +x. */
  function facingRight(): Soldier {
    const state = createBattle({ seed: 1, map: arena() });
    const s = state.soldiers[3];
    place(s, 100, 256);
    s.faceX = 1;
    s.faceY = 0;
    return s;
  }

  it('includes a point straight ahead at half range', () => {
    const s = facingRight();
    expect(inCone(s, 100 + 48, 256, 96)).toBe(true);
  });

  it('excludes a point straight ahead at range plus one', () => {
    const s = facingRight();
    expect(inCone(s, 100 + 96, 256, 96)).toBe(true);
    expect(inCone(s, 100 + 97, 256, 96)).toBe(false);
  });

  it('excludes a point 45 degrees off axis at half range', () => {
    const s = facingRight();
    const c = 0.7071067811865476 * 48;
    expect(inCone(s, 100 + c, 256 + c, 96)).toBe(false);
    expect(inCone(s, 100 + c, 256 - c, 96)).toBe(false);
  });

  it('includes a point 20 degrees off axis', () => {
    const s = facingRight();
    expect(inCone(s, 100 + 0.9396926 * 40, 256 + 0.3420201 * 40, 96)).toBe(true);
    expect(inCone(s, 100 + 0.9396926 * 40, 256 - 0.3420201 * 40, 96)).toBe(true);
  });

  it('excludes a point behind the scorcher', () => {
    const s = facingRight();
    expect(inCone(s, 100 - 48, 256, 96)).toBe(false);
  });

  it('follows the facing vector', () => {
    const s = facingRight();
    s.faceX = 0;
    s.faceY = 1;
    expect(inCone(s, 100, 256 + 48, 96)).toBe(true);
    expect(inCone(s, 100 + 48, 256, 96)).toBe(false);
  });
});

describe('flame cone', () => {
  it('burns an enemy at 60 units for exactly damage per tick over 10 ticks, and a friendly in the cone too', () => {
    const state = duel(1, 60);
    const scorcher = state.soldiers[3];
    const enemy = state.soldiers[5];
    // A friendly standing inside the cone, apart from both so separation leaves it be.
    const friend = bystander(state, 1, 140, 276);
    expect(inCone(scorcher, friend.x, friend.y, SCORCHER.range)).toBe(true);

    for (let i = 0; i < 10; i++) {
      step(state, []);
      expect(scorcher.firing).toBe(true);
      expect(scorcher.targetId).toBe(5);
      expect(scorcher.cooldown).toBe(0);
      expect(scorcher.faceX).toBe(1);
      expect(scorcher.faceY).toBe(0);
      expect(ofKind(state, 'shot')).toHaveLength(0);
      expect(state.projectiles).toHaveLength(0);
      const damage = ofKind(state, 'damage');
      expect(damage).toHaveLength(2);
      expect(damage[0]).toEqual({ kind: 'damage', soldierId: 1, amount: SCORCHER.damage, weapon: 'scorcher', sourceId: 3 });
      expect(damage[1]).toEqual({ kind: 'damage', soldierId: 5, amount: SCORCHER.damage, weapon: 'scorcher', sourceId: 3 });
    }
    expect(enemy.hp).toBeCloseTo(MAX_HP - 10 * SCORCHER.damage, 9);
    expect(friend.hp).toBeCloseTo(MAX_HP - 10 * SCORCHER.damage, 9);
    expect(scorcher.hp).toBe(MAX_HP);
    expect(state.winner).toBeNull();
  });

  it('does not burn a soldier behind cover inside the cone', () => {
    const state = createBattle({ seed: 2, map: arena() });
    isolate(state, [3, 5, 6]);
    const scorcher = state.soldiers[3];
    // Both targets inside the Scorcher's range (72); the covered one sits past the wall's far edge.
    place(scorcher, 464, 236);
    const visible = bystander(state, 5, 528, 236);
    const covered = bystander(state, 6, 526, 206);
    expect(hasLineOfSight(state.map, scorcher.x, scorcher.y, visible.x, visible.y)).toBe(true);
    expect(hasLineOfSight(state.map, scorcher.x, scorcher.y, covered.x, covered.y)).toBe(false);

    for (let i = 0; i < 5; i++) {
      step(state, []);
      expect(scorcher.firing).toBe(true);
      expect(scorcher.targetId).toBe(5);
      expect(inCone(scorcher, covered.x, covered.y, SCORCHER.range)).toBe(true);
      expect(ofKind(state, 'damage').map((e) => e.soldierId)).toEqual([5]);
    }
    expect(visible.hp).toBeCloseTo(MAX_HP - 5 * SCORCHER.damage, 9);
    expect(covered.hp).toBe(MAX_HP);
  });

  it('does not burn a downed soldier in the cone', () => {
    const state = duel(3, 60);
    const scorcher = state.soldiers[3];
    const downed = state.soldiers[6];
    place(downed, 130, 256);
    expect(downed.status).toBe('downed');

    for (let i = 0; i < 5; i++) {
      step(state, []);
      expect(inCone(scorcher, downed.x, downed.y, SCORCHER.range)).toBe(true);
      expect(ofKind(state, 'damage').map((e) => e.soldierId)).toEqual([5]);
    }
    expect(downed.hp).toBe(0);
    expect(downed.status).toBe('downed');
    expect(state.soldiers[5].hp).toBeCloseTo(MAX_HP - 5 * SCORCHER.damage, 9);
  });

  it('has firing false and deals no damage with no target in range', () => {
    const state = duel(4, SCORCHER.range + 20);
    const scorcher = state.soldiers[3];
    const enemy = state.soldiers[5];
    for (let i = 0; i < 5; i++) {
      step(state, []);
      expect(scorcher.firing).toBe(false);
      expect(scorcher.targetId).toBeNull();
      expect(ofKind(state, 'damage')).toHaveLength(0);
    }
    expect(enemy.hp).toBe(MAX_HP);
    expect(scorcher.x).toBe(100);
    expect(scorcher.y).toBe(256);
  });

  it('never burns the scorcher itself and does nothing when firing is false', () => {
    const state = duel(5, 60);
    const scorcher = state.soldiers[3];
    scorcher.firing = false;
    applyFlame(state);
    expect(state.events).toHaveLength(0);
    scorcher.firing = true;
    applyFlame(state);
    expect(ofKind(state, 'damage').map((e) => e.soldierId)).toEqual([5]);
    expect(scorcher.hp).toBe(MAX_HP);
  });

  it('kills outright sometimes when finishing an enemy with one tick of hp left', () => {
    let downed = 0;
    let killed = 0;
    for (let seed = 0; seed < 200; seed++) {
      const state = duel(seed, 60);
      state.soldiers[5].hp = SCORCHER.damage;
      // A far, muzzled red soldier keeps the battle alive after the target falls.
      bystander(state, 9, 900, 256);
      step(state, []);
      expect(state.soldiers[5].hp).toBe(0);
      downed += ofKind(state, 'downed').filter((e) => e.soldierId === 5).length;
      killed += ofKind(state, 'killed').filter((e) => e.soldierId === 5).length;
      expect(state.winner).toBeNull();
    }
    expect(downed + killed).toBe(200);
    expect(killed).toBeGreaterThan(0);
    expect(downed).toBeGreaterThan(0);
    expect(killed / 200).toBeGreaterThanOrEqual(0.03);
    expect(killed / 200).toBeLessThanOrEqual(0.2);
  });
});

describe('fireWhileMoving', () => {
  /** Run `fn` with the Scorcher forbidden to fire while moving, then restore the shipped value. */
  function withGroundedScorcher(fn: () => void): void {
    const before = WEAPONS.scorcher.fireWhileMoving;
    overrideTuning({ WEAPONS: { scorcher: { fireWhileMoving: false } } });
    try {
      fn();
    } finally {
      overrideTuning({ WEAPONS: { scorcher: { fireWhileMoving: before } } });
    }
  }

  it('a scorcher that may not fire while moving keeps its cone off while its path is non-empty and lights it once it stops', () => {
    withGroundedScorcher(() => {
      const state = duel(1, 50);
      const scorcher = state.soldiers[3];
      const target = state.soldiers[5];
      scorcher.order = { kind: 'move', x: 300, y: 256 };
      scorcher.path = [{ x: 300, y: 256 }];
      fireWeapons(state);
      applyFlame(state);
      expect(scorcher.firing).toBe(false);
      expect(scorcher.targetId).toBeNull();
      expect(target.hp).toBe(MAX_HP);
      scorcher.path = [];
      fireWeapons(state);
      applyFlame(state);
      expect(scorcher.firing).toBe(true);
      expect(target.hp).toBe(MAX_HP - SCORCHER.damage);
    });
  });

  it('a scorcher under an attack order walks past an enemy in its cone without burning it, then burns its target once in range', () => {
    withGroundedScorcher(() => {
      const state = createBattle({ seed: 1, map: arena() });
      isolate(state, [3]);
      const scorcher = state.soldiers[3];
      place(scorcher, 100, 256);
      const passed = bystander(state, 6, 150, 230);   // 56 away, 27 degrees off the line east: in cone, in range, off the path
      const target = bystander(state, 5, 400, 256);   // the attack target, out of range until the scorcher has walked in
      applyCommand(state, { tick: 0, side: 'blue', type: 'attack', soldierIds: [3], targetId: 5 });
      for (let i = 0; i < 150; i++) {
        step(state, []);
      }
      expect(passed.hp).toBe(MAX_HP);
      expect(target.hp).toBeLessThan(MAX_HP);
      expect(scorcher.path).toEqual([]);
    });
  });

  it('burns an enemy it walks past when its weapon may fire while moving, which is the default', () => {
    const state = createBattle({ seed: 1, map: arena() });
    isolate(state, [3]);
    place(state.soldiers[3], 100, 256);
    const passed = bystander(state, 6, 150, 230);
    bystander(state, 5, 400, 256);
    applyCommand(state, { tick: 0, side: 'blue', type: 'attack', soldierIds: [3], targetId: 5 });
    for (let i = 0; i < 150; i++) {
      step(state, []);
    }
    expect(passed.hp).toBeLessThan(MAX_HP);
  });
});
