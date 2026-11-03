import { describe, expect, it } from 'vitest';
import { TILE_CRATE, TILE_OPEN, TILE_TREE, TILE_WALL } from '../../src/sim/constants';
import { isBlocked, tileIndex, worldToTile } from '../../src/sim/map';
import { COMPACT_CROSSROADS, COMPACT_CROSSROADS_ROWS } from '../../src/sim/maps/compactCrossroads';
import { findPath } from '../../src/sim/path';
import type { Side } from '../../src/sim/types';

const map = COMPACT_CROSSROADS;
const W = 26;
const H = 15;

describe('Compact Crossroads map', () => {
  it('is 26 by 15 tiles', () => {
    expect(map.name).toBe('Compact Crossroads');
    expect(map.width).toBe(W);
    expect(map.height).toBe(H);
    expect(map.tiles.length).toBe(W * H);
    expect(COMPACT_CROSSROADS_ROWS.length).toBe(H);
    for (const row of COMPACT_CROSSROADS_ROWS) {
      expect(row.length).toBe(W);
    }
  });

  it('is mirror-symmetric left to right and top to bottom', () => {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        expect(map.tiles[y * W + x]).toBe(map.tiles[y * W + (W - 1 - x)]);
        expect(map.tiles[y * W + x]).toBe(map.tiles[(H - 1 - y) * W + x]);
      }
    }
  });

  it('has five spawns per side on open tiles, blue in column 1 and red in column 24', () => {
    const expected: Record<Side, number> = { blue: 1, red: 24 };
    for (const side of ['blue', 'red'] as const) {
      expect(map.spawns[side].length).toBe(5);
      map.spawns[side].forEach((p, i) => {
        const t = worldToTile(p.x, p.y);
        expect(t).toEqual({ tx: expected[side], ty: 3 + 2 * i });
        expect(isBlocked(map, t.tx, t.ty)).toBe(false);
      });
    }
  });

  it('keeps the horizontal road (rows 6 to 8) and the vertical road (columns 11 to 14) open', () => {
    for (let x = 0; x < W; x++) {
      for (let y = 6; y <= 8; y++) {
        expect(map.tiles[tileIndex(map, x, y)]).toBe(TILE_OPEN);
      }
    }
    for (let y = 0; y < H; y++) {
      for (let x = 11; x <= 14; x++) {
        expect(map.tiles[tileIndex(map, x, y)]).toBe(TILE_OPEN);
      }
    }
  });

  it('boxes the crossing with four 4-tile wall arms', () => {
    for (const y of [5, 9]) {
      for (const x of [7, 8, 9, 10, 15, 16, 17, 18]) {
        expect(map.tiles[tileIndex(map, x, y)]).toBe(TILE_WALL);
      }
    }
  });

  it('has walls, crates and trees', () => {
    expect(map.tiles).toContain(TILE_WALL);
    expect(map.tiles).toContain(TILE_CRATE);
    expect(map.tiles).toContain(TILE_TREE);
  });

  it('lets every spawn walk to every enemy spawn', () => {
    for (const b of map.spawns.blue) {
      for (const r of map.spawns.red) {
        const from = worldToTile(b.x, b.y);
        const to = worldToTile(r.x, r.y);
        const there = findPath(map, from, to);
        const back = findPath(map, to, from);
        expect(there).not.toBeNull();
        expect(back).not.toBeNull();
        expect(there!.length).toBeGreaterThan(0);
      }
    }
  });
});
