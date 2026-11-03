import { describe, expect, it } from 'vitest';
import { dragWorldBox, interpretDrag, isDrag } from '../../src/input/boxSelect';
import { createTopDownProjection } from '../../src/render/projection';
import { DRAG_SELECT_THRESHOLD } from '../../src/render/renderConstants';
import { createBattle, soldierById } from '../../src/sim';
import type { BattleState } from '../../src/sim';

// The field sits 200 right and 40 down on screen, as it does for blue.
const projection = createTopDownProjection(200, 40);
const screen = (x: number, y: number) => projection.worldToScreen(x, y);

/** A battle with every soldier parked far off in the corner, then the given ones placed. */
function battle(places: Record<number, [number, number]>): BattleState {
  const state = createBattle({ seed: 1 });
  state.tick = 12;
  for (const s of state.soldiers) {
    s.x = 800;
    s.y = 460;
  }
  for (const [id, [x, y]] of Object.entries(places)) {
    const s = soldierById(state, Number(id))!;
    s.x = x;
    s.y = y;
  }
  return state;
}

function drag(state: BattleState, selection: number[], from: [number, number], to: [number, number], shift = false) {
  return interpretDrag(state, selection, projection, screen(...from), screen(...to), shift, 'blue');
}

describe('isDrag', () => {
  it('needs the pointer to travel beyond the threshold', () => {
    expect(isDrag({ x: 10, y: 10 }, { x: 10 + DRAG_SELECT_THRESHOLD, y: 10 })).toBe(false);
    expect(isDrag({ x: 10, y: 10 }, { x: 10 + DRAG_SELECT_THRESHOLD + 1, y: 10 })).toBe(true);
    expect(isDrag({ x: 10, y: 10 }, { x: 10 - DRAG_SELECT_THRESHOLD, y: 10 - DRAG_SELECT_THRESHOLD })).toBe(true);
  });
});

describe('dragWorldBox', () => {
  it('maps both corners through the projection and orders them', () => {
    expect(dragWorldBox(projection, screen(150, 40), screen(90, 120))).toEqual({ x0: 90, y0: 40, x1: 150, y1: 120 });
  });
});

describe('interpretDrag', () => {
  it('selects the own soldiers inside the box, in id order, as one select command', () => {
    const state = battle({ 0: [100, 100], 1: [150, 120], 2: [200, 100] });
    const r = drag(state, [], [160, 130], [90, 90]);
    expect(r.selection).toEqual([0, 1]);
    expect(r.commands).toEqual([{ tick: 12, side: 'blue', type: 'select', soldierIds: [0, 1] }]);
  });
  it('counts a centre on the edge as inside', () => {
    const state = battle({ 0: [100, 100], 1: [160, 130] });
    expect(drag(state, [], [100, 100], [160, 130]).selection).toEqual([0, 1]);
  });
  it('works for a box drawn in any direction', () => {
    const state = battle({ 0: [100, 100], 3: [150, 120] });
    for (const [from, to] of [
      [[90, 90], [160, 130]],
      [[160, 130], [90, 90]],
      [[90, 130], [160, 90]],
      [[160, 90], [90, 130]],
    ] as [[number, number], [number, number]][]) {
      expect(drag(state, [], from, to).selection).toEqual([0, 3]);
    }
  });
  it('includes downed soldiers and leaves out dead ones and enemies', () => {
    const state = battle({ 0: [100, 100], 1: [110, 100], 2: [120, 100], 5: [130, 100] });
    soldierById(state, 1)!.status = 'downed';
    soldierById(state, 2)!.status = 'dead';
    expect(drag(state, [], [90, 90], [140, 110]).selection).toEqual([0, 1]);
  });
  it('shift adds the soldiers inside to the selection without duplicates', () => {
    const state = battle({ 0: [100, 100], 1: [110, 100], 4: [300, 300] });
    expect(drag(state, [4], [90, 90], [140, 110], true).selection).toEqual([4, 0, 1]);
    expect(drag(state, [1], [90, 90], [140, 110], true).selection).toEqual([1, 0]);
  });
  it('without shift replaces the selection', () => {
    const state = battle({ 0: [100, 100], 4: [300, 300] });
    expect(drag(state, [4], [90, 90], [140, 110]).selection).toEqual([0]);
  });
  it('clears the selection when nobody is inside, as a click on empty ground does', () => {
    const state = battle({ 0: [100, 100] });
    const r = drag(state, [0], [300, 200], [400, 300]);
    expect(r.selection).toEqual([]);
    expect(r.commands).toEqual([{ tick: 12, side: 'blue', type: 'select', soldierIds: [] }]);
  });
  it('emits no command when the selection does not change', () => {
    const state = battle({ 0: [100, 100], 1: [110, 100] });
    expect(drag(state, [0, 1], [90, 90], [140, 110]).commands).toEqual([]);
  });
  it('behaves as a left click at the start point below the threshold', () => {
    const state = battle({ 0: [100, 100] });
    // a short drag on empty ground clears, like a click
    expect(drag(state, [0], [300, 200], [302, 201]).selection).toEqual([]);
    // a short drag starting on a soldier selects it, like a click, even though the box would hold nobody
    expect(drag(state, [], [100, 100], [103, 100]).selection).toEqual([0]);
  });
});
