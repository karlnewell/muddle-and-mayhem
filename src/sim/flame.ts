/**
 * The Scorcher's flame cone. There is no projectile: on every tick a
 * standing scorcher whose `firing` flag is set (fireWeapons sets it whenever
 * chooseTarget found a target this tick) burns every other standing soldier,
 * both sides, that stands within range, inside the cone around its facing,
 * and in line of sight. Damage is `WEAPONS.scorcher.damage` per soldier per
 * tick, with no cooldown.
 *
 * The cone test is a dot product against a precomputed cosine, so no
 * trigonometry is needed: a point is inside when
 * `dot(face, toTarget) >= FLAME_CONE_COS * |toTarget|`.
 *
 * Rng discipline: scorchers are visited in ascending id order and their
 * victims in ascending id order, so the instant-kill rolls inside
 * `applyDamage` are consumed in the same order on every run.
 */
import type { BattleState, Soldier } from './types';
import { FLAME_CONE_COS, WEAPONS } from './constants';
import { applyDamage } from './damage';
import { hasLineOfSight } from './los';
import { isActive } from './soldiers';
import { dot, length } from './vec';

/**
 * True when (x, y) lies within `range` of the soldier and inside the cone
 * around its facing. A point at the soldier's own position counts as inside
 * (zero distance, and 0 >= 0); callers never ask about the soldier itself.
 */
export function inCone(s: Soldier, x: number, y: number, range: number): boolean {
  const dx = x - s.x;
  const dy = y - s.y;
  const d2 = dx * dx + dy * dy;
  if (d2 > range * range) {
    return false;
  }
  return dot(s.faceX, s.faceY, dx, dy) >= FLAME_CONE_COS * length(dx, dy);
}

/** Each standing scorcher with `firing` true damages every standing soldier (both sides, not itself) within range, inside the cone, and in line of sight. */
export function applyFlame(state: BattleState): void {
  const weapon = WEAPONS.scorcher;
  for (const s of state.soldiers) {
    if (s.cls !== 'scorcher' || !isActive(s) || !s.firing) {
      continue;
    }
    for (const target of state.soldiers) {
      if (target.id === s.id || !isActive(target)) {
        continue;
      }
      if (!inCone(s, target.x, target.y, weapon.range)) {
        continue;
      }
      if (!hasLineOfSight(state.map, s.x, s.y, target.x, target.y)) {
        continue;
      }
      applyDamage(state, target, weapon.damage, 'scorcher', s.id);
    }
  }
}
