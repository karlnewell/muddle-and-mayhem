/**
 * Mouse and keyboard to commands (spec 4.3). Pure functions: they take the
 * state, the current selection and the input, and return the new selection
 * plus the commands to queue, every one tagged with `state.tick` and the
 * player's side. Selection lives here, not in the sim, so it changes while
 * paused; each change is mirrored as a `select` command for the log.
 *
 * Rules: left click on an own standing or downed soldier selects it (shift
 * adds); on anything else it clears. Right click on a standing enemy
 * attacks; on a downed friendly calls the medic; anywhere else moves the
 * standing selected soldiers. `H` holds, `M` calls the medic for the first
 * downed soldier in the selection that no medic is already running to, so a
 * second press helps the next one, 1-5 select by slot, Space toggles pause,
 * Escape toggles the menu, D toggles the debug overlay.
 */
import { PICK_RADIUS } from '../render/renderConstants';
import { CLASS_ORDER, soldierById } from '../sim';
import type { BattleState, Command, Side, Soldier } from '../sim';
import { DEBUG_KEY, HOLD_KEY, MEDIC_KEY, MENU_KEY, PAUSE_KEY, SLOT_KEYS } from './keys';
import { pickSoldier } from './picking';

export type Button = 'left' | 'right';

export interface InputResult {
  selection: number[];
  commands: Command[];
  togglePause?: boolean;
  toggleMenu?: boolean;
  toggleDebug?: boolean;
}

function sameIds(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

/** The new selection plus, when it changed, the `select` command that records it. */
function select(state: BattleState, previous: readonly number[], next: number[], side: Side): InputResult {
  const commands: Command[] = sameIds(previous, next) ? [] : [{ tick: state.tick, side, type: 'select', soldierIds: next }];
  return { selection: next, commands };
}

function withAdded(previous: readonly number[], id: number, shift: boolean): number[] {
  if (!shift) {
    return [id];
  }
  return previous.includes(id) ? [...previous] : [...previous, id];
}

/** Standing soldiers of `side` among the selection, in selection order. */
function standingSelected(state: BattleState, selection: readonly number[], side: Side): number[] {
  const ids: number[] = [];
  for (const id of selection) {
    const s = soldierById(state, id);
    if (s !== undefined && s.side === side && s.status === 'standing') {
      ids.push(id);
    }
  }
  return ids;
}

/** True when a medic run is already heading for soldier `id`. */
function runUnderWay(state: BattleState, id: number): boolean {
  return state.medics.some((m) => m.targetId === id);
}

function selectable(s: Soldier | null, side: Side): s is Soldier {
  return s !== null && s.side === side && s.status !== 'dead';
}

export function interpretClick(
  state: BattleState,
  selection: readonly number[],
  button: Button,
  x: number,
  y: number,
  shift: boolean,
  side: Side,
): InputResult {
  const hit = pickSoldier(state, x, y, PICK_RADIUS);
  if (button === 'left') {
    if (selectable(hit, side)) {
      return select(state, selection, withAdded(selection, hit.id, shift), side);
    }
    return select(state, selection, [], side);
  }
  const keep = [...selection];
  if (hit !== null && hit.side !== side && hit.status === 'standing') {
    const ids = standingSelected(state, selection, side);
    if (ids.length === 0) {
      return { selection: keep, commands: [] };
    }
    return { selection: keep, commands: [{ tick: state.tick, side, type: 'attack', soldierIds: ids, targetId: hit.id }] };
  }
  if (hit !== null && hit.side === side && hit.status === 'downed') {
    return { selection: keep, commands: [{ tick: state.tick, side, type: 'medic', targetId: hit.id }] };
  }
  const ids = standingSelected(state, selection, side);
  if (ids.length === 0) {
    return { selection: keep, commands: [] };
  }
  return { selection: keep, commands: [{ tick: state.tick, side, type: 'move', soldierIds: ids, x, y }] };
}

/** The id of the soldier in `side`'s slot (0-4, class order), or null if the slot is dead or missing. */
function slotSoldier(state: BattleState, side: Side, slot: number): Soldier | null {
  const sideIndex = side === 'blue' ? 0 : 1;
  const s = soldierById(state, sideIndex * CLASS_ORDER.length + slot);
  return s !== undefined && s.side === side && s.status !== 'dead' ? s : null;
}

export function interpretKey(state: BattleState, selection: readonly number[], key: string, shift: boolean, side: Side): InputResult {
  const keep = [...selection];
  if (key === PAUSE_KEY) {
    return { selection: keep, commands: [], togglePause: true };
  }
  if (key === MENU_KEY) {
    return { selection: keep, commands: [], toggleMenu: true };
  }
  const slot = SLOT_KEYS.indexOf(key);
  if (slot >= 0) {
    const s = slotSoldier(state, side, slot);
    if (s === null) {
      return select(state, selection, shift ? keep : [], side);
    }
    return select(state, selection, withAdded(selection, s.id, shift), side);
  }
  const lower = key.toLowerCase();
  if (lower === DEBUG_KEY) {
    return { selection: keep, commands: [], toggleDebug: true };
  }
  if (lower === HOLD_KEY) {
    const ids = standingSelected(state, selection, side);
    if (ids.length === 0) {
      return { selection: keep, commands: [] };
    }
    return { selection: keep, commands: [{ tick: state.tick, side, type: 'hold', soldierIds: ids }] };
  }
  if (lower === MEDIC_KEY) {
    for (const id of selection) {
      const s = soldierById(state, id);
      if (s !== undefined && s.side === side && s.status === 'downed' && !runUnderWay(state, s.id)) {
        return { selection: keep, commands: [{ tick: state.tick, side, type: 'medic', targetId: s.id }] };
      }
    }
    return { selection: keep, commands: [] };
  }
  return { selection: keep, commands: [] };
}
