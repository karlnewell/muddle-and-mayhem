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

describe('interpretKey, debug overlay', () => {
  it('D sets toggleDebug, keeps the selection and emits no command', () => {
    const state = battle();
    const r = interpretKey(state, [1, 3], 'd', false, 'blue');
    expect(r.toggleDebug).toBe(true);
    expect(r.selection).toEqual([1, 3]);
    expect(r.commands).toEqual([]);
    expect(r.togglePause).toBeUndefined();
    expect(r.toggleMenu).toBeUndefined();
  });
  it('accepts the upper-case letter too and no other key sets the flag', () => {
    const state = battle();
    expect(interpretKey(state, [], 'D', true, 'blue').toggleDebug).toBe(true);
    expect(interpretKey(state, [], 'h', false, 'blue').toggleDebug).toBeUndefined();
    expect(interpretKey(state, [], ' ', false, 'blue').toggleDebug).toBeUndefined();
  });
});


describe('interpretKey, volley', () => {
  const place = (state: BattleState, id: number, x: number, y: number) => {
    const s = soldierById(state, id)!;
    s.x = x;
    s.y = y;
  };
  it('A orders every standing friendly to attack the standing enemy nearest the cursor', () => {
    const state = battle();
    const e = at(state, 8);
    const r = interpretKey(state, [1], 'a', false, 'blue', { x: e.x + 3, y: e.y - 2 });
    expect(r.selection).toEqual([1]);
    expect(r.commands).toEqual([{ tick: 12, side: 'blue', type: 'attack', soldierIds: [0, 1, 2, 3, 4], targetId: 8 }]);
    expect(interpretKey(state, [], 'A', true, 'blue', e).commands[0]).toMatchObject({ type: 'attack', targetId: 8 });
  });
  it('picks by squared distance to the cursor, not by id or slot', () => {
    const state = battle();
    place(state, 5, 600, 300);
    place(state, 9, 520, 300);
    place(state, 6, 900, 600);
    place(state, 7, 900, 600);
    place(state, 8, 900, 600);
    expect(interpretKey(state, [], 'a', false, 'blue', { x: 500, y: 300 }).commands[0]).toMatchObject({ targetId: 9 });
    expect(interpretKey(state, [], 'a', false, 'blue', { x: 590, y: 300 }).commands[0]).toMatchObject({ targetId: 5 });
  });
  it('breaks a tie toward the lower id', () => {
    const state = battle();
    place(state, 6, 500, 300);
    place(state, 8, 500, 300);
    expect(interpretKey(state, [], 'a', false, 'blue', { x: 400, y: 300 }).commands[0]).toMatchObject({ targetId: 6 });
    place(state, 6, 520, 300);
    place(state, 8, 480, 300);
    expect(interpretKey(state, [], 'a', false, 'blue', { x: 500, y: 300 }).commands[0]).toMatchObject({ targetId: 6 });
  });
  it('skips downed and dead enemies', () => {
    const state = battle();
    const e = at(state, 7);
    soldierById(state, 7)!.status = 'downed';
    const r = interpretKey(state, [], 'a', false, 'blue', e);
    expect(r.commands).toHaveLength(1);
    expect(r.commands[0]).toMatchObject({ type: 'attack' });
    expect(r.commands[0]).not.toMatchObject({ targetId: 7 });
    for (const id of [5, 6, 8, 9]) {
      soldierById(state, id)!.status = id % 2 === 0 ? 'dead' : 'downed';
    }
    expect(interpretKey(state, [], 'a', false, 'blue', e).commands).toEqual([]);
  });
  it('leaves downed and dead friendlies out of the order, and does nothing with none standing', () => {
    const state = battle();
    soldierById(state, 1)!.status = 'downed';
    soldierById(state, 3)!.status = 'dead';
    const e = at(state, 5);
    expect(interpretKey(state, [1, 3], 'a', false, 'blue', e).commands).toEqual([
      { tick: 12, side: 'blue', type: 'attack', soldierIds: [0, 2, 4], targetId: 5 },
    ]);
    for (const id of [0, 2, 4]) {
      soldierById(state, id)!.status = 'downed';
    }
    expect(interpretKey(state, [], 'a', false, 'blue', e).commands).toEqual([]);
  });
  it('works for the red side and does nothing without a cursor position', () => {
    const state = battle();
    const b = at(state, 2);
    expect(interpretKey(state, [], 'a', false, 'red', b).commands).toEqual([
      { tick: 12, side: 'red', type: 'attack', soldierIds: [5, 6, 7, 8, 9], targetId: 2 },
    ]);
    expect(interpretKey(state, [], 'a', false, 'blue')).toEqual({ selection: [], commands: [] });
    expect(interpretKey(state, [], 'a', false, 'blue', null)).toEqual({ selection: [], commands: [] });
  });
});

describe('interpretKey, select all', () => {
  it('S selects the whole squad in id order and mirrors it as a select command', () => {
    const state = battle();
    const r = interpretKey(state, [3], 's', false, 'blue');
    expect(r.selection).toEqual([0, 1, 2, 3, 4]);
    expect(r.commands).toEqual([{ tick: 12, side: 'blue', type: 'select', soldierIds: [0, 1, 2, 3, 4] }]);
    expect(interpretKey(state, [], 'S', true, 'blue').selection).toEqual([0, 1, 2, 3, 4]);
  });
  it('includes downed soldiers, as a click does, and leaves the dead out', () => {
    const state = battle();
    soldierById(state, 1)!.status = 'downed';
    soldierById(state, 3)!.status = 'dead';
    expect(interpretKey(state, [], 's', false, 'blue').selection).toEqual([0, 1, 2, 4]);
  });
  it('emits no command when the whole squad is already selected', () => {
    const state = battle();
    expect(interpretKey(state, [0, 1, 2, 3, 4], 's', false, 'blue')).toEqual({ selection: [0, 1, 2, 3, 4], commands: [] });
  });
  it('selects the red squad for the red side', () => {
    const state = battle();
    expect(interpretKey(state, [], 's', false, 'red').selection).toEqual([5, 6, 7, 8, 9]);
  });
  it('a right click after S moves every standing soldier, downed ones left out', () => {
    const state = battle();
    soldierById(state, 2)!.status = 'downed';
    const all = interpretKey(state, [], 's', false, 'blue').selection;
    expect(interpretClick(state, all, 'right', 500, 300, false, 'blue').commands).toEqual([
      { tick: 12, side: 'blue', type: 'move', soldierIds: [0, 1, 3, 4], x: 500, y: 300 },
    ]);
  });
});
