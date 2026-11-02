/**
 * Firing-position search for the computer opponent: the best tile from
 * which a soldier could fire at its target, scored for cover, distance
 * (Launcher only), travel, spacing from friendlies, a little seeded
 * jitter, and `AI_STAY_BONUS` for the tile the soldier is already heading
 * for, so a fresh jitter draw alone does not send it somewhere else.
 *
 * The scan runs over the bounding box of the target's position plus the
 * weapon range, rows outer and columns inner, and draws exactly one rng
 * number per tile that qualifies, so the rng stream is a function of state.
 * The best tile is the first one to reach the highest score.
 */
import type { Rng } from './rng';
import type { BattleState, Soldier, TileCoord, TileMap } from './types';
import {
  AI_COVER_BONUS,
  AI_JITTER,
  AI_LAUNCHER_DISTANCE_WEIGHT,
  AI_LAUNCHER_STANDOFF,
  AI_RANGE_FRACTION,
  AI_SPACING_PENALTY,
  AI_STAY_BONUS,
  AI_TRAVEL_WEIGHT,
  TILE_OPEN,
  WEAPONS,
} from './constants';
import { hasLineOfSight } from './los';
import { isBlocked, tileCenter, tileIndex, worldToTile } from './map';
import { isActive, soldierById } from './soldiers';
import { clamp, dist2 } from './vec';

/** A tile that holds no standing soldier. */
const TILE_FREE = -1;
/** A tile that two or more standing soldiers share; nobody may pick it. */
const TILE_SHARED = -2;

/**
 * Per tile, the id of the standing soldier whose centre lies in it,
 * `TILE_FREE` for none, or `TILE_SHARED` for two or more. Built once per
 * think so the tile scan does not loop over soldiers.
 */
export function occupancy(state: BattleState): number[] {
  const map = state.map;
  const occupied: number[] = new Array<number>(map.width * map.height).fill(TILE_FREE);
  for (const s of state.soldiers) {
    if (!isActive(s)) {
      continue;
    }
    const t = worldToTile(s.x, s.y);
    if (isBlocked(map, t.tx, t.ty)) {
      continue;
    }
    const index = tileIndex(map, t.tx, t.ty);
    occupied[index] = occupied[index] === TILE_FREE ? s.id : TILE_SHARED;
  }
  return occupied;
}

/** True when (tx, ty) is a cover tile inside the map. Off-map is not cover, unlike `isBlocked`. */
export function isCover(map: TileMap, tx: number, ty: number): boolean {
  return tx >= 0 && ty >= 0 && tx < map.width && ty < map.height && map.tiles[tileIndex(map, tx, ty)] !== TILE_OPEN;
}

/** True when any of the four orthogonal neighbours of (tx, ty) is a cover tile. */
export function besideCover(map: TileMap, tx: number, ty: number): boolean {
  return isCover(map, tx - 1, ty) || isCover(map, tx + 1, ty) || isCover(map, tx, ty - 1) || isCover(map, tx, ty + 1);
}

/**
 * True when one of the eight tiles around (tx, ty) holds a standing friendly
 * of `s` other than `s` itself. Two soldiers on neighbouring tiles stand a
 * tile apart, inside every splash radius, so `bestFiringTile` marks such a
 * tile down by `AI_SPACING_PENALTY`.
 */
export function besideFriendly(state: BattleState, occupied: readonly number[], s: Soldier, tx: number, ty: number): boolean {
  const map = state.map;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) {
        continue;
      }
      const nx = tx + dx;
      const ny = ty + dy;
      if (nx < 0 || ny < 0 || nx >= map.width || ny >= map.height) {
        continue;
      }
      const holder = occupied[tileIndex(map, nx, ny)];
      if (holder === TILE_SHARED) {
        return true;
      }
      if (holder === TILE_FREE || holder === s.id) {
        continue;
      }
      const other = soldierById(state, holder);
      if (other !== undefined && other.side === s.side) {
        return true;
      }
    }
  }
  return false;
}

/**
 * True when (tx, ty) is a firing tile for `s` against `target`: open, holding
 * no other standing soldier (and not shared by two), within
 * `AI_RANGE_FRACTION` of the weapon range from the target and, for direct
 * weapons, in line of sight of the target. Draws no rng.
 */
export function isFiringTile(
  state: BattleState,
  s: Soldier,
  target: Soldier,
  occupied: readonly number[],
  tx: number,
  ty: number,
): boolean {
  const map = state.map;
  if (isBlocked(map, tx, ty)) {
    return false;
  }
  const holder = occupied[tileIndex(map, tx, ty)];
  if (holder === TILE_SHARED || (holder !== TILE_FREE && holder !== s.id)) {
    return false;
  }
  const weapon = WEAPONS[s.cls];
  const reach = weapon.range * AI_RANGE_FRACTION;
  const centre = tileCenter(tx, ty);
  if (dist2(centre.x, centre.y, target.x, target.y) > reach * reach) {
    return false;
  }
  return weapon.shot !== 'direct' || hasLineOfSight(map, centre.x, centre.y, target.x, target.y);
}

/**
 * The Launcher's preference for distance from its target: weight times
 * distance over range, growing only up to `AI_LAUNCHER_STANDOFF` of its
 * reach and flat beyond. Uncapped, a target that stepped a few units
 * reshuffled every far tile's score each think, and tiles far round the
 * target on either side scored alike, so the Launcher's orders swung across
 * the map.
 */
export function launcherDistanceScore(toTarget: number, range: number): number {
  const knee = AI_LAUNCHER_STANDOFF * AI_RANGE_FRACTION * range;
  return (AI_LAUNCHER_DISTANCE_WEIGHT * Math.min(toTarget, knee)) / range;
}

/**
 * The best tile for `s` to fire at `target` from, or null when none
 * qualifies (`isFiringTile`).
 *
 * `stay` is the tile `s` is already moving to, or null. While it still
 * qualifies it scores `AI_STAY_BONUS` more, so the soldier changes
 * destination only when another tile is clearly better (hysteresis). The
 * bonus changes no rng draw.
 */
export function bestFiringTile(
  state: BattleState,
  s: Soldier,
  target: Soldier,
  occupied: readonly number[],
  rng: Rng,
  stay: TileCoord | null = null,
): TileCoord | null {
  const map = state.map;
  const range = WEAPONS[s.cls].range;
  const isLauncher = s.cls === 'launcher';

  const lo = worldToTile(target.x - range, target.y - range);
  const hi = worldToTile(target.x + range, target.y + range);
  const minTx = clamp(lo.tx, 0, map.width - 1);
  const maxTx = clamp(hi.tx, 0, map.width - 1);
  const minTy = clamp(lo.ty, 0, map.height - 1);
  const maxTy = clamp(hi.ty, 0, map.height - 1);

  let best: TileCoord | null = null;
  let bestScore = 0;
  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      if (!isFiringTile(state, s, target, occupied, tx, ty)) {
        continue;
      }
      const centre = tileCenter(tx, ty);
      let score = besideCover(map, tx, ty) ? AI_COVER_BONUS : 0;
      if (besideFriendly(state, occupied, s, tx, ty)) {
        score -= AI_SPACING_PENALTY;
      }
      if (isLauncher) {
        score += launcherDistanceScore(Math.sqrt(dist2(centre.x, centre.y, target.x, target.y)), range);
      }
      score -= (AI_TRAVEL_WEIGHT * Math.sqrt(dist2(centre.x, centre.y, s.x, s.y))) / range;
      score += rng.next() * AI_JITTER;
      if (stay !== null && stay.tx === tx && stay.ty === ty) {
        score += AI_STAY_BONUS;
      }
      if (best === null || score > bestScore) {
        best = { tx, ty };
        bestScore = score;
      }
    }
  }
  return best;
}
