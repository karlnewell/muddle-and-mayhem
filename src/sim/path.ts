/**
 * A* pathfinding on the tile grid.
 *
 * 8-connected: a diagonal step is allowed only when both of its orthogonal
 * neighbours are open, so a soldier never slips between two cover tiles that
 * touch at a corner. Orthogonal steps cost 1, diagonal steps SQRT2, and the
 * heuristic is the octile distance, which is admissible for these costs.
 *
 * Determinism: the open list is a binary heap ordered by f, then h, then
 * insertion sequence, so ties resolve the same way on every run and in every
 * engine. Neighbours are expanded in a fixed order (E, W, S, N, SE, SW, NE,
 * NW); g and closed tables are plain arrays indexed by tile index; the extra
 * `blocked` set is only ever asked for membership, never iterated.
 */
import type { TileCoord, TileMap, Vec2 } from './types';
import { isBlocked, tileCenter, tileIndex } from './map';

export const SQRT2 = 1.4142135623730951;

// Neighbour offsets in the fixed expansion order E, W, S, N, SE, SW, NE, NW.
const NEIGHBOUR_DX: readonly number[] = [1, -1, 0, 0, 1, -1, 1, -1];
const NEIGHBOUR_DY: readonly number[] = [0, 0, 1, -1, 1, 1, -1, -1];
const ORTHOGONAL_COUNT = 4;

/** One open-list entry. `seq` breaks ties among equal f and h. */
interface HeapNode {
  index: number;
  f: number;
  h: number;
  seq: number;
}

/** True when `a` should be popped before `b`. */
function before(a: HeapNode, b: HeapNode): boolean {
  if (a.f !== b.f) {
    return a.f < b.f;
  }
  if (a.h !== b.h) {
    return a.h < b.h;
  }
  return a.seq < b.seq;
}

/** Minimal binary min-heap over HeapNode, ordered by `before`. */
class MinHeap {
  private readonly items: HeapNode[] = [];

  get size(): number {
    return this.items.length;
  }

  push(node: HeapNode): void {
    const items = this.items;
    items.push(node);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!before(items[i], items[parent])) {
        break;
      }
      const tmp = items[i];
      items[i] = items[parent];
      items[parent] = tmp;
      i = parent;
    }
  }

  pop(): HeapNode {
    const items = this.items;
    const top = items[0];
    const end = items.pop() as HeapNode;
    if (items.length > 0) {
      items[0] = end;
      let i = 0;
      const n = items.length;
      for (;;) {
        const left = 2 * i + 1;
        const right = left + 1;
        let smallest = i;
        if (left < n && before(items[left], items[smallest])) {
          smallest = left;
        }
        if (right < n && before(items[right], items[smallest])) {
          smallest = right;
        }
        if (smallest === i) {
          break;
        }
        const tmp = items[i];
        items[i] = items[smallest];
        items[smallest] = tmp;
        i = smallest;
      }
    }
    return top;
  }
}

/** Octile distance: the exact cost of the cheapest path on an empty grid. */
function octile(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(bx - ax);
  const dy = Math.abs(by - ay);
  return dx + dy + (SQRT2 - 2) * Math.min(dx, dy);
}

/** True when the tile is cover, outside the map, or in the extra blocked set. */
function blocksMovement(map: TileMap, blocked: ReadonlySet<number> | undefined, tx: number, ty: number): boolean {
  if (isBlocked(map, tx, ty)) {
    return true;
  }
  return blocked !== undefined && blocked.has(tileIndex(map, tx, ty));
}

/**
 * Tile path from start to goal, excluding start and including goal, or null if unreachable.
 * 8-connected; diagonal steps need both orthogonal neighbours open. Cost 1 orthogonal,
 * SQRT2 diagonal; octile heuristic. `blocked` holds extra tile indices to treat as cover
 * (other soldiers' tiles); the goal is always allowed.
 */
export function findPath(
  map: TileMap,
  start: TileCoord,
  goal: TileCoord,
  blocked?: ReadonlySet<number>,
): TileCoord[] | null {
  if (start.tx === goal.tx && start.ty === goal.ty) {
    return [];
  }
  if (isBlocked(map, goal.tx, goal.ty)) {
    return null;
  }
  // A start outside the map has no tile index; cover under the start is allowed so a
  // soldier somehow standing on it can still walk out.
  if (start.tx < 0 || start.ty < 0 || start.tx >= map.width || start.ty >= map.height) {
    return null;
  }

  const size = map.width * map.height;
  const g: number[] = new Array<number>(size).fill(Infinity);
  const parent: number[] = new Array<number>(size).fill(-1);
  const closed: boolean[] = new Array<boolean>(size).fill(false);
  const heap = new MinHeap();
  let seq = 0;

  const startIndex = tileIndex(map, start.tx, start.ty);
  const goalIndex = tileIndex(map, goal.tx, goal.ty);
  g[startIndex] = 0;
  const h0 = octile(start.tx, start.ty, goal.tx, goal.ty);
  heap.push({ index: startIndex, f: h0, h: h0, seq: seq++ });

  while (heap.size > 0) {
    const node = heap.pop();
    const current = node.index;
    if (closed[current]) {
      continue; // a stale duplicate; the tile was reached more cheaply already
    }
    if (current === goalIndex) {
      return reconstruct(map, parent, startIndex, goalIndex);
    }
    closed[current] = true;

    const cx = current - Math.floor(current / map.width) * map.width;
    const cy = (current - cx) / map.width;
    const gc = g[current];

    for (let i = 0; i < NEIGHBOUR_DX.length; i++) {
      const dx = NEIGHBOUR_DX[i];
      const dy = NEIGHBOUR_DY[i];
      const nx = cx + dx;
      const ny = cy + dy;
      if (isBlocked(map, nx, ny)) {
        continue;
      }
      const next = tileIndex(map, nx, ny);
      if (closed[next]) {
        continue;
      }
      // The goal may sit on another soldier's tile; every other tile in the set is cover.
      if (next !== goalIndex && blocked !== undefined && blocked.has(next)) {
        continue;
      }
      const diagonal = i >= ORTHOGONAL_COUNT;
      if (diagonal && (blocksMovement(map, blocked, cx + dx, cy) || blocksMovement(map, blocked, cx, cy + dy))) {
        continue;
      }
      const tentative = gc + (diagonal ? SQRT2 : 1);
      if (tentative >= g[next]) {
        continue;
      }
      g[next] = tentative;
      parent[next] = current;
      const h = octile(nx, ny, goal.tx, goal.ty);
      heap.push({ index: next, f: tentative + h, h, seq: seq++ });
    }
  }
  return null;
}

/** Walk the parent chain back from the goal and return it start-to-goal, start excluded. */
function reconstruct(map: TileMap, parent: readonly number[], startIndex: number, goalIndex: number): TileCoord[] {
  const reversed: TileCoord[] = [];
  let index = goalIndex;
  while (index !== startIndex) {
    const tx = index - Math.floor(index / map.width) * map.width;
    const ty = (index - tx) / map.width;
    reversed.push({ tx, ty });
    index = parent[index];
  }
  const path: TileCoord[] = [];
  for (let i = reversed.length - 1; i >= 0; i--) {
    path.push(reversed[i]);
  }
  return path;
}

/** World-unit waypoints: the centres of the path tiles, with the last replaced by `dest` when given. */
export function pathToWaypoints(path: TileCoord[], dest?: Vec2): Vec2[] {
  const waypoints: Vec2[] = [];
  for (let i = 0; i < path.length; i++) {
    waypoints.push(tileCenter(path[i].tx, path[i].ty));
  }
  if (dest !== undefined && waypoints.length > 0) {
    waypoints[waypoints.length - 1] = { x: dest.x, y: dest.y };
  }
  return waypoints;
}
