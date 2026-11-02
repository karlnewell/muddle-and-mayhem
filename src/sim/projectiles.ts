/**
 * Projectile flight and impacts for one tick, in array order. A direct
 * projectile sweeps the segment from its current position to its next one
 * against cover tiles and every standing enemy, so a fast round cannot skip
 * over a soldier between two ticks (never point samples). The earliest hit
 * along the segment wins; a soldier beats cover on an exact tie. Friendlies
 * and the owner are passed through. A round that reaches its maximum
 * distance vanishes without detonating. Lobbed projectiles are Task 8.
 *
 * Removal rebuilds the array in order, so survivors keep their sequence and
 * the rng (instant-kill rolls inside `applyDamage`) is consumed the same way
 * on every run.
 */
import type { BattleState, Projectile, Soldier } from './types';
import { SOLDIER_RADIUS, WEAPONS } from './constants';
import { applyDamage, applySplash } from './damage';
import { firstCoverHit } from './los';
import { mapHeightUnits, mapWidthUnits } from './map';
import { isActive } from './soldiers';

/**
 * Smallest t in [0, 1] at which the segment p + t*d enters the circle of
 * radius r about c, or null when it never does. A start point already inside
 * (or on) the circle counts as t = 0. Solves |f + t d|^2 = r^2 with the
 * quadratic formula, using Math.sqrt only.
 */
function segmentCircleEntry(
  px: number, py: number, dx: number, dy: number, cx: number, cy: number, r: number,
): number | null {
  const fx = px - cx;
  const fy = py - cy;
  const c = fx * fx + fy * fy - r * r;
  if (c <= 0) {
    return 0;
  }
  const a = dx * dx + dy * dy;
  if (a === 0) {
    return null;
  }
  const b = 2 * (fx * dx + fy * dy);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) {
    return null;
  }
  const t = (-b - Math.sqrt(discriminant)) / (2 * a);
  if (t < 0 || t > 1) {
    return null;
  }
  return t;
}

/** Advance a direct projectile one tick; true when it stays in play. */
function advanceDirect(state: BattleState, p: Projectile): boolean {
  const weapon = WEAPONS[p.weapon];
  p.prevX = p.x;
  p.prevY = p.y;
  const nextX = p.x + p.vx;
  const nextY = p.y + p.vy;

  let hitT: number | null = null;
  let hitSoldier: Soldier | null = null;
  for (const s of state.soldiers) {
    if (s.side === p.side || !isActive(s)) {
      continue;
    }
    const t = segmentCircleEntry(p.x, p.y, p.vx, p.vy, s.x, s.y, SOLDIER_RADIUS);
    if (t !== null && (hitT === null || t < hitT)) {
      hitT = t;
      hitSoldier = s;
    }
  }
  // Cover replaces a soldier hit only when strictly earlier: soldier wins an exact tie.
  const tCover = firstCoverHit(state.map, p.x, p.y, nextX, nextY);
  if (tCover !== null && (hitT === null || tCover < hitT)) {
    hitT = tCover;
    hitSoldier = null;
  }

  if (hitT !== null) {
    const ix = p.x + p.vx * hitT;
    const iy = p.y + p.vy * hitT;
    if (hitSoldier !== null) {
      applyDamage(state, hitSoldier, weapon.damage, p.weapon);
      if (weapon.splashRadius > 0) {
        applySplash(state, ix, iy, weapon.splashRadius, weapon.splashDamage, p.weapon, hitSoldier.id);
      }
    } else if (weapon.splashRadius > 0) {
      applySplash(state, ix, iy, weapon.splashRadius, weapon.splashDamage, p.weapon, null);
    }
    state.events.push({ kind: 'impact', x: ix, y: iy, weapon: p.weapon, radius: weapon.splashRadius });
    return false;
  }

  p.x = nextX;
  p.y = nextY;
  p.travelled += weapon.speed; // invariant: fireDirect always sets |v| = weapon.speed, so this is the segment length
  if (p.travelled >= p.maxDistance) {
    return false;
  }
  const map = state.map;
  return p.x >= 0 && p.y >= 0 && p.x <= mapWidthUnits(map) && p.y <= mapHeightUnits(map);
}

/** Advance every projectile one tick in array order, resolving impacts, removing finished ones. */
export function advanceProjectiles(state: BattleState): void {
  const kept: Projectile[] = [];
  for (const p of state.projectiles) {
    let alive: boolean;
    if (p.kind === 'direct') {
      alive = advanceDirect(state, p);
    } else {
      // Task 8: lobbed flight and landing.
      alive = true;
    }
    if (alive) {
      kept.push(p);
    }
  }
  state.projectiles = kept;
}
