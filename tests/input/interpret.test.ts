import { describe, expect, it } from 'vitest';
import { interpretClick, interpretKey } from '../../src/input/interpret';
import { createBattle, soldierById } from '../../src/sim';
import type { BattleState } from '../../src/sim';

function battle(): BattleState {
  const state = createBattle({ seed: 1 });
  state.tick = 12;
  return state;
}
const at = (state: BattleState, id: number) => {
  const s = soldierById(state, id)!;
  return { x: s.x, y: s.y };
};

describe('interpretClick, left button', () => {
  it('selects an own standing soldier and mirrors it as a select command', () => {
    const state = battle();
    const p = at(state, 2);
    const r = interpretClick(state, [], 'left', p.x, p.y, false, 'blue');
    expect(r.selection).toEqual([2]);
    expect(r.commands).toEqual([{ tick: 12, side: 'blue', type: 'select', soldierIds: [2] }]);
  });
  it('shift adds to the selection without duplicates', () => {
    const state = battle();
    const p = at(state, 3);
    expect(interpretClick(state, [1], 'left', p.x, p.y, true, 'blue').selection).toEqual([1, 3]);
    expect(interpretClick(state, [1, 3], 'left', p.x, p.y, true, 'blue').selection).toEqual([1, 3]);
  });
  it('selects an own downed soldier', () => {
    const state = battle();
    soldierById(state, 4)!.status = 'downed';
    const p = at(state, 4);
    expect(interpretClick(state, [], 'left', p.x, p.y, false, 'blue').selection).toEqual([4]);
  });
  it('clears the selection on an enemy, a dead soldier, or empty ground', () => {
    const state = battle();
    const e = at(state, 7);
    expect(interpretClick(state, [1], 'left', e.x, e.y, false, 'blue').selection).toEqual([]);
    soldierById(state, 2)!.status = 'dead';
    const d = at(state, 2);
    expect(interpretClick(state, [1], 'left', d.x, d.y, false, 'blue').selection).toEqual([]);
    const r = interpretClick(state, [1], 'left', 640, 352, false, 'blue');
    expect(r.selection).toEqual([]);
    expect(r.commands).toEqual([{ tick: 12, side: 'blue', type: 'select', soldierIds: [] }]);
  });
  it('emits no command when the selection does not change', () => {
    const state = battle();
    expect(interpretClick(state, [], 'left', 640, 352, false, 'blue').commands).toEqual([]);
  });
});

describe('interpretClick, right button', () => {
  it('moves the standing selected soldiers to a ground point, leaving downed ones out', () => {
    const state = battle();
    soldierById(state, 1)!.status = 'downed';
    const r = interpretClick(state, [0, 1, 2], 'right', 500, 300, false, 'blue');
    expect(r.selection).toEqual([0, 1, 2]);
    expect(r.commands).toEqual([{ tick: 12, side: 'blue', type: 'move', soldierIds: [0, 2], x: 500, y: 300 }]);
  });
  it('does nothing with an empty or all-downed selection on ground', () => {
    const state = battle();
    expect(interpretClick(state, [], 'right', 500, 300, false, 'blue').commands).toEqual([]);
    soldierById(state, 1)!.status = 'downed';
    expect(interpretClick(state, [1], 'right', 500, 300, false, 'blue').commands).toEqual([]);
  });
  it('attacks a standing enemy', () => {
    const state = battle();
    const e = at(state, 6);
    const r = interpretClick(state, [0, 3], 'right', e.x + 4, e.y, false, 'blue');
    expect(r.commands).toEqual([{ tick: 12, side: 'blue', type: 'attack', soldierIds: [0, 3], targetId: 6 }]);
  });
  it('calls the medic on a downed friendly whatever the selection', () => {
    const state = battle();
    soldierById(state, 4)!.status = 'downed';
    const p = at(state, 4);
    const r = interpretClick(state, [], 'right', p.x, p.y, false, 'blue');
    expect(r.commands).toEqual([{ tick: 12, side: 'blue', type: 'medic', targetId: 4 }]);
  });
  it('treats a downed enemy or a dead soldier as ground', () => {
    const state = battle();
    soldierById(state, 8)!.status = 'downed';
    soldierById(state, 9)!.status = 'dead';
    const e = at(state, 8);
    expect(interpretClick(state, [0], 'right', e.x, e.y, false, 'blue').commands).toEqual([
      { tick: 12, side: 'blue', type: 'move', soldierIds: [0], x: e.x, y: e.y },
    ]);
    const d = at(state, 9);
    expect(interpretClick(state, [0], 'right', d.x, d.y, false, 'blue').commands[0]).toMatchObject({ type: 'move' });
  });
  it('a right click on an own standing soldier is a move to its position', () => {
    const state = battle();
    const p = at(state, 2);
    expect(interpretClick(state, [0], 'right', p.x, p.y, false, 'blue').commands[0]).toMatchObject({ type: 'move', soldierIds: [0] });
  });
});

describe('interpretKey', () => {
  it('H holds the standing selected soldiers', () => {
    const state = battle();
    soldierById(state, 1)!.status = 'downed';
    const r = interpretKey(state, [0, 1], 'h', false, 'blue');
    expect(r.commands).toEqual([{ tick: 12, side: 'blue', type: 'hold', soldierIds: [0] }]);
    expect(interpretKey(state, [0], 'H', false, 'blue').commands[0]).toMatchObject({ type: 'hold' });
  });
  it('M calls the medic for the first downed soldier in the selection, once', () => {
    const state = battle();
    soldierById(state, 1)!.status = 'downed';
    soldierById(state, 3)!.status = 'downed';
    expect(interpretKey(state, [0, 3, 1], 'm', false, 'blue').commands).toEqual([
      { tick: 12, side: 'blue', type: 'medic', targetId: 3 },
    ]);
    expect(interpretKey(state, [0], 'm', false, 'blue').commands).toEqual([]);
  });
  it('a second M skips a soldier a medic is already running to and takes the next downed one', () => {
    const state = battle();
    soldierById(state, 1)!.status = 'downed';
    soldierById(state, 3)!.status = 'downed';
    state.medics.push({ side: 'blue', targetId: 3, x: 12, y: 100, prevX: 12, prevY: 100 });
    expect(interpretKey(state, [0, 3, 1], 'm', false, 'blue').commands).toEqual([
      { tick: 12, side: 'blue', type: 'medic', targetId: 1 },
    ]);
    state.medics.push({ side: 'blue', targetId: 1, x: 12, y: 100, prevX: 12, prevY: 100 });
    expect(interpretKey(state, [0, 3, 1], 'm', false, 'blue').commands).toEqual([]);
  });
  it('1 to 5 select blue slots, shift adds, a dead slot clears', () => {
    const state = battle();
    expect(interpretKey(state, [], '3', false, 'blue').selection).toEqual([2]);
    expect(interpretKey(state, [2], '5', true, 'blue').selection).toEqual([2, 4]);
    soldierById(state, 0)!.status = 'dead';
    expect(interpretKey(state, [2], '1', false, 'blue').selection).toEqual([]);
    expect(interpretKey(state, [2], '1', true, 'blue').selection).toEqual([2]);
  });
  it('slot keys map to red ids for the red side', () => {
    const state = battle();
    expect(interpretKey(state, [], '2', false, 'red').selection).toEqual([6]);
  });
  it('Space toggles pause and Escape opens the menu, with no commands', () => {
    const state = battle();
    expect(interpretKey(state, [1], ' ', false, 'blue')).toEqual({ selection: [1], commands: [], togglePause: true });
    expect(interpretKey(state, [1], 'Escape', false, 'blue')).toEqual({ selection: [1], commands: [], toggleMenu: true });
  });
  it('ignores other keys', () => {
    const state = battle();
    expect(interpretKey(state, [1], 'q', false, 'blue')).toEqual({ selection: [1], commands: [] });
  });
});
