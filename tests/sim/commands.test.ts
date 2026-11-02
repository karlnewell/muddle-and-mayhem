import { describe, expect, it } from 'vitest';
import { createBattle } from '../../src/sim/battle';
import { applyCommand } from '../../src/sim/commands';
import { MEDIC_CALLS } from '../../src/sim/constants';
import { isBlocked, tileCenter, worldToTile } from '../../src/sim/map';
import type { BattleState } from '../../src/sim/types';

function fresh(): BattleState {
  return createBattle({ seed: 1 });
}

describe('applyCommand select', () => {
  it('records ids of the commanding side only, whatever their status', () => {
    const state = fresh();
    state.soldiers[1].status = 'downed';
    applyCommand(state, { tick: 0, side: 'blue', type: 'select', soldierIds: [0, 1, 7, 42] });
    expect(state.sides.blue.selected).toEqual([0, 1]);
    expect(state.sides.red.selected).toEqual([]);
  });

  it('replaces the previous selection', () => {
    const state = fresh();
    applyCommand(state, { tick: 0, side: 'red', type: 'select', soldierIds: [5, 6] });
    applyCommand(state, { tick: 0, side: 'red', type: 'select', soldierIds: [9] });
    expect(state.sides.red.selected).toEqual([9]);
  });
});

describe('applyCommand move', () => {
  it('sets the order and a non-empty path toward an open point', () => {
    const state = fresh();
    applyCommand(state, { tick: 0, side: 'blue', type: 'move', soldierIds: [0], x: 200, y: 210 });
    const s = state.soldiers[0];
    expect(s.order).toEqual({ kind: 'move', x: 200, y: 210 });
    expect(s.path.length).toBeGreaterThan(0);
    expect(s.path[s.path.length - 1]).toEqual({ x: 200, y: 210 });
    expect(s.stuckTicks).toBe(0);
    expect(s.lastRepathTick).toBe(0);
  });

  it('snaps a point on a wall tile to an open tile', () => {
    const state = fresh();
    const wall = tileCenter(15, 3);
    expect(isBlocked(state.map, 15, 3)).toBe(true);
    applyCommand(state, { tick: 0, side: 'blue', type: 'move', soldierIds: [0], x: wall.x, y: wall.y });
    const order = state.soldiers[0].order;
    expect(order.kind).toBe('move');
    if (order.kind === 'move') {
      const tile = worldToTile(order.x, order.y);
      expect(isBlocked(state.map, tile.tx, tile.ty)).toBe(false);
      expect(order.x === wall.x && order.y === wall.y).toBe(false);
    }
  });

  it('keeps the exact point when the tile is open', () => {
    const state = fresh();
    applyCommand(state, { tick: 0, side: 'blue', type: 'move', soldierIds: [0], x: 101.5, y: 203.25 });
    expect(state.soldiers[0].order).toEqual({ kind: 'move', x: 101.5, y: 203.25 });
  });

  it('is ignored for soldiers of the other side and for unknown ids', () => {
    const state = fresh();
    applyCommand(state, { tick: 0, side: 'red', type: 'move', soldierIds: [0, 99], x: 200, y: 210 });
    expect(state.soldiers[0].order).toEqual({ kind: 'hold' });
    expect(state.soldiers[0].path).toEqual([]);
  });

  it('is ignored for a downed soldier', () => {
    const state = fresh();
    state.soldiers[0].status = 'downed';
    applyCommand(state, { tick: 0, side: 'blue', type: 'move', soldierIds: [0], x: 200, y: 210 });
    expect(state.soldiers[0].order).toEqual({ kind: 'hold' });
    expect(state.soldiers[0].path).toEqual([]);
  });

  it('orders several soldiers at once', () => {
    const state = fresh();
    applyCommand(state, { tick: 3, side: 'blue', type: 'move', soldierIds: [0, 2], x: 200, y: 210 });
    expect(state.soldiers[0].order.kind).toBe('move');
    expect(state.soldiers[2].order.kind).toBe('move');
    expect(state.soldiers[1].order.kind).toBe('hold');
  });
});

describe('applyCommand attack', () => {
  it('sets the order on an enemy target and clears the path', () => {
    const state = fresh();
    applyCommand(state, { tick: 0, side: 'blue', type: 'move', soldierIds: [0], x: 200, y: 210 });
    applyCommand(state, { tick: 0, side: 'blue', type: 'attack', soldierIds: [0], targetId: 7 });
    expect(state.soldiers[0].order).toEqual({ kind: 'attack', targetId: 7 });
    expect(state.soldiers[0].path).toEqual([]);
  });

  it('is ignored on a friendly target', () => {
    const state = fresh();
    applyCommand(state, { tick: 0, side: 'blue', type: 'attack', soldierIds: [0], targetId: 1 });
    expect(state.soldiers[0].order).toEqual({ kind: 'hold' });
  });

  it('is ignored on a downed or unknown target', () => {
    const state = fresh();
    state.soldiers[7].status = 'downed';
    applyCommand(state, { tick: 0, side: 'blue', type: 'attack', soldierIds: [0], targetId: 7 });
    applyCommand(state, { tick: 0, side: 'blue', type: 'attack', soldierIds: [0], targetId: 55 });
    expect(state.soldiers[0].order).toEqual({ kind: 'hold' });
  });

  it('is ignored for a soldier of the other side', () => {
    const state = fresh();
    applyCommand(state, { tick: 0, side: 'red', type: 'attack', soldierIds: [0], targetId: 7 });
    expect(state.soldiers[0].order).toEqual({ kind: 'hold' });
  });
});

describe('applyCommand hold', () => {
  it('clears the order and the path', () => {
    const state = fresh();
    applyCommand(state, { tick: 0, side: 'blue', type: 'move', soldierIds: [0], x: 200, y: 210 });
    applyCommand(state, { tick: 0, side: 'blue', type: 'hold', soldierIds: [0] });
    expect(state.soldiers[0].order).toEqual({ kind: 'hold' });
    expect(state.soldiers[0].path).toEqual([]);
  });

  it('is ignored for a soldier of the other side', () => {
    const state = fresh();
    applyCommand(state, { tick: 0, side: 'blue', type: 'move', soldierIds: [0], x: 200, y: 210 });
    applyCommand(state, { tick: 0, side: 'red', type: 'hold', soldierIds: [0] });
    expect(state.soldiers[0].order.kind).toBe('move');
  });
});

describe('applyCommand medic', () => {
  it('starts a medic run for a downed friendly and spends a call', () => {
    const state = fresh();
    state.soldiers[1].status = 'downed';
    applyCommand(state, { tick: 0, side: 'blue', type: 'medic', targetId: 1 });
    expect(state.sides.blue.medicCalls).toBe(MEDIC_CALLS - 1);
    expect(state.medics).toHaveLength(1);
    expect(state.medics[0].targetId).toBe(1);
    expect(state.events).toContainEqual({ kind: 'medic', side: 'blue', targetId: 1 });
  });

  it('ignores a medic command for a standing soldier', () => {
    const state = fresh();
    const before = JSON.stringify(state);
    applyCommand(state, { tick: 0, side: 'blue', type: 'medic', targetId: 1 });
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe('applyCommand orderTick', () => {
  it('records the tick of the command that set each order', () => {
    const state = fresh();
    state.tick = 40;
    applyCommand(state, { tick: 40, side: 'blue', type: 'move', soldierIds: [0], x: 200, y: 210 });
    expect(state.soldiers[0].orderTick).toBe(40);
    state.tick = 55;
    applyCommand(state, { tick: 55, side: 'blue', type: 'attack', soldierIds: [1], targetId: 5 });
    expect(state.soldiers[1].orderTick).toBe(55);
    state.tick = 70;
    applyCommand(state, { tick: 70, side: 'blue', type: 'hold', soldierIds: [0] });
    expect(state.soldiers[0].orderTick).toBe(70);
  });

  it('leaves orderTick alone for a select or an ignored command', () => {
    const state = fresh();
    state.tick = 12;
    applyCommand(state, { tick: 12, side: 'blue', type: 'select', soldierIds: [0] });
    applyCommand(state, { tick: 12, side: 'red', type: 'hold', soldierIds: [0] }); // wrong side
    expect(state.soldiers[0].orderTick).toBe(-1);
  });
});
