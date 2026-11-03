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
 * Escape toggles the menu, D toggles the debug overlay. `A` is the volley:
 * every standing soldier on the side, selected or not, attacks the standing
 * enemy nearest the cursor (world coordinates; ties to the lower id) without
 * moving: a stand-fast order, so each fires from where it stands. `S`
 * selects the whole squad, standing and downed, as a click would.
 */
import { PICK_RADIUS } from '../render/renderConstants';
import { CLASS_ORDER, soldierById } from '../sim';
import type { BattleState, Command, Side, Soldier } from '../sim';
import { DEBUG_KEY, HOLD_KEY, MEDIC_KEY, MENU_KEY, PAUSE_KEY, SELECT_ALL_KEY, SLOT_KEYS, VOLLEY_KEY } from './keys';
import { pickSoldier } from './picking';

export type Button = 'left' | 'right';

/** A point in world coordinates, such as the cursor over the battlefield. */
export interface WorldPoint {
  x: number;
  y: number;
}

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

/** Every standing soldier of `side`, in id order. */
function standingSquad(state: BattleState, side: Side): number[] {
  return state.soldiers.filter((s) => s.side === side && s.status === 'standing').map((s) => s.id);
}

/** Every soldier of `side` a click could select (standing or downed), in id order. */
function selectableSquad(state: BattleState, side: Side): number[] {
  return state.soldiers.filter((s) => selectable(s, side)).map((s) => s.id);
}

/** The standing enemy of `side` nearest `p` by squared distance, ties to the lower id; null if none stands. */
function nearestStandingEnemy(state: BattleState, side: Side, p: WorldPoint): Soldier | null {
  let best: Soldier | null = null;
  let bestD2 = 0;
  for (const s of state.soldiers) {
    if (s.side === side || s.status !== 'standing') {
      continue;
    }
    const dx = s.x - p.x;
    const dy = s.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (best === null || d2 < bestD2 || (d2 === bestD2 && s.id < best.id)) {
      best = s;
      bestD2 = d2;
    }
  }
  return best;
}

/** The volley: the whole standing squad attacks the standing enemy nearest the cursor, standing fast. */
function volley(state: BattleState, selection: readonly number[], side: Side, cursor: WorldPoint | null): InputResult {
  const keep = [...selection];
  const target = cursor === null ? null : nearestStandingEnemy(state, side, cursor);
  const ids = standingSquad(state, side);
  if (target === null || ids.length === 0) {
    return { selection: keep, commands: [] };
  }
  return { selection: keep, commands: [{ tick: state.tick, side, type: 'attack', soldierIds: ids, targetId: target.id, stand: true }] };
}

/** The id of the soldier in `side`'s slot (0-4, class order), or null if the slot is dead or missing. */
function slotSoldier(state: BattleState, side: Side, slot: number): Soldier | null {
  const sideIndex = side === 'blue' ? 0 : 1;
  const s = soldierById(state, sideIndex * CLASS_ORDER.length + slot);
  return s !== undefined && s.side === side && s.status !== 'dead' ? s : null;
}

/**
 * A key press. `cursor` is the pointer's last position over the canvas in
 * world coordinates, or null when it has not been over the canvas; only the
 * volley reads it.
 */
export function interpretKey(
  state: BattleState,
  selection: readonly number[],
  key: string,
  shift: boolean,
  side: Side,
  cursor: WorldPoint | null = null,
): InputResult {
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
  if (lower === SELECT_ALL_KEY) {
    return select(state, selection, selectableSquad(state, side), side);
  }
  if (lower === VOLLEY_KEY) {
    return volley(state, selection, side, cursor);
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
