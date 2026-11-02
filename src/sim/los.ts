/**
 * Line of sight over the tile grid: a segment in world units is clear when
 * no tile it passes through is cover.
 *
 * Grid traversal after Amanatides and Woo. The start tile is never tested:
 * a soldier stands on open ground, and skipping it lets a shot leave a tile
 * edge cleanly. Each tile entered afterwards is tested in order, and the
 * first blocked one ends the walk. An exact corner (`tMaxX === tMaxY`)
 * tests the x-side neighbour, then the y-side neighbour, then the diagonal
 * tile, so a sight line cannot slip between two cover tiles that touch only
 * at a corner. A zero component of the direction never steps on that axis.
 *
 * The crossing parameters are recomputed from the grid edge after every
 * step, never accumulated: two crossings at the same real t then yield the
 * same double (IEEE division is correctly rounded), so exact corners are
 * detected reliably and the result is the same from either end.
 */
import type { TileMap } from './types';
import { TILE_SIZE } from './constants';
import { isBlocked } from './map';

/** A tMax beyond the end of the segment, used for an axis that never steps. */
const NEVER = 2;

/**
 * Parameter t in [0, 1] along the segment from (ax, ay) to (bx, by) at which
 * it first enters a blocked tile, or null when the whole segment is clear.
 */
export function firstCoverHit(map: TileMap, ax: number, ay: number, bx: number, by: number): number | null {
  const dx = bx - ax;
  const dy = by - ay;

  let tx = Math.floor(ax / TILE_SIZE);
  let ty = Math.floor(ay / TILE_SIZE);
  const endTx = Math.floor(bx / TILE_SIZE);
  const endTy = Math.floor(by / TILE_SIZE);

  const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
  const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;

  // t at which the segment crosses the next tile edge on each axis, from
  // the current tile; recomputed from the edge, never accumulated. The
  // `+ 0` turns the -0 of a start point lying on an edge into +0.
  const nextX = (): number =>
    stepX === 0 ? NEVER : ((stepX > 0 ? tx + 1 : tx) * TILE_SIZE - ax) / dx + 0;
  const nextY = (): number =>
    stepY === 0 ? NEVER : ((stepY > 0 ? ty + 1 : ty) * TILE_SIZE - ay) / dy + 0;

  let tMaxX = nextX();
  let tMaxY = nextY();

  // Each pass either reaches the end tile, leaves the segment, or steps at
  // least one tile toward the end, so the walk is bounded by the map size.
  for (;;) {
    if (tx === endTx && ty === endTy) {
      return null;
    }
    if (tMaxX < tMaxY) {
      const t = tMaxX;
      if (t > 1) {
        return null;
      }
      tx += stepX;
      tMaxX = nextX();
      if (isBlocked(map, tx, ty)) {
        return t;
      }
    } else if (tMaxY < tMaxX) {
      const t = tMaxY;
      if (t > 1) {
        return null;
      }
      ty += stepY;
      tMaxY = nextY();
      if (isBlocked(map, tx, ty)) {
        return t;
      }
    } else {
      // Exact corner: x neighbour, then y neighbour, then the diagonal tile.
      const t = tMaxX;
      if (t > 1) {
        return null;
      }
      if (isBlocked(map, tx + stepX, ty) || isBlocked(map, tx, ty + stepY)) {
        return t;
      }
      tx += stepX;
      ty += stepY;
      tMaxX = nextX();
      tMaxY = nextY();
      if (isBlocked(map, tx, ty)) {
        return t;
      }
    }
  }
}

/** True when no cover tile lies between (ax, ay) and (bx, by). */
export function hasLineOfSight(map: TileMap, ax: number, ay: number, bx: number, by: number): boolean {
  return firstCoverHit(map, ax, ay, bx, by) === null;
}
