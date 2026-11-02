/**
 * The computer opponent. A `Controller` reads the battle state and returns
 * commands; it never mutates the state. This one is deterministic: it draws
 * randomness only from its own stream, seeded from the battle seed and a
 * per-side salt, and only in the firing-position search, so the same seed
 * and the same state always give the same commands.
 *
 * It thinks every `AI_THINK_TICKS` and issues a command only when that
 * would change a soldier's order, so command logs stay small.
 */
import type { Rng } from './rng';
import type { BattleState, Command, Order, Side, Soldier } from './types';
import { bestFiringTile, occupancy } from './aiPositions';
import {
  AI_LOBBER_TARGET_REACH, AI_MEDIC_DESPERATE_STANDING, AI_MEDIC_PATIENCE_TICKS, AI_REVIVE_PRIORITY, AI_SEED_SALT,
  AI_THINK_TICKS, WEAPONS,
} from './constants';
import { hasLineOfSight } from './los';
import { tileCenter, worldToTile } from './map';
import { createRng } from './rng';
import { isActive } from './soldiers';
import { canFireAt } from './targeting';
import { dist2, imod } from './vec';

export interface Controller {
  readonly side: Side;
  /** Commands for this tick, tagged with `state.tick` and the controller's side. */
  think(state: BattleState): Command[];
}

/** Standing soldiers of `side`, in ascending id order (the order of `state.soldiers`). */
function standingOf(state: BattleState, side: Side): Soldier[] {
  const result: Soldier[] = [];
  for (const s of state.soldiers) {
    if (s.side === side && isActive(s)) {
      result.push(s);
    }
  }
  return result;
}

/** The enemy nearest to `s` by squared distance; ties go to the lower id. */
function nearestEnemy(s: Soldier, enemies: readonly Soldier[]): Soldier {
  let best = enemies[0];
  let bestD2 = dist2(s.x, s.y, best.x, best.y);
  for (let i = 1; i < enemies.length; i++) {
    const e = enemies[i];
    const d2 = dist2(s.x, s.y, e.x, e.y);
    if (d2 < bestD2) {
      best = e;
      bestD2 = d2;
    }
  }
  return best;
}

/**
 * Lobbers (Chucker, Blaster) prefer an enemy sheltering behind cover: the
 * nearest one within `AI_LOBBER_TARGET_REACH` times the weapon range that
 * `s` has no line of sight to. Everyone else, and a lobber with no such enemy, takes the nearest.
 */
function preferredTarget(state: BattleState, s: Soldier, enemies: readonly Soldier[]): Soldier {
  const nearest = nearestEnemy(s, enemies);
  if (WEAPONS[s.cls].shot !== 'lobbed') {
    return nearest;
  }
  const reach = AI_LOBBER_TARGET_REACH * WEAPONS[s.cls].range;
  const reach2 = reach * reach;
  let best: Soldier | null = null;
  let bestD2 = 0;
  for (const e of enemies) {
    const d2 = dist2(s.x, s.y, e.x, e.y);
    if (d2 > reach2 || hasLineOfSight(state.map, s.x, s.y, e.x, e.y)) {
      continue;
    }
    if (best === null || d2 < bestD2) {
      best = e;
      bestD2 = d2;
    }
  }
  return best ?? nearest;
}

/** The order `s` should hold now: attack when it can fire or is a Scorcher, else move to a firing tile, else attack. */
function desiredOrder(
  state: BattleState,
  s: Soldier,
  target: Soldier,
  occupied: readonly number[],
  rng: Rng,
): Order {
  if (canFireAt(state, s, target) || s.cls === 'scorcher') {
    return { kind: 'attack', targetId: target.id };
  }
  const tile = bestFiringTile(state, s, target, occupied, rng);
  if (tile === null) {
    return { kind: 'attack', targetId: target.id };
  }
  const centre = tileCenter(tile.tx, tile.ty);
  return { kind: 'move', x: centre.x, y: centre.y };
}

/** True when `desired` would change nothing: the same attack target, or a move to the same tile. */
function alreadyHolds(current: Order, desired: Order): boolean {
  if (desired.kind === 'attack') {
    return current.kind === 'attack' && current.targetId === desired.targetId;
  }
  if (desired.kind === 'move') {
    if (current.kind !== 'move') {
      return false;
    }
    const a = worldToTile(current.x, current.y);
    const b = worldToTile(desired.x, desired.y);
    return a.tx === b.tx && a.ty === b.ty;
  }
  return current.kind === 'hold';
}

/** True when a medic run is already heading for soldier `id`. */
function runUnderWay(state: BattleState, id: number): boolean {
  for (const m of state.medics) {
    if (m.targetId === id) {
      return true;
    }
  }
  return false;
}

/** True when no standing enemy has the body at (x, y) within its own weapon range. */
function bodyIsSafe(x: number, y: number, enemies: readonly Soldier[]): boolean {
  for (const e of enemies) {
    const range = WEAPONS[e.cls].range;
    if (dist2(e.x, e.y, x, y) <= range * range) {
      return false;
    }
  }
  return true;
}

/** Revive priority: `AI_REVIVE_PRIORITY` index first (unknown classes last), then id. */
function revivePriority(s: Soldier): number {
  const index = AI_REVIVE_PRIORITY.indexOf(s.cls);
  return index < 0 ? AI_REVIVE_PRIORITY.length : index;
}

/**
 * True when the AI should revive this body now: it is safe, or the squad is
 * down to fewer than `AI_MEDIC_DESPERATE_STANDING` standing, or the body has
 * lain there for `AI_MEDIC_PATIENCE_TICKS`. Without the last two cases the
 * AI never revived in the mid-map brawl it creates, and ended battles with
 * every call unused.
 */
function worthReviving(state: BattleState, s: Soldier, standing: number, enemies: readonly Soldier[]): boolean {
  if (standing < AI_MEDIC_DESPERATE_STANDING) {
    return true;
  }
  if (state.tick - s.downedTick >= AI_MEDIC_PATIENCE_TICKS) {
    return true;
  }
  return bodyIsSafe(s.x, s.y, enemies);
}

/**
 * The medic command for this think, if any: the first downed friendly with
 * no run under way, by revive priority then id, that `worthReviving` accepts.
 */
function medicCommand(state: BattleState, side: Side, standing: number, enemies: readonly Soldier[]): Command | null {
  if (state.sides[side].medicCalls <= 0) {
    return null;
  }
  const downed: Soldier[] = [];
  for (const s of state.soldiers) {
    if (s.side === side && s.status === 'downed' && !runUnderWay(state, s.id)) {
      downed.push(s);
    }
  }
  downed.sort((a, b) => {
    const pa = revivePriority(a);
    const pb = revivePriority(b);
    return pa !== pb ? pa - pb : a.id - b.id;
  });
  for (const s of downed) {
    if (worthReviving(state, s, standing, enemies)) {
      return { tick: state.tick, side, type: 'medic', targetId: s.id };
    }
  }
  return null;
}

/** Deterministic opponent: own rng from createRng((seed ^ AI_SEED_SALT[side]) >>> 0); acts every AI_THINK_TICKS. */
export function createAi(side: Side, seed: number): Controller {
  const rng = createRng((seed ^ AI_SEED_SALT[side]) >>> 0);
  const enemySide: Side = side === 'blue' ? 'red' : 'blue';

  const think = (state: BattleState): Command[] => {
    if (state.winner !== null || imod(state.tick, AI_THINK_TICKS) !== 0) {
      return [];
    }
    const commands: Command[] = [];
    const enemies = standingOf(state, enemySide);
    const own = standingOf(state, side);
    if (enemies.length > 0) {
      const occupied = occupancy(state);
      for (const s of own) {
        const target = preferredTarget(state, s, enemies);
        const desired = desiredOrder(state, s, target, occupied, rng);
        if (alreadyHolds(s.order, desired)) {
          continue;
        }
        if (desired.kind === 'attack') {
          commands.push({ tick: state.tick, side, type: 'attack', soldierIds: [s.id], targetId: desired.targetId });
        } else if (desired.kind === 'move') {
          commands.push({ tick: state.tick, side, type: 'move', soldierIds: [s.id], x: desired.x, y: desired.y });
        }
      }
    }
    const medic = medicCommand(state, side, own.length, enemies);
    if (medic !== null) {
      commands.push(medic);
    }
    return commands;
  };

  return { side, think };
}
