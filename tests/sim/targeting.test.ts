import { describe, expect, it } from 'vitest';
import { createBattle } from '../../src/sim/battle';
import { WEAPONS } from '../../src/sim/constants';
import { hasLineOfSight } from '../../src/sim/los';
import { parseMap } from '../../src/sim/map';
import { canFireAt, chooseTarget, inRange } from '../../src/sim/targeting';
import type { BattleState, Soldier, TileMap } from '../../src/sim/types';

/**
 * A 30 by 10 arena: a wall down column 15 from row 0 to row 6 (x in [480, 512),
 * y below 224), open lanes on rows 7 and 8, spawns on row 9. Lane y = 256 has
 * clear sight across the whole width; lane y = 112 crosses the wall.
 */
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

function setup(): BattleState {
  return createBattle({ seed: 1, map: arena() });
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

function place(s: Soldier, x: number, y: number): void {
  s.x = x;
  s.y = y;
  s.prevX = x;
  s.prevY = y;
}

describe('inRange', () => {
  it('is true at exactly the weapon range and false one unit beyond', () => {
    const state = setup();
    const g = state.soldiers[0];
    const t = state.soldiers[5];
    place(g, 100, 256);
    place(t, 100 + WEAPONS.gunner.range, 256);
    expect(inRange(g, t)).toBe(true);
    place(t, 101 + WEAPONS.gunner.range, 256);
    expect(inRange(g, t)).toBe(false);
  });

  it('uses the shooter\'s own weapon range', () => {
    const state = setup();
    const launcher = state.soldiers[1];
    const t = state.soldiers[5];
    place(launcher, 100, 256);
    place(t, 100 + WEAPONS.launcher.range, 256);
    expect(inRange(launcher, t)).toBe(true);
    place(t, 101 + WEAPONS.launcher.range, 256);
    expect(inRange(launcher, t)).toBe(false);
  });
});

describe('canFireAt', () => {
  it('is false across a wall for a gunner and true for a chucker', () => {
    const state = setup();
    isolate(state, [0, 2, 5]);
    const gunner = state.soldiers[0];
    const chucker = state.soldiers[2];
    const enemy = state.soldiers[5];
    place(gunner, 400, 112);
    place(chucker, 400, 112);
    place(enemy, 560, 112);
    expect(hasLineOfSight(state.map, 400, 112, 560, 112)).toBe(false);
    expect(canFireAt(state, gunner, enemy)).toBe(false);
    expect(canFireAt(state, chucker, enemy)).toBe(true);
  });

  it('is true for a gunner with clear sight inside range', () => {
    const state = setup();
    isolate(state, [0, 5]);
    place(state.soldiers[0], 100, 256);
    place(state.soldiers[5], 200, 256);
    expect(canFireAt(state, state.soldiers[0], state.soldiers[5])).toBe(true);
  });

  it('is false for a friendly, a downed enemy, and an enemy out of range', () => {
    const state = setup();
    const gunner = state.soldiers[0];
    const friend = state.soldiers[1];
    const enemy = state.soldiers[5];
    place(gunner, 100, 256);
    place(friend, 150, 256);
    place(enemy, 200, 256);
    expect(canFireAt(state, gunner, friend)).toBe(false);
    enemy.status = 'downed';
    expect(canFireAt(state, gunner, enemy)).toBe(false);
    enemy.status = 'dead';
    expect(canFireAt(state, gunner, enemy)).toBe(false);
    enemy.status = 'standing';
    place(enemy, 100 + WEAPONS.gunner.range + 1, 256);
    expect(canFireAt(state, gunner, enemy)).toBe(false);
  });

  it('is false for a soldier against itself', () => {
    const state = setup();
    expect(canFireAt(state, state.soldiers[0], state.soldiers[0])).toBe(false);
  });
});

describe('chooseTarget', () => {
  it('prefers the attack-order target when it is fireable', () => {
    const state = setup();
    isolate(state, [0, 6, 7]);
    const g = state.soldiers[0];
    place(g, 100, 256);
    place(state.soldiers[6], 150, 256);
    place(state.soldiers[7], 250, 256);
    g.order = { kind: 'attack', targetId: 7 };
    expect(chooseTarget(state, g)?.id).toBe(7);
  });

  it('falls back to the nearest fireable enemy when the attack target is out of reach', () => {
    const state = setup();
    isolate(state, [0, 6, 7]);
    const g = state.soldiers[0];
    place(g, 100, 256);
    place(state.soldiers[6], 150, 256);
    place(state.soldiers[7], 400, 256);
    g.order = { kind: 'attack', targetId: 7 };
    expect(chooseTarget(state, g)?.id).toBe(6);
  });

  it('picks the nearest fireable enemy under a hold order, by squared distance', () => {
    const state = setup();
    isolate(state, [0, 5, 6, 7]);
    const g = state.soldiers[0];
    place(g, 100, 256);
    place(state.soldiers[5], 300, 256);
    place(state.soldiers[6], 160, 256);
    place(state.soldiers[7], 220, 256);
    expect(chooseTarget(state, g)?.id).toBe(6);
  });

  it('breaks distance ties by the lower id', () => {
    const state = setup();
    isolate(state, [0, 6, 8]);
    const g = state.soldiers[0];
    place(g, 100, 256);
    place(state.soldiers[8], 150, 206);
    place(state.soldiers[6], 150, 306);
    expect(chooseTarget(state, g)?.id).toBe(6);
  });

  it('never chooses a downed enemy and returns null when nothing is fireable', () => {
    const state = setup();
    isolate(state, [0, 5]);
    const g = state.soldiers[0];
    place(g, 100, 256);
    place(state.soldiers[5], 150, 256);
    state.soldiers[5].status = 'downed';
    expect(chooseTarget(state, g)).toBeNull();
  });

  it('skips enemies behind cover for a gunner but not for a chucker', () => {
    const state = setup();
    isolate(state, [0, 2, 5]);
    const gunner = state.soldiers[0];
    const chucker = state.soldiers[2];
    place(gunner, 400, 112);
    place(chucker, 400, 112);
    place(state.soldiers[5], 560, 112);
    expect(chooseTarget(state, gunner)).toBeNull();
    expect(chooseTarget(state, chucker)?.id).toBe(5);
  });

  it('ignores friendlies entirely', () => {
    const state = setup();
    isolate(state, [0, 1, 5]);
    place(state.soldiers[0], 100, 256);
    place(state.soldiers[1], 120, 256);
    place(state.soldiers[5], 200, 256);
    expect(chooseTarget(state, state.soldiers[0])?.id).toBe(5);
  });
});
