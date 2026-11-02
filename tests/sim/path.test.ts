import { describe, expect, it } from 'vitest';
import { parseMap, tileIndex } from '../../src/sim/map';
import { CROSSROADS } from '../../src/sim/maps/crossroads';
import { findPath, pathToWaypoints, SQRT2 } from '../../src/sim/path';
import type { TileCoord, TileMap } from '../../src/sim/types';

/**
 * A 10 by 10 map that is open except for the given wall tiles. Spawns sit
 * along the bottom row (they are open tiles), so walls stay out of row 9.
 */
function openMap(walls: readonly TileCoord[] = []): TileMap {
  const rows: string[][] = [];
  for (let ty = 0; ty < 9; ty++) {
    rows.push('..........'.split(''));
  }
  rows.push('bbbbbrrrrr'.split(''));
  for (const w of walls) {
    rows[w.ty][w.tx] = '#';
  }
  return parseMap('Open', rows.map((r) => r.join('')));
}

/** The wall at column 4, rows 0 to 8, leaving only row 9 as the way round. */
function wallMap(): TileMap {
  const walls: TileCoord[] = [];
  for (let ty = 0; ty <= 8; ty++) {
    walls.push({ tx: 4, ty });
  }
  return openMap(walls);
}

function last<T>(items: T[]): T {
  return items[items.length - 1];
}

describe('findPath', () => {
  it('walks a straight line, excluding start and including goal', () => {
    const path = findPath(openMap(), { tx: 0, ty: 0 }, { tx: 3, ty: 0 });
    expect(path).toEqual([
      { tx: 1, ty: 0 },
      { tx: 2, ty: 0 },
      { tx: 3, ty: 0 },
    ]);
  });

  it('takes diagonals on open ground', () => {
    const path = findPath(openMap(), { tx: 0, ty: 0 }, { tx: 3, ty: 3 });
    expect(path).not.toBeNull();
    expect(path!.length).toBe(3);
    expect(last(path!)).toEqual({ tx: 3, ty: 3 });
  });

  it('goes around a wall through the open row', () => {
    const map = wallMap();
    const path = findPath(map, { tx: 2, ty: 4 }, { tx: 6, ty: 4 });
    expect(path).not.toBeNull();
    expect(last(path!)).toEqual({ tx: 6, ty: 4 });
    for (const tile of path!) {
      expect(map.tiles[tileIndex(map, tile.tx, tile.ty)]).toBe(0);
    }
    expect(path!.some((tile) => tile.ty === 9)).toBe(true);
    // The optimal route is 10 orthogonal steps and 2 diagonals: 12 tiles.
    expect(path!.length).toBe(12);
  });

  it('returns null for a start outside the map', () => {
    expect(findPath(openMap(), { tx: -1, ty: 0 }, { tx: 3, ty: 3 })).toBeNull();
    expect(findPath(openMap(), { tx: 10, ty: 0 }, { tx: 3, ty: 3 })).toBeNull();
  });

  it('crosses the Crossroads map from the blue spawn to the red spawn along the central road', () => {
    const path = findPath(CROSSROADS, { tx: 2, ty: 10 }, { tx: 37, ty: 10 });
    expect(path).not.toBeNull();
    expect(path!.length).toBe(35);
    expect(path!.some((tile) => tile.tx >= 18 && tile.tx <= 21)).toBe(true);
  });

  it('never cuts a corner between two cover tiles', () => {
    const map = openMap([
      { tx: 1, ty: 0 },
      { tx: 0, ty: 1 },
    ]);
    expect(findPath(map, { tx: 0, ty: 0 }, { tx: 1, ty: 1 })).toBeNull();
  });

  it('never cuts a corner when one side is cover and the other is in the blocked set', () => {
    const map = openMap([{ tx: 1, ty: 0 }]);
    const blocked = new Set([tileIndex(map, 0, 1)]);
    expect(findPath(map, { tx: 0, ty: 0 }, { tx: 1, ty: 1 }, blocked)).toBeNull();
  });

  it('steps between adjacent tiles orthogonally and diagonally', () => {
    const map = openMap();
    expect(findPath(map, { tx: 5, ty: 5 }, { tx: 6, ty: 5 })).toEqual([{ tx: 6, ty: 5 }]);
    expect(findPath(map, { tx: 5, ty: 5 }, { tx: 4, ty: 4 })).toEqual([{ tx: 4, ty: 4 }]);
  });

  it('returns null for a goal inside a walled room', () => {
    const map = openMap([
      { tx: 7, ty: 0 },
      { tx: 8, ty: 0 },
      { tx: 9, ty: 0 },
      { tx: 7, ty: 1 },
      { tx: 9, ty: 1 },
      { tx: 7, ty: 2 },
      { tx: 8, ty: 2 },
      { tx: 9, ty: 2 },
    ]);
    expect(findPath(map, { tx: 0, ty: 0 }, { tx: 8, ty: 1 })).toBeNull();
  });

  it('returns [] when start equals goal', () => {
    expect(findPath(openMap(), { tx: 4, ty: 4 }, { tx: 4, ty: 4 })).toEqual([]);
  });

  it('returns null for a goal on a cover tile or outside the map', () => {
    const map = openMap([{ tx: 5, ty: 5 }]);
    expect(findPath(map, { tx: 0, ty: 0 }, { tx: 5, ty: 5 })).toBeNull();
    expect(findPath(map, { tx: 0, ty: 0 }, { tx: 10, ty: 0 })).toBeNull();
    expect(findPath(map, { tx: 0, ty: 0 }, { tx: 0, ty: -1 })).toBeNull();
  });

  it('avoids tiles in the blocked set', () => {
    const map = openMap();
    const blocked = new Set([tileIndex(map, 1, 0)]);
    const path = findPath(map, { tx: 0, ty: 0 }, { tx: 2, ty: 0 }, blocked);
    expect(path).not.toBeNull();
    expect(last(path!)).toEqual({ tx: 2, ty: 0 });
    expect(path!.some((tile) => tile.tx === 1 && tile.ty === 0)).toBe(false);
    // The blocked tile also forbids the diagonals that touch it, so the detour is four steps.
    expect(path!.length).toBe(4);
  });

  it('still reaches a goal that is in the blocked set', () => {
    const map = openMap();
    const blocked = new Set([tileIndex(map, 2, 0)]);
    const path = findPath(map, { tx: 0, ty: 0 }, { tx: 2, ty: 0 }, blocked);
    expect(path).toEqual([
      { tx: 1, ty: 0 },
      { tx: 2, ty: 0 },
    ]);
  });

  it('is deterministic across repeated runs', () => {
    const map = wallMap();
    const first = JSON.stringify(findPath(map, { tx: 2, ty: 4 }, { tx: 6, ty: 4 }));
    for (let i = 0; i < 20; i++) {
      expect(JSON.stringify(findPath(map, { tx: 2, ty: 4 }, { tx: 6, ty: 4 }))).toBe(first);
    }
  });

  it('prefers the diagonal shortcut over a longer orthogonal route', () => {
    // Open ground: (0,0) to (2,1) costs SQRT2 + 1 with one diagonal.
    const path = findPath(openMap(), { tx: 0, ty: 0 }, { tx: 2, ty: 1 });
    expect(path).not.toBeNull();
    expect(path!.length).toBe(2);
  });
});

describe('pathToWaypoints', () => {
  it('uses tile centres and replaces the last with dest', () => {
    const waypoints = pathToWaypoints(
      [
        { tx: 1, ty: 0 },
        { tx: 2, ty: 0 },
      ],
      { x: 70, y: 20 },
    );
    expect(waypoints).toEqual([
      { x: 48, y: 16 },
      { x: 70, y: 20 },
    ]);
  });

  it('uses tile centres throughout when dest is omitted', () => {
    const waypoints = pathToWaypoints([
      { tx: 1, ty: 0 },
      { tx: 2, ty: 0 },
    ]);
    expect(waypoints).toEqual([
      { x: 48, y: 16 },
      { x: 80, y: 16 },
    ]);
  });

  it('returns [] for an empty path even with a dest', () => {
    expect(pathToWaypoints([], { x: 70, y: 20 })).toEqual([]);
  });
});

describe('SQRT2', () => {
  it('is the IEEE double nearest the square root of two', () => {
    expect(SQRT2).toBe(Math.sqrt(2));
  });
});
