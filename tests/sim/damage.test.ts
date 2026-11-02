import { describe, expect, it } from 'vitest';
import { createBattle } from '../../src/sim/battle';
import { INSTANT_KILL_CHANCE, MAX_HP, WEAPONS } from '../../src/sim/constants';
import { applyDamage, applySplash } from '../../src/sim/damage';
import type { BattleState, Soldier } from '../../src/sim/types';

const SEEDS = 200;

/** Park every soldier far from the origin so splash tests place only the ones they mean to. */
function scatterFar(state: BattleState): void {
  for (const s of state.soldiers) {
    s.x = -10000 - s.id * 1000;
    s.y = -10000;
  }
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
    applyDamage(state, target, WEAPONS.gunner.damage, 'gunner');
    expect(target.hp).toBe(MAX_HP - WEAPONS.gunner.damage);
    expect(target.status).toBe('standing');
    expect(state.events).toEqual([
      { kind: 'damage', soldierId: 5, amount: WEAPONS.gunner.damage, weapon: 'gunner' },
    ]);
  });

  it('never drops hp below zero', () => {
    const state = createBattle({ seed: 1 });
    const target = state.soldiers[5];
    applyDamage(state, target, MAX_HP + 50, 'gunner');
    expect(target.hp).toBe(0);
  });

  it('downs, never kills, with a Gunner over 200 seeds', () => {
    for (let seed = 0; seed < SEEDS; seed++) {
      const state = createBattle({ seed });
      const target = state.soldiers[5];
      applyDamage(state, target, MAX_HP, 'gunner');
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
      applyDamage(state, target, MAX_HP, 'launcher');
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
    applyDamage(a, a.soldiers[5], MAX_HP, 'gunner');
    expect(a.rng.next()).toBe(ref.rng.next());

    // A launcher hit that merely wounds: stream untouched.
    const b = createBattle({ seed: 9 });
    const refB = createBattle({ seed: 9 });
    applyDamage(b, b.soldiers[5], 1, 'launcher');
    expect(b.rng.next()).toBe(refB.rng.next());

    // A launcher hit that downs: exactly one draw consumed.
    const c = createBattle({ seed: 9 });
    const refC = createBattle({ seed: 9 });
    applyDamage(c, c.soldiers[5], MAX_HP, 'launcher');
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
    applyDamage(state, target, MAX_HP, 'gunner');
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
    applyDamage(state, target, 50, 'launcher');
    expect(target.hp).toBe(0);
    expect(target.status).toBe('downed');
    expect(state.events).toEqual([]);
  });

  it('ignores damage to a dead soldier', () => {
    const state = createBattle({ seed: 1 });
    const target = state.soldiers[5];
    target.status = 'dead';
    target.hp = 0;
    applyDamage(state, target, 50, 'gunner');
    expect(target.hp).toBe(0);
    expect(target.status).toBe('dead');
    expect(state.events).toEqual([]);
  });

  it('emits damage then downed', () => {
    const state = createBattle({ seed: 1 });
    applyDamage(state, state.soldiers[5], MAX_HP, 'gunner');
    expect(state.events).toEqual([
      { kind: 'damage', soldierId: 5, amount: MAX_HP, weapon: 'gunner' },
      { kind: 'downed', soldierId: 5 },
    ]);
  });

  it('emits damage then killed on an instant kill', () => {
    let seen = false;
    for (let seed = 0; seed < SEEDS && !seen; seed++) {
      const state = createBattle({ seed });
      applyDamage(state, state.soldiers[5], MAX_HP, 'launcher');
      if (state.soldiers[5].status === 'dead') {
        seen = true;
        expect(state.events).toEqual([
          { kind: 'damage', soldierId: 5, amount: MAX_HP, weapon: 'launcher' },
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
    place(state, 7, 430, 400);        // red, 30 inside
    place(state, 2, 400, 380);        // blue, 20 inside
    place(state, 8, 440, 400);        // red, exactly on the radius: inside
    place(state, 9, 441, 400);        // red, just outside
    place(state, 4, 400, 400);        // blue at the centre, excluded
    place(state, 6, 410, 400);        // red inside but downed
    state.soldiers[6].status = 'downed';
    state.soldiers[6].hp = 0;

    applySplash(state, 400, 400, radius, amount, 'chucker', 4);

    expect(state.soldiers[2].hp).toBe(MAX_HP - amount);
    expect(state.soldiers[7].hp).toBe(MAX_HP - amount);
    expect(state.soldiers[8].hp).toBe(MAX_HP - amount);
    expect(state.soldiers[9].hp).toBe(MAX_HP);
    expect(state.soldiers[4].hp).toBe(MAX_HP);
    expect(state.soldiers[6].hp).toBe(0);
    expect(state.soldiers[6].status).toBe('downed');
    expect(state.events).toEqual([
      { kind: 'damage', soldierId: 2, amount, weapon: 'chucker' },
      { kind: 'damage', soldierId: 7, amount, weapon: 'chucker' },
      { kind: 'damage', soldierId: 8, amount, weapon: 'chucker' },
    ]);
  });

  it('does not add the soldier radius: a soldier whose edge overlaps the circle is missed', () => {
    const state = createBattle({ seed: 1 });
    scatterFar(state);
    place(state, 7, 400 + 40 + 1, 400);
    applySplash(state, 400, 400, 40, 10, 'chucker', null);
    expect(state.soldiers[7].hp).toBe(MAX_HP);
    expect(state.events).toEqual([]);
  });

  it('hits everyone when excludeId is null, and downs those it drops to zero', () => {
    const state = createBattle({ seed: 1 });
    scatterFar(state);
    place(state, 0, 400, 400);
    place(state, 5, 405, 405);
    applySplash(state, 400, 400, 40, MAX_HP, 'chucker', null);
    expect(state.soldiers[0].status).toBe('downed');
    expect(state.soldiers[5].status).toBe('downed');
    expect(state.events).toEqual([
      { kind: 'damage', soldierId: 0, amount: MAX_HP, weapon: 'chucker' },
      { kind: 'downed', soldierId: 0 },
      { kind: 'damage', soldierId: 5, amount: MAX_HP, weapon: 'chucker' },
      { kind: 'downed', soldierId: 5 },
    ]);
  });
});
