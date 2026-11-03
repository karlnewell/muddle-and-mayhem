import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../../src/sim/constants';
import { firstCoverHit, hasLineOfSight } from '../../src/sim/los';
import { isBlocked, parseMap, tileCenter } from '../../src/sim/map';
import { CROSSROADS } from '../../src/sim/maps/crossroads';
import { COMPACT_CROSSROADS } from '../../src/sim/maps/compactCrossroads';
import type { TileMap } from '../../src/sim/types';

// A 10 by 6 map with a vertical wall at column 5, rows 1 to 4, and a gap
// at row 0 and row 5. Spawns sit in columns 0 and 9.
const ROWS = [
  'b........r',
  'b....#...r',
  'b....#...r',
  'b....#...r',
  'b....#...r',
  '..........',
];

function wallMap(): TileMap {
  return parseMap('Wall', ROWS);
}

/** World point at the centre of tile (tx, ty), as a pair. */
function c(tx: number, ty: number): [number, number] {
  const p = tileCenter(tx, ty);
  return [p.x, p.y];
}

describe('hasLineOfSight and firstCoverHit', () => {
  it('sees clearly across open ground', () => {
    const map = wallMap();
    const [ax, ay] = c(1, 2);
    const [bx, by] = c(3, 2);
    expect(hasLineOfSight(map, ax, ay, bx, by)).toBe(true);
    expect(firstCoverHit(map, ax, ay, bx, by)).toBeNull();
  });

  it('is blocked straight across the wall and reports the entry edge', () => {
    const map = wallMap();
    const [ax, ay] = c(2, 2);
    const [bx, by] = c(7, 2);
    expect(hasLineOfSight(map, ax, ay, bx, by)).toBe(false);
    const t = firstCoverHit(map, ax, ay, bx, by);
    expect(t).not.toBeNull();
    expect(t!).toBeGreaterThan(0);
    expect(t!).toBeLessThan(1);
    const hitX = ax + t! * (bx - ax);
    expect(Math.abs(hitX - 5 * TILE_SIZE)).toBeLessThan(1e-9);
  });

  it('reports the entry edge for a slanted crossing too', () => {
    const map = wallMap();
    const [ax, ay] = c(2, 1);
    const [bx, by] = c(8, 3);
    expect(hasLineOfSight(map, ax, ay, bx, by)).toBe(false);
    const t = firstCoverHit(map, ax, ay, bx, by);
    expect(t).not.toBeNull();
    const hitX = ax + t! * (bx - ax);
    expect(Math.abs(hitX - 5 * TILE_SIZE)).toBeLessThan(1e-9);
  });

  it('sees through the gap at row 0', () => {
    const map = wallMap();
    const [ax, ay] = c(2, 0);
    const [bx, by] = c(7, 0);
    expect(hasLineOfSight(map, ax, ay, bx, by)).toBe(true);
    expect(firstCoverHit(map, ax, ay, bx, by)).toBeNull();
  });

  it('sees through the gap at row 5', () => {
    const map = wallMap();
    const [ax, ay] = c(2, 5);
    const [bx, by] = c(7, 5);
    expect(hasLineOfSight(map, ax, ay, bx, by)).toBe(true);
  });

  it('treats a zero-length segment as clear', () => {
    const map = wallMap();
    const [ax, ay] = c(3, 3);
    expect(hasLineOfSight(map, ax, ay, ax, ay)).toBe(true);
    expect(firstCoverHit(map, ax, ay, ax, ay)).toBeNull();
  });

  it('handles vertical segments with and without a wall', () => {
    const map = wallMap();
    const [wx, wy0] = c(5, 0);
    const [, wy5] = c(5, 5);
    expect(hasLineOfSight(map, wx, wy0, wx, wy5)).toBe(false);
    const t = firstCoverHit(map, wx, wy0, wx, wy5);
    expect(t).not.toBeNull();
    const hitY = wy0 + t! * (wy5 - wy0);
    expect(Math.abs(hitY - 1 * TILE_SIZE)).toBeLessThan(1e-9);

    const [ox, oy0] = c(3, 0);
    const [, oy5] = c(3, 5);
    expect(hasLineOfSight(map, ox, oy0, ox, oy5)).toBe(true);
    expect(firstCoverHit(map, ox, oy0, ox, oy5)).toBeNull();
  });

  it('handles horizontal segments that never cross the wall column', () => {
    const map = wallMap();
    const [ax, ay] = c(6, 3);
    const [bx, by] = c(8, 3);
    expect(hasLineOfSight(map, ax, ay, bx, by)).toBe(true);
  });

  it('is symmetric for a handful of pairs', () => {
    const map = wallMap();
    const pairs: [number, number, number, number][] = [
      [...c(1, 2), ...c(3, 2)],
      [...c(2, 2), ...c(7, 2)],
      [...c(2, 0), ...c(7, 0)],
      [...c(2, 1), ...c(8, 3)],
      [...c(4, 0), ...c(6, 1)],
      [...c(4, 5), ...c(6, 4)],
      [...c(0, 0), ...c(9, 5)],
      [...c(3, 4), ...c(3, 1)],
      [...c(5, 0), ...c(5, 5)],
      [...c(1, 1), ...c(4, 4)],
    ];
    for (const [ax, ay, bx, by] of pairs) {
      expect(hasLineOfSight(map, ax, ay, bx, by)).toBe(hasLineOfSight(map, bx, by, ax, ay));
    }
  });
});

describe('exact corner crossings', () => {
  // A 5 by 5 map with walls at (2,1) and (1,2): a diagonal from the centre
  // of (1,1) to the centre of (2,2) passes exactly through their shared corner.
  const CORNER_ROWS = ['b...r', 'b.#.r', 'b#..r', 'b...r', 'b...r'];
  // The same with only one of the two neighbours blocked.
  const ONE_SIDE_ROWS = ['b...r', 'b.#.r', 'b...r', 'b...r', 'b...r'];

  it('does not cut a corner when both neighbouring tiles are blocked', () => {
    const map = parseMap('Corner', CORNER_ROWS);
    const [ax, ay] = c(1, 1);
    const [bx, by] = c(2, 2);
    expect(hasLineOfSight(map, ax, ay, bx, by)).toBe(false);
    expect(hasLineOfSight(map, bx, by, ax, ay)).toBe(false);
    const t = firstCoverHit(map, ax, ay, bx, by);
    expect(t).not.toBeNull();
    expect(Math.abs(t! - 0.5)).toBeLessThan(1e-9);
  });

  it('does not cut a corner when one neighbouring tile is blocked', () => {
    const map = parseMap('OneSide', ONE_SIDE_ROWS);
    const [ax, ay] = c(1, 1);
    const [bx, by] = c(2, 2);
    expect(hasLineOfSight(map, ax, ay, bx, by)).toBe(false);
    expect(hasLineOfSight(map, bx, by, ax, ay)).toBe(false);
  });

  it('passes a corner whose neighbours are all open', () => {
    const map = parseMap('OneSide', ONE_SIDE_ROWS);
    const [ax, ay] = c(0, 2);
    const [bx, by] = c(1, 3);
    expect(hasLineOfSight(map, ax, ay, bx, by)).toBe(true);
    expect(hasLineOfSight(map, bx, by, ax, ay)).toBe(true);
  });
});

describe('exact corners on the wall map (regression)', () => {
  // These lines pass exactly through the top-left corner (160, 32) of wall
  // tile (5,1). An accumulated tMax drifts past the tie and cuts the corner.
  it('does not cut the corner of wall tile (5,1) from either end', () => {
    const map = wallMap();
    const cases: [number, number, number, number][] = [
      [...c(8, 0), ...c(1, 1)],
      [...c(2, 0), ...c(9, 1)],
    ];
    for (const [ax, ay, bx, by] of cases) {
      expect(hasLineOfSight(map, ax, ay, bx, by)).toBe(false);
      expect(hasLineOfSight(map, bx, by, ax, ay)).toBe(false);
    }
  });
});

describe('negative direction and edge starts', () => {
  it('reports the right edge when crossing the wall leftwards', () => {
    const map = wallMap();
    const [ax, ay] = c(7, 2);
    const [bx, by] = c(2, 2);
    const t = firstCoverHit(map, ax, ay, bx, by);
    expect(t).not.toBeNull();
    expect(t!).toBeGreaterThan(0);
    expect(t!).toBeLessThan(1);
    const hitX = ax + t! * (bx - ax);
    expect(Math.abs(hitX - 6 * TILE_SIZE)).toBeLessThan(1e-9);
  });

  it('hits a wall tile entered at t = 0 from a start point on its edge', () => {
    // Row 2 has a wall at column 4; the start is the left edge of tile (5,2).
    const map = parseMap('Edge', [
      'b........r',
      'b........r',
      'b...#....r',
      'b........r',
      'b........r',
      '..........',
    ]);
    const ax = 5 * TILE_SIZE;
    const [, ay] = c(5, 2);
    const [bx, by] = c(1, 2);
    expect(firstCoverHit(map, ax, ay, bx, by)).toBe(0);
    expect(hasLineOfSight(map, ax, ay, bx, by)).toBe(false);
    // Moving right from the same point crosses only open tiles.
    const [rx, ry] = c(8, 2);
    expect(hasLineOfSight(map, ax, ay, rx, ry)).toBe(true);
  });

  it('never tests the start tile, even when it is cover', () => {
    // On the wall map x = 5 * TILE_SIZE lies in wall tile (5,2).
    const map = wallMap();
    const ax = 5 * TILE_SIZE;
    const [, ay] = c(5, 2);
    const [lx, ly] = c(1, 2);
    const [rx, ry] = c(8, 2);
    expect(hasLineOfSight(map, ax, ay, lx, ly)).toBe(true);
    expect(hasLineOfSight(map, ax, ay, rx, ry)).toBe(true);
  });
});

describe('symmetry sweeps over every pair of open tile centres', () => {
  /** Checks hasLineOfSight(a, b) === hasLineOfSight(b, a) for all open centre pairs. */
  function sweep(map: TileMap): { pairs: number; asymmetric: number } {
    const xs: number[] = [];
    const ys: number[] = [];
    for (let ty = 0; ty < map.height; ty++) {
      for (let tx = 0; tx < map.width; tx++) {
        if (!isBlocked(map, tx, ty)) {
          xs.push((tx + 0.5) * TILE_SIZE);
          ys.push((ty + 0.5) * TILE_SIZE);
        }
      }
    }
    let pairs = 0;
    let asymmetric = 0;
    for (let i = 0; i < xs.length; i++) {
      for (let j = i + 1; j < xs.length; j++) {
        pairs++;
        const ab = hasLineOfSight(map, xs[i], ys[i], xs[j], ys[j]);
        const ba = hasLineOfSight(map, xs[j], ys[j], xs[i], ys[i]);
        if (ab !== ba) {
          asymmetric++;
        }
      }
    }
    return { pairs, asymmetric };
  }

  it('is symmetric on the wall map', () => {
    const result = sweep(wallMap());
    expect(result.pairs).toBeGreaterThan(0);
    expect(result.asymmetric).toBe(0);
  });

  it('is symmetric on Crossroads', () => {
    const result = sweep(CROSSROADS);
    expect(result.pairs).toBeGreaterThan(100000);
    expect(result.asymmetric).toBe(0);
  });

  it('is symmetric on Compact Crossroads', () => {
    const result = sweep(COMPACT_CROSSROADS);
    expect(result.pairs).toBeGreaterThan(30000);
    expect(result.asymmetric).toBe(0);
  });
});
