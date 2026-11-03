import { afterEach, describe, expect, it } from 'vitest';
import { createBattle } from '../../src/sim/battle';
import * as constants from '../../src/sim/constants';
import { CLASS_ORDER, FIRING_MOVE_FRACTION, MEDIC_SPEED, REVIVE_FRACTION, SOLDIER_RADIUS, overrideTuning } from '../../src/sim/constants';
import { parseMap } from '../../src/sim/map';
import { advanceMedics, callMedic } from '../../src/sim/medic';
import { moveSoldiers } from '../../src/sim/movement';
import { hpFraction } from '../../src/sim/soldiers';
import type { BattleState, Soldier, SoldierClass, TileMap } from '../../src/sim/types';

// Every test that changes CLASS_STATS gives each class a different value, so
// a reader that used one class's entry for all of them would fail here even
// while the shipped table gives every class the same numbers.

const defaults = { CLASS_STATS: constants.CLASS_STATS, FIRING_MOVE_FRACTION };
const DISTINCT_HP: Record<SoldierClass, number> = { gunner: 150, launcher: 140, chucker: 130, scorcher: 100, blaster: 120 };
const DISTINCT_SPEED: Record<SoldierClass, number> = { gunner: 1.8, launcher: 1.5, chucker: 1.7, scorcher: 2.1, blaster: 1.6 };
const never = (): boolean => false;

function withHp(): void {
  overrideTuning({ CLASS_STATS: Object.fromEntries(CLASS_ORDER.map((c) => [c, { maxHp: DISTINCT_HP[c] }])) });
}
function withSpeed(): void {
  overrideTuning({ CLASS_STATS: Object.fromEntries(CLASS_ORDER.map((c) => [c, { speed: DISTINCT_SPEED[c] }])) });
}

/** A 16 by 8 open map; spawns on row 7. */
function openMap(): TileMap {
  const rows: string[] = [];
  for (let ty = 0; ty < 7; ty++) {
    rows.push('................');
  }
  rows.push('bbbbb......rrrrr');
  return parseMap('Open', rows);
}

function place(s: Soldier, x: number, y: number): void {
  s.x = x;
  s.y = y;
  s.prevX = x;
  s.prevY = y;
}

/** Everyone downed and muzzled except `walkerId`, which is ordered 5 tiles east along row 1 from x 64. */
function walker(walkerId: number): { state: BattleState; s: Soldier } {
  const state = createBattle({ seed: 1, map: openMap() });
  for (const o of state.soldiers) {
    if (o.id !== walkerId) {
      o.status = 'downed';
      o.hp = 0;
    }
  }
  const s = state.soldiers[walkerId];
  place(s, 64, 48 + 32 * (walkerId % 5));
  s.order = { kind: 'move', x: 64 + 160, y: s.y };
  s.path = [{ x: 64 + 160, y: s.y }];
  s.lastRepathTick = 0;
  return { state, s };
}

afterEach(() => {
  overrideTuning({ CLASS_STATS: defaults.CLASS_STATS, FIRING_MOVE_FRACTION: defaults.FIRING_MOVE_FRACTION });
});

describe('CLASS_STATS', () => {
  it('has exactly the five classes, each at today\'s 160 health and 1.8 speed', () => {
    expect(Object.keys(constants.CLASS_STATS).sort()).toEqual([...CLASS_ORDER].sort());
    for (const cls of CLASS_ORDER) {
      expect(constants.CLASS_STATS[cls]).toEqual({ maxHp: 160, speed: 1.8 });
    }
  });

  it('starts each soldier at its own class\'s maxHp', () => {
    withHp();
    const state = createBattle({ seed: 1 });
    for (const s of state.soldiers) {
      expect(s.hp).toBe(DISTINCT_HP[s.cls]);
    }
  });

  it('revives each class at REVIVE_FRACTION of its own maxHp', () => {
    withHp();
    for (const cls of CLASS_ORDER) {
      const state = createBattle({ seed: 1, map: openMap() });
      const body = state.soldiers.find((s) => s.side === 'blue' && s.cls === cls)!;
      body.status = 'downed';
      body.hp = 0;
      place(body, SOLDIER_RADIUS + MEDIC_SPEED, 100);
      expect(callMedic(state, 'blue', body.id)).toBe(true);
      advanceMedics(state);
      expect(body.status).toBe('standing');
      expect(body.hp).toBe(Math.floor(DISTINCT_HP[cls] * REVIVE_FRACTION));
    }
  });

  it('steps each class at its own speed', () => {
    withSpeed();
    for (let id = 0; id < 5; id++) {
      const { state, s } = walker(id);
      moveSoldiers(state, never);
      expect(s.x).toBeCloseTo(64 + DISTINCT_SPEED[s.cls], 9);
    }
  });

  it('steps a class whose weapon discharged at FIRING_MOVE_FRACTION of its own speed', () => {
    withSpeed();
    overrideTuning({ FIRING_MOVE_FRACTION: 0.5 });
    for (let id = 0; id < 5; id++) {
      const { state, s } = walker(id);
      s.firing = true;
      moveSoldiers(state, never);
      expect(s.x).toBeCloseTo(64 + DISTINCT_SPEED[s.cls] * 0.5, 9);
    }
  });
});

describe('hpFraction', () => {
  it('is hp over the soldier\'s class maxHp, clamped to 0 to 1', () => {
    overrideTuning({ CLASS_STATS: { scorcher: { maxHp: 100 } } });
    const state = createBattle({ seed: 1 });
    const scorcher = state.soldiers.find((s) => s.cls === 'scorcher')!;
    const gunner = state.soldiers.find((s) => s.cls === 'gunner')!;
    scorcher.hp = 50;
    expect(hpFraction(scorcher)).toBe(0.5);
    gunner.hp = 80;
    expect(hpFraction(gunner)).toBe(0.5);
    gunner.hp = -5;
    expect(hpFraction(gunner)).toBe(0);
    gunner.hp = 500;
    expect(hpFraction(gunner)).toBe(1);
  });
});
