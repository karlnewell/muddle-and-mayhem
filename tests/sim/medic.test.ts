import { describe, expect, it } from 'vitest';
import { createBattle, step } from '../../src/sim/battle';
import { CLASS_STATS, MEDIC_CALLS, MEDIC_SPEED, REVIVE_FRACTION, SOLDIER_RADIUS } from '../../src/sim/constants';
import { mapWidthUnits, parseMap } from '../../src/sim/map';
import { advanceMedics, callMedic } from '../../src/sim/medic';
import type { BattleEvent, BattleState, Soldier, TileMap } from '../../src/sim/types';

import type { SoldierClass } from '../../src/sim/types';
/** Full health of a soldier's class. */
const maxHp = (s: { cls: SoldierClass }): number => CLASS_STATS[s.cls].maxHp;

/** A cooldown no test runs long enough to exhaust: a muzzled soldier never fires. */
const NEVER_FIRES = 1_000_000_000;

/** A 30 by 10 arena (960 by 320 world units): wall down column 15 on rows 0 to 6, open lanes on rows 7 and 8, spawns on row 9. */
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

/** A standing soldier that never fires and never moves. */
function bystander(state: BattleState, id: number, x: number, y: number): Soldier {
  const s = state.soldiers[id];
  s.status = 'standing';
  s.hp = maxHp(s);
  s.cooldown = NEVER_FIRES;
  place(s, x, y);
  return s;
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

const BODY_DISTANCE = 300;

/**
 * Everyone downed except one muzzled gunner per side, far apart on the open
 * lane so neither can fire: blue 0 at (100, 256), red 5 at (860, 256). The
 * blue launcher 1 lies downed BODY_DISTANCE units in from the blue edge and
 * the red launcher 6 the same distance in from the red edge.
 */
function field(seed = 1): BattleState {
  const state = createBattle({ seed, map: arena() });
  isolate(state, [0, 5]);
  bystander(state, 0, 100, 256);
  bystander(state, 5, 860, 256);
  place(state.soldiers[1], SOLDIER_RADIUS + BODY_DISTANCE, 256);
  place(state.soldiers[6], mapWidthUnits(state.map) - SOLDIER_RADIUS - BODY_DISTANCE, 256);
  return state;
}

describe('callMedic', () => {
  it('spends one call, starts a run at the blue edge level with the body, and emits medic', () => {
    const state = field();
    expect(callMedic(state, 'blue', 1)).toBe(true);
    expect(state.sides.blue.medicCalls).toBe(MEDIC_CALLS - 1);
    expect(state.sides.red.medicCalls).toBe(MEDIC_CALLS);
    expect(state.medics).toEqual([
      { side: 'blue', targetId: 1, x: SOLDIER_RADIUS, y: 256, prevX: SOLDIER_RADIUS, prevY: 256 },
    ]);
    expect(state.events).toEqual([{ kind: 'medic', side: 'blue', targetId: 1 }]);
  });

  it('starts a red run at the red edge', () => {
    const state = field();
    const edge = mapWidthUnits(state.map) - SOLDIER_RADIUS;
    expect(edge).toBe(960 - SOLDIER_RADIUS);
    expect(callMedic(state, 'red', 6)).toBe(true);
    expect(state.sides.red.medicCalls).toBe(MEDIC_CALLS - 1);
    expect(state.sides.blue.medicCalls).toBe(MEDIC_CALLS);
    expect(state.medics).toEqual([{ side: 'red', targetId: 6, x: edge, y: 256, prevX: edge, prevY: 256 }]);
    expect(state.events).toEqual([{ kind: 'medic', side: 'red', targetId: 6 }]);
  });

  it('starts the run level with the body wherever the body lies', () => {
    const state = field();
    place(state.soldiers[2], 400, 100);
    expect(callMedic(state, 'blue', 2)).toBe(true);
    expect(state.medics[0].y).toBe(100);
    expect(state.medics[0].x).toBe(SOLDIER_RADIUS);
  });

  function expectUntouched(state: BattleState, before: string): void {
    expect(JSON.stringify(state)).toBe(before);
    expect(state.medics).toHaveLength(0);
    expect(state.events).toHaveLength(0);
    expect(state.sides.blue.medicCalls).toBe(MEDIC_CALLS);
    expect(state.sides.red.medicCalls).toBe(MEDIC_CALLS);
  }

  it('refuses a standing target and changes nothing', () => {
    const state = field();
    const before = JSON.stringify(state);
    expect(callMedic(state, 'blue', 0)).toBe(false);
    expectUntouched(state, before);
  });

  it('refuses a dead target', () => {
    const state = field();
    state.soldiers[1].status = 'dead';
    const before = JSON.stringify(state);
    expect(callMedic(state, 'blue', 1)).toBe(false);
    expectUntouched(state, before);
  });

  it('refuses an unknown target', () => {
    const state = field();
    const before = JSON.stringify(state);
    expect(callMedic(state, 'blue', 99)).toBe(false);
    expectUntouched(state, before);
  });

  it("refuses the other side's body", () => {
    const state = field();
    const before = JSON.stringify(state);
    expect(callMedic(state, 'blue', 6)).toBe(false);
    expect(callMedic(state, 'red', 1)).toBe(false);
    expectUntouched(state, before);
  });

  it('refuses when the side has no calls left', () => {
    const state = field();
    state.sides.blue.medicCalls = 0;
    const before = JSON.stringify(state);
    expect(callMedic(state, 'blue', 1)).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
    expect(state.medics).toHaveLength(0);
    expect(state.events).toHaveLength(0);
    expect(state.sides.blue.medicCalls).toBe(0);
  });

  it('refuses a second call for a body a medic is already heading for', () => {
    const state = field();
    expect(callMedic(state, 'blue', 1)).toBe(true);
    const before = JSON.stringify(state);
    expect(callMedic(state, 'blue', 1)).toBe(false);
    expect(JSON.stringify(state)).toBe(before);
    expect(state.medics).toHaveLength(1);
    expect(state.sides.blue.medicCalls).toBe(MEDIC_CALLS - 1);
    expect(ofKind(state, 'medic')).toHaveLength(1);
  });

  it('allows runs to several bodies at once, up to the call limit', () => {
    const state = field();
    expect(callMedic(state, 'blue', 1)).toBe(true);
    expect(callMedic(state, 'blue', 2)).toBe(true);
    expect(callMedic(state, 'blue', 3)).toBe(true);
    expect(callMedic(state, 'blue', 4)).toBe(false);
    expect(state.sides.blue.medicCalls).toBe(0);
    expect(state.medics.map((m) => m.targetId)).toEqual([1, 2, 3]);
  });
});

describe('advanceMedics', () => {
  it('moves straight toward the body by MEDIC_SPEED, keeping the previous position', () => {
    const state = field();
    callMedic(state, 'blue', 1);
    advanceMedics(state);
    expect(state.medics).toHaveLength(1);
    const run = state.medics[0];
    expect(run.prevX).toBe(SOLDIER_RADIUS);
    expect(run.prevY).toBe(256);
    expect(run.x).toBeCloseTo(SOLDIER_RADIUS + MEDIC_SPEED, 12);
    expect(run.y).toBe(256);
    advanceMedics(state);
    expect(run.prevX).toBeCloseTo(SOLDIER_RADIUS + MEDIC_SPEED, 12);
    expect(run.x).toBeCloseTo(SOLDIER_RADIUS + 2 * MEDIC_SPEED, 12);
    expect(state.soldiers[1].status).toBe('downed');
  });

  it('reaches a body 300 units from the edge in about 300 / MEDIC_SPEED ticks', () => {
    const state = field();
    const body = state.soldiers[1];
    callMedic(state, 'blue', 1);
    const notBefore = Math.floor(BODY_DISTANCE / MEDIC_SPEED) - 2;
    const by = Math.ceil(BODY_DISTANCE / MEDIC_SPEED) + 2;
    for (let i = 0; i < notBefore; i++) {
      advanceMedics(state);
    }
    expect(body.status).toBe('downed');
    expect(state.medics).toHaveLength(1);
    let revivedAt = -1;
    for (let i = notBefore; i < by; i++) {
      state.events = [];
      advanceMedics(state);
      if (ofKind(state, 'revived').length > 0) {
        expect(revivedAt).toBe(-1);
        revivedAt = i + 1;
      }
    }
    expect(revivedAt).toBeGreaterThan(notBefore);
    expect(revivedAt).toBeLessThanOrEqual(by);
    expect(body.status).toBe('standing');
  });

  it('revives at REVIVE_FRACTION of full hp, standing, holding, with the run removed and a revived event', () => {
    const state = field();
    const body = state.soldiers[1];
    body.order = { kind: 'move', x: 1, y: 1 };
    body.path = [{ x: 1, y: 1 }];
    body.cooldown = 77;
    body.stuckTicks = 4;
    body.targetId = 5;
    body.firing = true;
    place(body, SOLDIER_RADIUS + MEDIC_SPEED, 200);
    callMedic(state, 'blue', 1);
    state.events = [];
    advanceMedics(state);
    expect(body.hp).toBe(Math.floor(maxHp(body) * REVIVE_FRACTION));
    expect(body.status).toBe('standing');
    expect(body.order).toEqual({ kind: 'hold' });
    expect(body.path).toEqual([]);
    expect(body.cooldown).toBe(0);
    expect(body.stuckTicks).toBe(0);
    expect(body.targetId).toBeNull();
    expect(body.firing).toBe(false);
    expect(body.x).toBe(SOLDIER_RADIUS + MEDIC_SPEED);
    expect(body.y).toBe(200);
    expect(state.events).toEqual([{ kind: 'revived', soldierId: 1 }]);
    expect(state.medics).toEqual([]);
  });

  it('does not revive a body just beyond MEDIC_SPEED on the same tick', () => {
    const state = field();
    const body = state.soldiers[1];
    place(body, SOLDIER_RADIUS + MEDIC_SPEED + 0.5, 256);
    callMedic(state, 'blue', 1);
    state.events = [];
    advanceMedics(state);
    expect(body.status).toBe('downed');
    expect(state.medics).toHaveLength(1);
    advanceMedics(state);
    expect(body.status).toBe('standing');
    expect(state.medics).toHaveLength(0);
  });

  it('removes finished runs while keeping the others in order', () => {
    const state = field();
    place(state.soldiers[1], SOLDIER_RADIUS + 3, 200);
    place(state.soldiers[2], 400, 300);
    place(state.soldiers[4], 500, 100);
    callMedic(state, 'blue', 1);
    callMedic(state, 'blue', 2);
    callMedic(state, 'blue', 4);
    const second = state.medics[1];
    const third = state.medics[2];
    advanceMedics(state);
    expect(state.soldiers[1].status).toBe('standing');
    expect(state.medics).toHaveLength(2);
    expect(state.medics[0]).toBe(second);
    expect(state.medics[1]).toBe(third);
    expect(state.medics.map((m) => m.targetId)).toEqual([2, 4]);
    expect(state.soldiers[2].status).toBe('downed');
    expect(state.soldiers[4].status).toBe('downed');
  });

  it('drops a run whose target is no longer downed without reviving or emitting', () => {
    const state = field();
    callMedic(state, 'blue', 1);
    callMedic(state, 'blue', 2);
    state.soldiers[1].status = 'dead';
    state.soldiers[2].status = 'standing';
    state.soldiers[2].hp = 1;
    state.events = [];
    advanceMedics(state);
    expect(state.medics).toEqual([]);
    expect(state.events).toEqual([]);
    expect(state.soldiers[1].status).toBe('dead');
    expect(state.soldiers[1].hp).toBe(0);
    expect(state.soldiers[2].hp).toBe(1);
  });

  it('follows a body that lies off the lane diagonally and never overshoots', () => {
    const state = field();
    const body = state.soldiers[1];
    place(body, 100, 40);
    callMedic(state, 'blue', 1);
    expect(state.medics[0].y).toBe(40);
    // Shove the start point so the run has to travel diagonally.
    state.medics[0].y = 80;
    state.medics[0].prevY = 80;
    let last = Number.POSITIVE_INFINITY;
    for (let i = 0; i < 40 && state.medics.length > 0; i++) {
      const run = state.medics[0];
      const d = Math.sqrt((run.x - body.x) * (run.x - body.x) + (run.y - body.y) * (run.y - body.y));
      expect(d).toBeLessThan(last);
      last = d;
      advanceMedics(state);
    }
    expect(body.status).toBe('standing');
    expect(state.medics).toEqual([]);
  });
});

describe('medics through step', () => {
  it('accepts a medic command in the command list and advances the run in the same tick', () => {
    const state = field();
    step(state, [{ tick: 0, side: 'blue', type: 'medic', targetId: 1 }]);
    expect(state.sides.blue.medicCalls).toBe(MEDIC_CALLS - 1);
    expect(state.medics).toHaveLength(1);
    const run = state.medics[0];
    expect(run.side).toBe('blue');
    expect(run.targetId).toBe(1);
    expect(run.prevX).toBe(SOLDIER_RADIUS);
    expect(run.x).toBeCloseTo(SOLDIER_RADIUS + MEDIC_SPEED, 12);
    expect(run.y).toBe(256);
    expect(ofKind(state, 'medic')).toEqual([{ kind: 'medic', side: 'blue', targetId: 1 }]);
    expect(state.tick).toBe(1);
  });

  it('ignores a medic command tagged with another tick', () => {
    const state = field();
    step(state, [{ tick: 3, side: 'blue', type: 'medic', targetId: 1 }]);
    expect(state.sides.blue.medicCalls).toBe(MEDIC_CALLS);
    expect(state.medics).toEqual([]);
  });

  it('revives the body within the expected tick window and the soldier holds there', () => {
    const state = field();
    const body = state.soldiers[1];
    const notBefore = Math.floor(BODY_DISTANCE / MEDIC_SPEED) - 2;
    const by = Math.ceil(BODY_DISTANCE / MEDIC_SPEED) + 2;
    step(state, [{ tick: 0, side: 'blue', type: 'medic', targetId: 1 }]);
    for (let i = 1; i < notBefore; i++) {
      step(state, []);
    }
    expect(body.status).toBe('downed');
    let revivedAt = -1;
    for (let i = notBefore; i < by; i++) {
      step(state, []);
      if (ofKind(state, 'revived').length > 0) {
        expect(revivedAt).toBe(-1);
        revivedAt = i + 1;
      }
    }
    expect(revivedAt).toBeGreaterThan(notBefore);
    expect(revivedAt).toBeLessThanOrEqual(by);
    expect(body.status).toBe('standing');
    expect(body.hp).toBe(Math.floor(maxHp(body) * REVIVE_FRACTION));
    expect(body.order).toEqual({ kind: 'hold' });
    expect(state.medics).toEqual([]);
    expect(state.winner).toBeNull();
    // The revived soldier stays put and plays on.
    step(state, []);
    expect(body.x).toBe(SOLDIER_RADIUS + BODY_DISTANCE);
    expect(body.y).toBe(256);
    expect(body.status).toBe('standing');
  });

  it('still hands victory to the other side when the last standing soldier falls with a medic en route', () => {
    const state = field();
    step(state, [{ tick: 0, side: 'blue', type: 'medic', targetId: 1 }]);
    step(state, []);
    expect(state.medics).toHaveLength(1);
    expect(state.winner).toBeNull();
    // Blue's last standing soldier goes down.
    const last = state.soldiers[0];
    last.hp = 0;
    last.status = 'downed';
    step(state, []);
    expect(state.winner).toBe('red');
    expect(ofKind(state, 'victory')).toEqual([{ kind: 'victory', winner: 'red' }]);
    expect(state.medics).toHaveLength(1);
    expect(state.soldiers[1].status).toBe('downed');
    // The battle is frozen: the medic never arrives.
    const tick = state.tick;
    for (let i = 0; i < 100; i++) {
      step(state, []);
    }
    expect(state.tick).toBe(tick);
    expect(state.soldiers[1].status).toBe('downed');
  });

  it('lets a medic that arrives on the tick the last soldier falls keep the side in the fight', () => {
    const state = field();
    const body = state.soldiers[1];
    place(body, SOLDIER_RADIUS + MEDIC_SPEED, 256);
    const last = state.soldiers[0];
    last.hp = 0;
    last.status = 'downed';
    step(state, [{ tick: 0, side: 'blue', type: 'medic', targetId: 1 }]);
    expect(body.status).toBe('standing');
    expect(state.winner).toBeNull();
  });
});
