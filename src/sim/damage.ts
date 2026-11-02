/**
 * Damage and its outcomes. A hit lowers hp; at zero the soldier goes down,
 * or dies outright when the weapon can instant-kill and the battle stream
 * says so. Downed and dead soldiers ignore damage entirely. Splash applies
 * the same rule to every standing soldier inside a circle, both sides.
 *
 * Rng discipline: the stream is consulted only when a hit downs a soldier
 * with an instant-kill weapon, and callers iterate soldiers in ascending id
 * order, so replays consume the stream identically.
 */
import type { BattleState, Soldier, SoldierClass } from './types';
import { INSTANT_KILL_CHANCE, WEAPONS } from './constants';
import { isActive } from './soldiers';
import { dist2 } from './vec';

/**
 * Apply damage from `weapon`, fired by soldier `sourceId`, to a soldier.
 * Downed and dead soldiers ignore it. Emits damage/downed/killed events;
 * the damage event names the source so a report can tell friendly splash
 * from an enemy's.
 */
export function applyDamage(state: BattleState, target: Soldier, amount: number, weapon: SoldierClass, sourceId: number): void {
  if (!isActive(target)) {
    return;
  }
  target.hp = Math.max(0, target.hp - amount);
  state.events.push({ kind: 'damage', soldierId: target.id, amount, weapon, sourceId });
  if (target.hp > 0) {
    return;
  }
  const killed = WEAPONS[weapon].instantKill && state.rng.chance(INSTANT_KILL_CHANCE);
  target.status = killed ? 'dead' : 'downed';
  target.downedTick = state.tick;
  target.order = { kind: 'hold' };
  target.path = [];
  target.targetId = null;
  target.firing = false;
  if (killed) {
    state.events.push({ kind: 'killed', soldierId: target.id });
  } else {
    state.events.push({ kind: 'downed', soldierId: target.id });
  }
}

/**
 * Splash from a point: every standing soldier within radius, both sides,
 * except `excludeId`, in id order. A soldier counts as inside when its
 * centre is within the radius; the soldier's own radius is not added.
 * `state.soldiers` is stored in ascending id order, which gives the order.
 */
export function applySplash(
  state: BattleState, x: number, y: number, radius: number, amount: number,
  weapon: SoldierClass, excludeId: number | null, sourceId: number,
): void {
  const radius2 = radius * radius;
  for (const s of state.soldiers) {
    if (s.id === excludeId || !isActive(s)) {
      continue;
    }
    if (dist2(s.x, s.y, x, y) <= radius2) {
      applyDamage(state, s, amount, weapon, sourceId);
    }
  }
}
