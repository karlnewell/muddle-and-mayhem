/**
 * Target selection. A soldier may fire at an enemy that is standing, within
 * its weapon's range and, for weapons whose shot travels in a straight line
 * (direct) or burns in a cone (flame), in line of sight. Lobbed shots arc
 * over cover and need range only.
 *
 * `chooseTarget` honours an attack order first; otherwise it takes the
 * nearest fireable enemy by squared distance. `state.soldiers` is stored in
 * ascending id order and a strictly-closer rule is used, so ties go to the
 * lower id on every run.
 */
import type { BattleState, Soldier } from './types';
import { WEAPONS } from './constants';
import { hasLineOfSight } from './los';
import { isActive, soldierById } from './soldiers';
import { dist2 } from './vec';

/** True when the target's centre is within the shooter's weapon range (squared comparison). */
export function inRange(s: Soldier, target: Soldier): boolean {
  const range = WEAPONS[s.cls].range;
  return dist2(s.x, s.y, target.x, target.y) <= range * range;
}

/** In range, and for direct/flame weapons also in line of sight. Target must be standing and on the other side. */
export function canFireAt(state: BattleState, s: Soldier, target: Soldier): boolean {
  if (target.side === s.side || !isActive(target)) {
    return false;
  }
  if (!inRange(s, target)) {
    return false;
  }
  if (WEAPONS[s.cls].shot === 'lobbed') {
    return true;
  }
  return hasLineOfSight(state.map, s.x, s.y, target.x, target.y);
}

/** Attack-order target when fireable, else the nearest fireable enemy by squared distance (ties: lower id), else null. */
export function chooseTarget(state: BattleState, s: Soldier): Soldier | null {
  if (s.order.kind === 'attack') {
    const ordered = soldierById(state, s.order.targetId);
    if (ordered !== undefined && canFireAt(state, s, ordered)) {
      return ordered;
    }
  }
  let best: Soldier | null = null;
  let bestD2 = 0;
  for (const t of state.soldiers) {
    if (!canFireAt(state, s, t)) {
      continue;
    }
    const d2 = dist2(s.x, s.y, t.x, t.y);
    if (best === null || d2 < bestD2) {
      best = t;
      bestD2 = d2;
    }
  }
  return best;
}
