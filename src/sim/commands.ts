/**
 * Command application. Every player and AI action reaches the simulation as
 * a command; this file turns one into order changes on the soldiers it names.
 * Anything invalid is ignored silently: wrong side, unknown id, non-standing
 * soldier, bad target. Commands never touch the rng.
 */
import type { BattleState, Command, Side, Soldier } from './types';
import { isBlocked, nearestOpenTile, tileCenter, worldToTile } from './map';
import { callMedic } from './medic';
import { planPath } from './movement';
import { isActive, soldierById } from './soldiers';

/** The standing soldiers of `side` among `ids`, in the order given. */
function ownStanding(state: BattleState, side: Side, ids: readonly number[]): Soldier[] {
  const result: Soldier[] = [];
  for (const id of ids) {
    const s = soldierById(state, id);
    if (s !== undefined && s.side === side && isActive(s)) {
      result.push(s);
    }
  }
  return result;
}

/** Record the side's selection: its own soldiers among the ids, whatever their status. */
function applySelect(state: BattleState, side: Side, ids: readonly number[]): void {
  const selected: number[] = [];
  for (const id of ids) {
    const s = soldierById(state, id);
    if (s !== undefined && s.side === side) {
      selected.push(s.id);
    }
  }
  state.sides[side].selected = selected;
}

/**
 * Move order. A point on a blocked tile snaps to the centre of the nearest
 * open tile; a point on an open tile is kept exactly. No path means hold.
 */
function orderMove(state: BattleState, s: Soldier, x: number, y: number): void {
  const tile = worldToTile(x, y);
  let dest = { x, y };
  if (isBlocked(state.map, tile.tx, tile.ty)) {
    const open = nearestOpenTile(state.map, tile.tx, tile.ty);
    dest = tileCenter(open.tx, open.ty);
  }
  const waypoints = planPath(state, s, dest);
  s.stuckTicks = 0;
  s.lastRepathTick = state.tick;
  if (waypoints === null) {
    s.order = { kind: 'hold' };
    s.path = [];
    return;
  }
  s.order = { kind: 'move', x: dest.x, y: dest.y };
  s.path = waypoints;
}

/** Apply one command. Silently ignores anything invalid: wrong side, unknown id, non-standing soldier. */
export function applyCommand(state: BattleState, cmd: Command): void {
  switch (cmd.type) {
    case 'select':
      applySelect(state, cmd.side, cmd.soldierIds);
      break;
    case 'move':
      for (const s of ownStanding(state, cmd.side, cmd.soldierIds)) {
        orderMove(state, s, cmd.x, cmd.y);
        s.orderTick = state.tick;
      }
      break;
    case 'attack': {
      const target = soldierById(state, cmd.targetId);
      if (target === undefined || target.side === cmd.side || !isActive(target)) {
        return;
      }
      for (const s of ownStanding(state, cmd.side, cmd.soldierIds)) {
        // stand is set only when given, so an ordinary attack order serialises as before
        s.order = cmd.stand === true ? { kind: 'attack', targetId: target.id, stand: true } : { kind: 'attack', targetId: target.id };
        s.path = [];
        s.stuckTicks = 0;
        s.orderTick = state.tick;
      }
      break;
    }
    case 'hold':
      for (const s of ownStanding(state, cmd.side, cmd.soldierIds)) {
        s.order = { kind: 'hold' };
        s.path = [];
        s.stuckTicks = 0;
        s.orderTick = state.tick;
      }
      break;
    case 'medic':
      callMedic(state, cmd.side, cmd.targetId);
      break;
  }
}
