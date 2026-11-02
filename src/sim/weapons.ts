/**
 * The firing phase. Every standing soldier, in ascending id order, counts
 * its cooldown down, picks a target, turns to face it, and discharges its
 * weapon according to the shot kind. Direct weapons (Gunner, Launcher) push
 * a projectile; lobbed and flame weapons are filled in by later tasks.
 *
 * Rng discipline per direct shot: `int(16)` for the scatter direction,
 * `next()` for the scatter distance, then (Gunner only) the jam roll. Every
 * shot consumes the first two draws whatever the spread, so the stream's
 * shape never depends on tuning.
 */
import type { BattleState, Soldier, Vec2 } from './types';
import type { WeaponStats } from './constants';
import {
  DIRECTIONS16, FIRE_WHILE_MOVING, GUNNER_JAM_CHANCE, GUNNER_JAM_TICKS, TILE_SIZE, WEAPONS,
} from './constants';
import { faceToward, isActive } from './soldiers';
import { chooseTarget } from './targeting';
import { normalize } from './vec';

/** Aim point = target position + DIRECTIONS16[rng.int(16)] * (rng.next() * spread). Exposed for tests. */
export function scatterAim(state: BattleState, target: Soldier, spread: number): Vec2 {
  const dir = DIRECTIONS16[state.rng.int(DIRECTIONS16.length)];
  const distance = state.rng.next() * spread;
  return { x: target.x + dir.x * distance, y: target.y + dir.y * distance };
}

/** Launch a direct projectile at a scattered aim point and start the cooldown; a Gunner may jam. */
function fireDirect(state: BattleState, s: Soldier, target: Soldier, weapon: WeaponStats): void {
  const aim = scatterAim(state, target, weapon.spread);
  const dir = normalize(aim.x - s.x, aim.y - s.y);
  state.projectiles.push({
    id: state.nextProjectileId++,
    kind: 'direct',
    weapon: s.cls,
    side: s.side,
    ownerId: s.id,
    x: s.x,
    y: s.y,
    prevX: s.x,
    prevY: s.y,
    vx: dir.x * weapon.speed,
    vy: dir.y * weapon.speed,
    startX: s.x,
    startY: s.y,
    targetX: aim.x,
    targetY: aim.y,
    launchTick: state.tick,
    landTick: -1,
    travelled: 0,
    maxDistance: weapon.range + TILE_SIZE,
  });
  s.cooldown = weapon.cooldown;
  state.events.push({ kind: 'shot', soldierId: s.id, weapon: s.cls });
  if (s.cls === 'gunner' && state.rng.chance(GUNNER_JAM_CHANCE)) {
    s.cooldown = GUNNER_JAM_TICKS;
    state.events.push({ kind: 'jam', soldierId: s.id });
  }
}

/** Firing phase for one tick: every standing soldier in id order. */
export function fireWeapons(state: BattleState): void {
  for (const s of state.soldiers) {
    if (!isActive(s)) {
      continue;
    }
    s.targetId = null;
    s.firing = false;
    s.cooldown = Math.max(0, s.cooldown - 1);
    if (s.cooldown > 0) {
      continue;
    }
    if (!FIRE_WHILE_MOVING && s.order.kind === 'move') {
      continue;
    }
    const target = chooseTarget(state, s);
    if (target === null) {
      continue;
    }
    faceToward(s, target.x - s.x, target.y - s.y);
    const weapon = WEAPONS[s.cls];
    if (weapon.shot === 'direct') {
      fireDirect(state, s, target, weapon);
    } else if (weapon.shot === 'lobbed') {
      // Task 8: lobbed grenades and dynamite.
    } else {
      // Task 9: flame cone.
    }
    s.targetId = target.id;
    s.firing = true;
  }
}
