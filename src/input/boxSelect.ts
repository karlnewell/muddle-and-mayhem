/**
 * Drag-box selection. A left press on the battlefield that travels beyond
 * `DRAG_SELECT_THRESHOLD` logical pixels before release selects every own
 * standing or downed soldier whose centre lies inside the box (edges
 * included), in id order; shift adds them to the selection. A box with
 * nobody inside clears the selection, as a click on empty ground does. A
 * shorter press is an ordinary left click at the start point. The box is
 * dragged in screen coordinates and tested in world coordinates through
 * the projection.
 */
import type { Projection } from '../render/projection';
import { DRAG_SELECT_THRESHOLD, PICK_RADIUS } from '../render/renderConstants';
import type { BattleState, Side } from '../sim';
import { interpretClick, select, selectable } from './interpret';
import type { InputResult, WorldPoint } from './interpret';
import { pickSoldier } from './picking';

/** A point in logical canvas coordinates. */
export interface ScreenPoint {
  x: number;
  y: number;
}

/** An axis-aligned box in world coordinates, `x0 <= x1` and `y0 <= y1`. */
export interface WorldBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** True when a left press at `at` may start a drag: no own soldier a click could select is under it. */
export function startsDrag(state: BattleState, projection: Projection, at: ScreenPoint, side: Side): boolean {
  const w = projection.screenToWorld(at.x, at.y);
  return !selectable(pickSoldier(state, w.x, w.y, PICK_RADIUS), side);
}

/** True once the pointer has travelled far enough from `start` for the press to be a drag. */
export function isDrag(start: ScreenPoint, end: ScreenPoint): boolean {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return dx * dx + dy * dy > DRAG_SELECT_THRESHOLD * DRAG_SELECT_THRESHOLD;
}

/**
 * The world box between two screen corners, dragged in any direction.
 * ponytail: maps only the two corners, which holds for the top-down
 * projection; an isometric projection would need all four corners and a
 * point-in-quad test.
 */
export function dragWorldBox(projection: Projection, start: ScreenPoint, end: ScreenPoint): WorldBox {
  const a: WorldPoint = projection.screenToWorld(start.x, start.y);
  const b: WorldPoint = projection.screenToWorld(end.x, end.y);
  return { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) };
}

/** The selection and commands for a left press at `start` released at `end`, both in screen coordinates. */
export function interpretDrag(
  state: BattleState,
  selection: readonly number[],
  projection: Projection,
  start: ScreenPoint,
  end: ScreenPoint,
  shift: boolean,
  side: Side,
): InputResult {
  if (!isDrag(start, end)) {
    const w = projection.screenToWorld(start.x, start.y);
    return interpretClick(state, selection, 'left', w.x, w.y, shift, side);
  }
  const box = dragWorldBox(projection, start, end);
  const inside = state.soldiers
    .filter((s) => selectable(s, side) && s.x >= box.x0 && s.x <= box.x1 && s.y >= box.y0 && s.y <= box.y1)
    .map((s) => s.id);
  if (inside.length === 0 || !shift) {
    return select(state, selection, inside, side);
  }
  return select(state, selection, [...selection, ...inside.filter((id) => !selection.includes(id))], side);
}
