/**
 * Firing-position search for the computer opponent: the best tile from
 * which a soldier could fire at its target, scored for cover, distance
 * (Launcher only), travel, and a little seeded jitter.
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
  AI_RANGE_FRACTION,
  AI_TRAVEL_WEIGHT,
  TILE_OPEN,
  WEAPONS,
} from './constants';
import { hasLineOfSight } from './los';
import { isBlocked, tileCenter, tileIndex, worldToTile } from './map';
import { isActive } from './soldiers';
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
 * The best tile for `s` to fire at `target` from, or null when no tile
 * qualifies. A tile qualifies when it is open, holds no other standing
 * soldier (and is not shared by two), lies within `AI_RANGE_FRACTION` of the weapon range from the
 * target and, for direct weapons, has line of sight to the target.
 */
export function bestFiringTile(
  state: BattleState,
  s: Soldier,
  target: Soldier,
  occupied: readonly number[],
  rng: Rng,
): TileCoord | null {
  const map = state.map;
  const weapon = WEAPONS[s.cls];
  const range = weapon.range;
  const reach = range * AI_RANGE_FRACTION;
  const reach2 = reach * reach;
  const needsSight = weapon.shot === 'direct';
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
      if (isBlocked(map, tx, ty)) {
        continue;
      }
      const holder = occupied[tileIndex(map, tx, ty)];
      if (holder === TILE_SHARED || (holder !== TILE_FREE && holder !== s.id)) {
        continue;
      }
      const centre = tileCenter(tx, ty);
      const toTarget2 = dist2(centre.x, centre.y, target.x, target.y);
      if (toTarget2 > reach2) {
        continue;
      }
      if (needsSight && !hasLineOfSight(map, centre.x, centre.y, target.x, target.y)) {
        continue;
      }
      let score = besideCover(map, tx, ty) ? AI_COVER_BONUS : 0;
      if (isLauncher) {
        score += (AI_LAUNCHER_DISTANCE_WEIGHT * Math.sqrt(toTarget2)) / range;
      }
      score -= (AI_TRAVEL_WEIGHT * Math.sqrt(dist2(centre.x, centre.y, s.x, s.y))) / range;
      score += rng.next() * AI_JITTER;
      if (best === null || score > bestScore) {
        best = { tx, ty };
        bestScore = score;
      }
    }
  }
  return best;
}
