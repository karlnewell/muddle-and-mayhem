import { describe, expect, it } from 'vitest';
import { createBattle } from '../../src/sim/battle';
import { COVER_SPLASH_FRACTION, INSTANT_KILL_CHANCE, MAX_HP, WEAPONS, overrideTuning } from '../../src/sim/constants';
import { applyDamage, applySplash } from '../../src/sim/damage';
import { parseMap } from '../../src/sim/map';
import type { BattleState, Soldier, TileMap } from '../../src/sim/types';

const SEEDS = 200;

/** Park every soldier far from the origin so splash tests place only the ones they mean to. */
function scatterFar(state: BattleState): void {
  for (const s of state.soldiers) {
    s.x = -10000 - s.id * 1000;
    s.y = -10000;
  }
}

/** A 30 by 10 arena with a single crate at tile (15, 3): x in [480, 512), y in [96, 128). */
function crateArena(): TileMap {
  const rows: string[] = [];
  for (let ty = 0; ty < 9; ty++) {
    rows.push(ty === 3 ? '...............c..............' : '..............................');
  }
  rows.push('bbbbb...............rrrrr.....');
  return parseMap('CrateArena', rows);
}

function place(state: BattleState, id: number, x: number, y: number): Soldier {
  const s = state.soldiers[id];
  s.x = x;
  s.y = y;
  return s;
}

describe('applyDamage', () => {
  it('reduces hp by the amount and leaves a wounded soldier standing', () => {
    const state = createBattle({ seed: 1 });
    const target = state.soldiers[5];
    applyDamage(state, target, WEAPONS.gunner.damage, 'gunner', 9);
    expect(target.hp).toBe(MAX_HP - WEAPONS.gunner.damage);
    expect(target.status).toBe('standing');
    expect(state.events).toEqual([
      { kind: 'damage', soldierId: 5, amount: WEAPONS.gunner.damage, weapon: 'gunner', sourceId: 9 },
    ]);
  });

  it('never drops hp below zero', () => {
    const state = createBattle({ seed: 1 });
    const target = state.soldiers[5];
    applyDamage(state, target, MAX_HP + 50, 'gunner', 9);
    expect(target.hp).toBe(0);
  });

  it('downs, never kills, with a Gunner over 200 seeds', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const state = createBattle({ seed });
      const target = state.soldiers[5];
      applyDamage(state, target, MAX_HP, 'gunner', 9);
      expect(target.hp).toBe(0);
      expect(target.status).toBe('downed');
    }
  });

  it('kills for some seeds and downs for others with a Launcher, near INSTANT_KILL_CHANCE', () => {
    let dead = 0;
    let downed = 0;
    for (let seed = 0; seed < SEEDS; seed++) {
      const state = createBattle({ seed });
      const target = state.soldiers[5];
      applyDamage(state, target, MAX_HP, 'launcher', 9);
      expect(target.hp).toBe(0);
      if (target.status === 'dead') {
        dead++;
      } else {
        expect(target.status).toBe('downed');
        downed++;
      }
    }
    expect(dead).toBeGreaterThan(0);
    expect(downed).toBeGreaterThan(0);
    const fraction = dead / SEEDS;
    // A loose band around the configured chance, so tuning the constant does not break this.
    expect(fraction).toBeGreaterThanOrEqual(INSTANT_KILL_CHANCE * 0.3);
    expect(fraction).toBeLessThanOrEqual(INSTANT_KILL_CHANCE * 2);
  });

  it('consults the rng only when an instant-kill weapon downs a soldier', () => {
    // A gunner hit that downs: stream untouched.
    const a = createBattle({ seed: 9 });
    const ref = createBattle({ seed: 9 });
    applyDamage(a, a.soldiers[5], MAX_HP, 'gunner', 9);
    expect(a.rng.next()).toBe(ref.rng.next());

    // A launcher hit that merely wounds: stream untouched.
    const b = createBattle({ seed: 9 });
    const refB = createBattle({ seed: 9 });
    applyDamage(b, b.soldiers[5], 1, 'launcher', 9);
    expect(b.rng.next()).toBe(refB.rng.next());

    // A launcher hit that downs: exactly one draw consumed.
    const c = createBattle({ seed: 9 });
    const refC = createBattle({ seed: 9 });
    applyDamage(c, c.soldiers[5], MAX_HP, 'launcher', 9);
    refC.rng.next();
    expect(c.rng.next()).toBe(refC.rng.next());
  });

  it('clears the order, path, target and firing flag when a soldier goes down', () => {
    const state = createBattle({ seed: 1 });
    const target = state.soldiers[5];
    target.order = { kind: 'attack', targetId: 0 };
    target.path = [{ x: 1, y: 2 }];
    target.targetId = 0;
    target.firing = true;
    applyDamage(state, target, MAX_HP, 'gunner', 9);
    expect(target.order).toEqual({ kind: 'hold' });
    expect(target.path).toEqual([]);
    expect(target.targetId).toBeNull();
    expect(target.firing).toBe(false);
  });

  it('ignores damage to a downed soldier: no hp change, no status change, no event', () => {
    const state = createBattle({ seed: 1 });
    const target = state.soldiers[5];
    target.status = 'downed';
    target.hp = 0;
    applyDamage(state, target, 50, 'launcher', 9);
    expect(target.hp).toBe(0);
    expect(target.status).toBe('downed');
    expect(state.events).toEqual([]);
  });

  it('ignores damage to a dead soldier', () => {
    const state = createBattle({ seed: 1 });
    const target = state.soldiers[5];
    target.status = 'dead';
    target.hp = 0;
    applyDamage(state, target, 50, 'gunner', 9);
    expect(target.hp).toBe(0);
    expect(target.status).toBe('dead');
    expect(state.events).toEqual([]);
  });

  it('emits damage then downed', () => {
    const state = createBattle({ seed: 1 });
    applyDamage(state, state.soldiers[5], MAX_HP, 'gunner', 9);
    expect(state.events).toEqual([
      { kind: 'damage', soldierId: 5, amount: MAX_HP, weapon: 'gunner', sourceId: 9 },
      { kind: 'downed', soldierId: 5 },
    ]);
  });

  it('emits damage then killed on an instant kill', () => {
    let seen = false;
    for (let seed = 0; seed < SEEDS && !seen; seed++) {
      const state = createBattle({ seed });
      applyDamage(state, state.soldiers[5], MAX_HP, 'launcher', 9);
      if (state.soldiers[5].status === 'dead') {
        seen = true;
        expect(state.events).toEqual([
          { kind: 'damage', soldierId: 5, amount: MAX_HP, weapon: 'launcher', sourceId: 9 },
          { kind: 'killed', soldierId: 5 },
        ]);
      }
    }
    expect(seen).toBe(true);
  });
});

describe('applySplash', () => {
  it('hits standing soldiers of both sides inside the radius, in ascending id order', () => {
    const state = createBattle({ seed: 1 });
    scatterFar(state);
    const radius = 40;
    const amount = WEAPONS.chucker.splashDamage;
    // All on the open road (rows 9 to 10 of Crossroads), so no cover soaks anyone.
    place(state, 7, 430, 320);        // red, 30 inside
    place(state, 2, 400, 300);        // blue, 20 inside
    place(state, 8, 440, 320);        // red, exactly on the radius: inside
    place(state, 9, 441, 320);        // red, just outside
    place(state, 4, 400, 320);        // blue at the centre, excluded
    place(state, 6, 410, 320);        // red inside but downed
    state.soldiers[6].status = 'downed';
    state.soldiers[6].hp = 0;

    applySplash(state, 400, 320, radius, amount, 'chucker', 4, 2);

    expect(state.soldiers[2].hp).toBe(MAX_HP - amount);
    expect(state.soldiers[7].hp).toBe(MAX_HP - amount);
    expect(state.soldiers[8].hp).toBe(MAX_HP - amount);
    expect(state.soldiers[9].hp).toBe(MAX_HP);
    expect(state.soldiers[4].hp).toBe(MAX_HP);
    expect(state.soldiers[6].hp).toBe(0);
    expect(state.soldiers[6].status).toBe('downed');
    expect(state.events).toEqual([
      { kind: 'damage', soldierId: 2, amount, weapon: 'chucker', sourceId: 2 },
      { kind: 'damage', soldierId: 7, amount, weapon: 'chucker', sourceId: 2 },
      { kind: 'damage', soldierId: 8, amount, weapon: 'chucker', sourceId: 2 },
    ]);
  });

  it('stamps every splash victim with the thrower as sourceId', () => {
    const state = createBattle({ seed: 1 });
    scatterFar(state);
    place(state, 1, 410, 400);
    place(state, 5, 400, 410);
    applySplash(state, 400, 400, 40, 10, 'chucker', null, 7);
    expect(state.events).toEqual([
      { kind: 'damage', soldierId: 1, amount: 10, weapon: 'chucker', sourceId: 7 },
      { kind: 'damage', soldierId: 5, amount: 10, weapon: 'chucker', sourceId: 7 },
    ]);
  });

  it('does not add the soldier radius: a soldier whose edge overlaps the circle is missed', () => {
    const state = createBattle({ seed: 1 });
    scatterFar(state);
    place(state, 7, 400 + 40 + 1, 400);
    applySplash(state, 400, 400, 40, 10, 'chucker', null, 2);
    expect(state.soldiers[7].hp).toBe(MAX_HP);
    expect(state.events).toEqual([]);
  });

  it('hits everyone when excludeId is null, and downs those it drops to zero', () => {
    const state = createBattle({ seed: 1 });
    scatterFar(state);
    place(state, 0, 400, 400);
    place(state, 5, 405, 405);
    applySplash(state, 400, 400, 40, MAX_HP, 'chucker', null, 2);
    expect(state.soldiers[0].status).toBe('downed');
    expect(state.soldiers[5].status).toBe('downed');
    expect(state.events).toEqual([
      { kind: 'damage', soldierId: 0, amount: MAX_HP, weapon: 'chucker', sourceId: 2 },
      { kind: 'downed', soldierId: 0 },
      { kind: 'damage', soldierId: 5, amount: MAX_HP, weapon: 'chucker', sourceId: 2 },
      { kind: 'downed', soldierId: 5 },
    ]);
  });
});

describe('applySplash and cover', () => {
  it('gives a soldier behind a crate the fraction and one in the open beside it full damage from the same burst', () => {
    const state = createBattle({ seed: 1, map: crateArena() });
    scatterFar(state);
    place(state, 7, 530, 112);   // beyond the crate, 60 from the burst
    place(state, 2, 470, 160);   // open ground, 48 from the burst, nothing between
    applySplash(state, 470, 112, 80, 40, 'chucker', null, 2);
    expect(state.soldiers[2].hp).toBe(MAX_HP - 40);
    expect(state.soldiers[7].hp).toBe(MAX_HP - 40 * COVER_SPLASH_FRACTION);
    expect(state.events).toEqual([
      { kind: 'damage', soldierId: 2, amount: 40, weapon: 'chucker', sourceId: 2 },
      { kind: 'damage', soldierId: 7, amount: 40 * COVER_SPLASH_FRACTION, weapon: 'chucker', sourceId: 2 },
    ]);
  });

  it('gives everyone the fraction when the burst is absorbed, whatever lies between', () => {
    const state = createBattle({ seed: 1, map: crateArena() });
    scatterFar(state);
    place(state, 2, 470, 112);   // west of the crate, 26 from a burst inside it
    place(state, 7, 522, 112);   // east of the crate, 26 from it
    applySplash(state, 496, 112, 40, 40, 'blaster', null, 4, true);
    expect(state.soldiers[2].hp).toBe(MAX_HP - 40 * COVER_SPLASH_FRACTION);
    expect(state.soldiers[7].hp).toBe(MAX_HP - 40 * COVER_SPLASH_FRACTION);
  });

  it('still emits a damage event of the soaked amount when the fraction is zero', () => {
    const before = COVER_SPLASH_FRACTION;
    overrideTuning({ COVER_SPLASH_FRACTION: 0 });
    try {
      const state = createBattle({ seed: 1, map: crateArena() });
      scatterFar(state);
      place(state, 7, 530, 112);
      applySplash(state, 470, 112, 80, 40, 'chucker', null, 2);
      expect(state.soldiers[7].hp).toBe(MAX_HP);
      expect(state.events).toEqual([{ kind: 'damage', soldierId: 7, amount: 0, weapon: 'chucker', sourceId: 2 }]);
    } finally {
      overrideTuning({ COVER_SPLASH_FRACTION: before });
    }
  });
});
