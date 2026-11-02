import { describe, expect, it } from 'vitest';
import { createBattle } from '../../src/sim/battle';
import { MAX_HP, SOLDIER_RADIUS, WEAPONS } from '../../src/sim/constants';
import { parseMap } from '../../src/sim/map';
import { advanceProjectiles } from '../../src/sim/projectiles';
import type { BattleEvent, BattleState, Projectile, Soldier, SoldierClass, TileMap } from '../../src/sim/types';
import { normalize } from '../../src/sim/vec';

/** A 30 by 10 arena: wall down column 15 on rows 0 to 6 (x in [480, 512)), open lanes on rows 7 and 8. */
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

/** A fresh battle on the arena with every soldier downed except `keep`. */
function setup(keep: readonly number[]): BattleState {
  const state = createBattle({ seed: 1, map: arena() });
  for (const s of state.soldiers) {
    if (!keep.includes(s.id)) {
      s.status = 'downed';
      s.hp = 0;
    }
  }
  return state;
}

function place(s: Soldier, x: number, y: number): void {
  s.x = x;
  s.y = y;
  s.prevX = x;
  s.prevY = y;
}

/** A hand-built direct projectile from the owner's position straight at (tx, ty). */
function shoot(
  state: BattleState, owner: Soldier, weapon: SoldierClass, tx: number, ty: number,
  speed = WEAPONS[weapon].speed, maxDistance = 10000,
): Projectile {
  const dir = normalize(tx - owner.x, ty - owner.y);
  const p: Projectile = {
    id: state.nextProjectileId++,
    kind: 'direct',
    weapon,
    side: owner.side,
    ownerId: owner.id,
    x: owner.x, y: owner.y,
    prevX: owner.x, prevY: owner.y,
    vx: dir.x * speed, vy: dir.y * speed,
    startX: owner.x, startY: owner.y,
    targetX: tx, targetY: ty,
    launchTick: state.tick,
    landTick: -1,
    travelled: 0,
    maxDistance,
  };
  state.projectiles.push(p);
  return p;
}

function impacts(state: BattleState): Extract<BattleEvent, { kind: 'impact' }>[] {
  const out: Extract<BattleEvent, { kind: 'impact' }>[] = [];
  for (const e of state.events) {
    if (e.kind === 'impact') {
      out.push(e);
    }
  }
  return out;
}

/** Advance until the projectile list is empty or `max` ticks pass; returns the tick count used. */
function flyUntilDone(state: BattleState, max: number): number {
  let ticks = 0;
  while (state.projectiles.length > 0 && ticks < max) {
    state.events = [];
    advanceProjectiles(state);
    ticks++;
  }
  return ticks;
}

describe('advanceProjectiles, direct kind', () => {
  it('hits an enemy 100 units away within 7 ticks, deals damage, emits impact, and is removed', () => {
    const state = setup([0, 5]);
    const shooter = state.soldiers[0];
    const target = state.soldiers[5];
    place(shooter, 100, 256);
    place(target, 200, 256);
    shoot(state, shooter, 'gunner', 200, 256);
    const ticks = flyUntilDone(state, 7);
    expect(state.projectiles).toHaveLength(0);
    expect(ticks).toBeLessThanOrEqual(7);
    expect(target.hp).toBe(MAX_HP - WEAPONS.gunner.damage);
    const hits = impacts(state);
    expect(hits).toHaveLength(1);
    expect(hits[0].weapon).toBe('gunner');
    expect(hits[0].radius).toBe(0);
    expect(hits[0].x).toBeCloseTo(200 - SOLDIER_RADIUS, 6);
    expect(hits[0].y).toBeCloseTo(256, 6);
    expect(state.events).toContainEqual({ kind: 'damage', soldierId: 5, amount: WEAPONS.gunner.damage, weapon: 'gunner' });
  });

  it('keeps prevX/prevY one tick behind while in flight', () => {
    const state = setup([0, 5]);
    const shooter = state.soldiers[0];
    place(shooter, 100, 256);
    place(state.soldiers[5], 800, 256);
    const p = shoot(state, shooter, 'gunner', 800, 256);
    advanceProjectiles(state);
    expect(p.prevX).toBe(100);
    expect(p.x).toBeCloseTo(116, 9);
    expect(p.travelled).toBe(WEAPONS.gunner.speed);
    advanceProjectiles(state);
    expect(p.prevX).toBeCloseTo(116, 9);
    expect(p.x).toBeCloseTo(132, 9);
  });

  it('stops at a wall between shooter and target, impacting at the near edge', () => {
    const state = setup([0, 5]);
    const shooter = state.soldiers[0];
    const target = state.soldiers[5];
    place(shooter, 400, 112);
    place(target, 560, 112);
    shoot(state, shooter, 'gunner', 560, 112);
    flyUntilDone(state, 20);
    expect(state.projectiles).toHaveLength(0);
    expect(target.hp).toBe(MAX_HP);
    const hits = impacts(state);
    expect(hits).toHaveLength(1);
    expect(Math.abs(hits[0].x - 480)).toBeLessThanOrEqual(1);
    expect(hits[0].y).toBeCloseTo(112, 6);
    expect(state.events.some((e) => e.kind === 'damage')).toBe(false);
  });

  it('does not tunnel: a soldier beside the segment, beyond its endpoints\' reach, is hit', () => {
    const state = setup([0, 5]);
    const shooter = state.soldiers[0];
    const target = state.soldiers[5];
    place(shooter, 100, 256);
    // Segment this tick runs (100,256) to (116,256). Both endpoints are 12.8 from the
    // centre, outside the radius; the segment passes 10 units from it.
    place(target, 108, 266);
    shoot(state, shooter, 'gunner', 900, 256);
    advanceProjectiles(state);
    expect(target.hp).toBe(MAX_HP - WEAPONS.gunner.damage);
    expect(state.projectiles).toHaveLength(0);
  });

  it('does not tunnel: a fast round whose whole tick straddles a soldier still hits', () => {
    const state = setup([0, 5]);
    const shooter = state.soldiers[0];
    const target = state.soldiers[5];
    place(shooter, 100, 256);
    place(target, 120, 256);
    // Speed 40: the segment runs from 100 to 140, both endpoints 20 from the centre.
    shoot(state, shooter, 'gunner', 900, 256, 40);
    advanceProjectiles(state);
    expect(target.hp).toBe(MAX_HP - WEAPONS.gunner.damage);
    const hits = impacts(state);
    expect(hits).toHaveLength(1);
    expect(hits[0].x).toBeCloseTo(120 - SOLDIER_RADIUS, 6);
  });

  it('hits a soldier centred 8 units past the segment midpoint', () => {
    const state = setup([0, 5]);
    const shooter = state.soldiers[0];
    const target = state.soldiers[5];
    place(shooter, 100, 256);
    place(target, 116, 256);
    shoot(state, shooter, 'gunner', 900, 256);
    advanceProjectiles(state);
    expect(target.hp).toBe(MAX_HP - WEAPONS.gunner.damage);
    expect(state.projectiles).toHaveLength(0);
  });

  it('hits an enemy already overlapping the start point at t = 0', () => {
    const state = setup([0, 5]);
    const shooter = state.soldiers[0];
    const target = state.soldiers[5];
    place(shooter, 100, 256);
    place(target, 105, 256);
    shoot(state, shooter, 'gunner', 900, 256);
    advanceProjectiles(state);
    expect(target.hp).toBe(MAX_HP - WEAPONS.gunner.damage);
    const hits = impacts(state);
    expect(hits).toHaveLength(1);
    expect(hits[0].x).toBe(100);
    expect(hits[0].y).toBe(256);
  });

  it('passes through friendlies and the owner, hitting the enemy behind them', () => {
    const state = setup([0, 1, 5]);
    const shooter = state.soldiers[0];
    const friend = state.soldiers[1];
    const enemy = state.soldiers[5];
    place(shooter, 100, 256);
    place(friend, 150, 256);
    place(enemy, 200, 256);
    shoot(state, shooter, 'gunner', 200, 256);
    flyUntilDone(state, 20);
    expect(friend.hp).toBe(MAX_HP);
    expect(enemy.hp).toBe(MAX_HP - WEAPONS.gunner.damage);
    expect(state.projectiles).toHaveLength(0);
  });

  it('hits the nearer of two enemies on the line', () => {
    const state = setup([0, 5, 6]);
    const shooter = state.soldiers[0];
    place(shooter, 100, 256);
    place(state.soldiers[5], 200, 256);
    place(state.soldiers[6], 150, 256);
    shoot(state, shooter, 'gunner', 200, 256);
    flyUntilDone(state, 20);
    expect(state.soldiers[6].hp).toBe(MAX_HP - WEAPONS.gunner.damage);
    expect(state.soldiers[5].hp).toBe(MAX_HP);
  });

  it('applies launcher damage to the soldier hit and splash to others in radius, not outside it', () => {
    const state = setup([1, 2, 5, 6]);
    const shooter = state.soldiers[1];
    const friendNear = state.soldiers[2];
    const enemyHit = state.soldiers[5];
    const enemyFar = state.soldiers[6];
    const w = WEAPONS.launcher;
    place(shooter, 100, 256);
    place(enemyHit, 200, 256);
    // Entry point is (188, 256): the friend sits 32.3 away (inside 40), the far enemy 46.6 away.
    place(friendNear, 200, 286);
    place(enemyFar, 200, 301);
    shoot(state, shooter, 'launcher', 200, 256);
    flyUntilDone(state, 20);
    expect(enemyHit.hp).toBe(MAX_HP - w.damage);
    expect(friendNear.hp).toBe(MAX_HP - w.splashDamage);
    expect(enemyFar.hp).toBe(MAX_HP);
    const hits = impacts(state);
    expect(hits).toHaveLength(1);
    expect(hits[0].weapon).toBe('launcher');
    expect(hits[0].radius).toBe(w.splashRadius);
    expect(hits[0].x).toBeCloseTo(188, 6);
  });

  it('splashes around a rocket stopped by cover, with nobody excluded', () => {
    const state = setup([1, 5, 6]);
    const shooter = state.soldiers[1];
    const w = WEAPONS.launcher;
    place(shooter, 400, 112);
    place(state.soldiers[5], 560, 112);   // aimed at, behind the wall, outside the splash
    place(state.soldiers[6], 515, 112);   // just behind the wall, 35 from the impact point
    shoot(state, shooter, 'launcher', 560, 112);
    flyUntilDone(state, 20);
    expect(state.soldiers[5].hp).toBe(MAX_HP);
    expect(state.soldiers[6].hp).toBe(MAX_HP - w.splashDamage);
    const hits = impacts(state);
    expect(hits).toHaveLength(1);
    expect(Math.abs(hits[0].x - 480)).toBeLessThanOrEqual(1);
    expect(hits[0].radius).toBe(w.splashRadius);
  });

  it('is removed at maxDistance without an impact event', () => {
    const state = setup([0, 5]);
    const shooter = state.soldiers[0];
    place(shooter, 100, 256);
    place(state.soldiers[5], 900, 256);
    shoot(state, shooter, 'gunner', 900, 256, WEAPONS.gunner.speed, 50);
    let ticks = 0;
    let sawImpact = false;
    while (state.projectiles.length > 0 && ticks < 10) {
      state.events = [];
      advanceProjectiles(state);
      sawImpact = sawImpact || impacts(state).length > 0;
      ticks++;
    }
    expect(state.projectiles).toHaveLength(0);
    expect(ticks).toBe(4); // 16, 32, 48, 64 >= 50
    expect(sawImpact).toBe(false);
    expect(state.soldiers[5].hp).toBe(MAX_HP);
  });

  it('keeps surviving projectiles in their original order when one is removed', () => {
    const state = setup([0, 5]);
    const shooter = state.soldiers[0];
    place(shooter, 100, 256);
    // 13 from the start point: outside the radius, so only the round heading +x reaches it.
    place(state.soldiers[5], 113, 256);
    const a = shoot(state, shooter, 'gunner', 100, 900);   // straight down, passes 13 units away
    const b = shoot(state, shooter, 'gunner', 900, 256);   // enters the enemy at x = 101: hits at once
    const c = shoot(state, shooter, 'gunner', 100, 0);     // straight up, passes 13 units away
    advanceProjectiles(state);
    expect(state.projectiles.map((p) => p.id)).toEqual([a.id, c.id]);
    expect(state.projectiles.includes(b)).toBe(false);
  });

  it('hits the soldier, not the cover, on an exact tie', () => {
    const state = setup([0, 5]);
    const shooter = state.soldiers[0];
    const target = state.soldiers[5];
    // Segment 464 to 480 along y = 112. The enemy's circle edge and the wall's near edge are
    // both at x = 480: discriminant 147456 (sqrt 384 exactly) gives t = 1 exactly for the
    // soldier, and firstCoverHit returns exactly 1 for the wall.
    place(shooter, 464, 112);
    place(target, 492, 112);
    shoot(state, shooter, 'gunner', 900, 112);
    advanceProjectiles(state);
    expect(target.hp).toBe(MAX_HP - WEAPONS.gunner.damage);
    const hits = impacts(state);
    expect(hits).toHaveLength(1);
    expect(Math.abs(hits[0].x - 480)).toBeLessThanOrEqual(1e-9);
    expect(state.projectiles).toHaveLength(0);
  });

  it('damages the soldier hit first, then splashes the others with the hit soldier excluded', () => {
    const state = setup([1, 5, 6]);
    const shooter = state.soldiers[1];
    const enemyHit = state.soldiers[5];
    const neighbour = state.soldiers[6];
    place(shooter, 100, 256);
    place(enemyHit, 200, 256);
    place(neighbour, 200, 286); // 32.3 from the entry point (188, 256), inside the splash
    enemyHit.hp = 1;
    neighbour.hp = 1;
    shoot(state, shooter, 'launcher', 200, 256);
    flyUntilDone(state, 20);
    const kinds = state.events.map((e) => ('soldierId' in e ? `${e.kind}:${e.soldierId}` : e.kind));
    const hitDamage = kinds.indexOf('damage:5');
    const hitOutcome = Math.max(kinds.indexOf('downed:5'), kinds.indexOf('killed:5'));
    const neighbourDamage = kinds.indexOf('damage:6');
    expect(hitDamage).toBeGreaterThanOrEqual(0);
    expect(hitOutcome).toBeGreaterThan(hitDamage);
    expect(neighbourDamage).toBeGreaterThan(hitOutcome);
    expect(kinds.filter((k) => k === 'damage:5')).toHaveLength(1);
    expect(kinds.filter((k) => k === 'damage:6')).toHaveLength(1);
    expect(enemyHit.hp).toBe(0);
    expect(enemyHit.status).not.toBe('standing');
    expect(neighbour.hp).toBe(0);
    expect(neighbour.status).not.toBe('standing');
    expect(kinds[kinds.length - 1]).toBe('impact');
  });

  it('does nothing when there are no projectiles', () => {
    const state = setup([0, 5]);
    advanceProjectiles(state);
    expect(state.projectiles).toEqual([]);
    expect(state.events).toEqual([]);
  });
});
