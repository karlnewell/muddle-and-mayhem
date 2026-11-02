import { describe, expect, it } from 'vitest';
import { TILE_CRATE, TILE_OPEN, TILE_SIZE, TILE_TREE, TILE_WALL } from '../../src/sim/constants';
import {
  circleOverlapsCover,
  isBlocked,
  mapHeightUnits,
  mapWidthUnits,
  nearestOpenTile,
  parseMap,
  tileCenter,
  tileIndex,
  worldToTile,
} from '../../src/sim/map';
import type { TileMap } from '../../src/sim/types';

// A 5 by 5 map: blue spawns down column 0, red spawns down column 4,
// a crate at (2,0), a tree at (2,1), and a wall at (2,2).
const ROWS = ['b.c.r', 'b.t.r', 'b.#.r', 'b...r', 'b...r'];

function tiny(): TileMap {
  return parseMap('Tiny', ROWS);
}

describe('parseMap', () => {
  it('reads width, height, and the tile legend', () => {
    const map = tiny();
    expect(map.name).toBe('Tiny');
    expect(map.width).toBe(5);
    expect(map.height).toBe(5);
    expect(map.tiles.length).toBe(25);
    expect(map.tiles[tileIndex(map, 2, 0)]).toBe(TILE_CRATE);
    expect(map.tiles[tileIndex(map, 2, 1)]).toBe(TILE_TREE);
    expect(map.tiles[tileIndex(map, 2, 2)]).toBe(TILE_WALL);
    expect(map.tiles[tileIndex(map, 1, 0)]).toBe(TILE_OPEN);
    expect(map.tiles[tileIndex(map, 0, 0)]).toBe(TILE_OPEN); // b
    expect(map.tiles[tileIndex(map, 4, 0)]).toBe(TILE_OPEN); // r
  });

  it('lists spawns at tile centres, top to bottom', () => {
    const map = tiny();
    expect(map.spawns.blue).toEqual([
      { x: 16, y: 16 },
      { x: 16, y: 48 },
      { x: 16, y: 80 },
      { x: 16, y: 112 },
      { x: 16, y: 144 },
    ]);
    expect(map.spawns.red).toEqual([
      { x: 144, y: 16 },
      { x: 144, y: 48 },
      { x: 144, y: 80 },
      { x: 144, y: 112 },
      { x: 144, y: 144 },
    ]);
  });

  it('throws on ragged rows', () => {
    expect(() => parseMap('Ragged', ['b.c.r', 'b.t.r', 'b.#.r', 'b...r', 'b..r'])).toThrow();
  });

  it('throws when a side has a spawn count other than five', () => {
    expect(() => parseMap('Four', ['b.c.r', 'b.t.r', 'b.#.r', 'b...r', '....r'])).toThrow();
    expect(() => parseMap('Four', ['b.c.r', 'b.t.r', 'b.#.r', 'b...r', 'b....'])).toThrow();
  });

  it('throws on an unknown character', () => {
    expect(() => parseMap('Bad', ['b.c.r', 'b.t.r', 'b.#.r', 'b...r', 'b.x.r'])).toThrow();
  });
});

describe('tile helpers', () => {
  it('tileIndex is row-major', () => {
    const map = tiny();
    expect(tileIndex(map, 0, 0)).toBe(0);
    expect(tileIndex(map, 4, 0)).toBe(4);
    expect(tileIndex(map, 0, 1)).toBe(5);
    expect(tileIndex(map, 3, 2)).toBe(13);
  });

  it('isBlocked is true for cover tiles and out of bounds', () => {
    const map = tiny();
    expect(isBlocked(map, 2, 0)).toBe(true);
    expect(isBlocked(map, 2, 1)).toBe(true);
    expect(isBlocked(map, 2, 2)).toBe(true);
    expect(isBlocked(map, 1, 0)).toBe(false);
    expect(isBlocked(map, 2, 3)).toBe(false);
    expect(isBlocked(map, -1, 0)).toBe(true);
    expect(isBlocked(map, map.width, 0)).toBe(true);
    expect(isBlocked(map, 0, -1)).toBe(true);
    expect(isBlocked(map, 0, map.height)).toBe(true);
  });

  it('worldToTile floors by tile size', () => {
    expect(worldToTile(33, 31)).toEqual({ tx: 1, ty: 0 });
    expect(worldToTile(0, 0)).toEqual({ tx: 0, ty: 0 });
    expect(worldToTile(TILE_SIZE, TILE_SIZE)).toEqual({ tx: 1, ty: 1 });
  });

  it('tileCenter is the middle of the tile', () => {
    expect(tileCenter(1, 0)).toEqual({ x: 48, y: 16 });
    expect(tileCenter(0, 0)).toEqual({ x: 16, y: 16 });
  });

  it('map size in world units is tiles times tile size', () => {
    const map = tiny();
    expect(mapWidthUnits(map)).toBe(5 * TILE_SIZE);
    expect(mapHeightUnits(map)).toBe(5 * TILE_SIZE);
  });
});

describe('nearestOpenTile', () => {
  it('returns an open tile unchanged', () => {
    expect(nearestOpenTile(tiny(), 1, 1)).toEqual({ tx: 1, ty: 1 });
  });

  it('returns an adjacent open tile for a blocked one, the same one every call', () => {
    const map = tiny();
    const first = nearestOpenTile(map, 2, 2);
    expect(isBlocked(map, first.tx, first.ty)).toBe(false);
    expect(Math.max(Math.abs(first.tx - 2), Math.abs(first.ty - 2))).toBe(1);
    for (let i = 0; i < 10; i++) {
      expect(nearestOpenTile(map, 2, 2)).toEqual(first);
    }
    // Ring 1 scanned top-left to bottom-right: (1,1) comes first.
    expect(first).toEqual({ tx: 1, ty: 1 });
  });

  it('searches outward past a blocked ring', () => {
    // Centre tile (2,1) is blocked and so are (2,0) and (2,2); ring 1 still has open tiles.
    expect(nearestOpenTile(tiny(), 2, 1)).toEqual({ tx: 1, ty: 0 });
  });

  it('reaches ring 2 when every neighbour is blocked, top-left first', () => {
    // (3,2) is blocked and so are all eight of its neighbours.
    const walled = parseMap('Walled', ['b.....r', 'b.###.r', 'b.###.r', 'b.###.r', 'b.....r']);
    expect(nearestOpenTile(walled, 3, 2)).toEqual({ tx: 1, ty: 0 });
  });

  it('snaps a tile outside the map to the nearest open tile inside it', () => {
    expect(nearestOpenTile(tiny(), -3, 2)).toEqual({ tx: 0, ty: 0 });
    // (2,4) and (4,4) are both on ring 5 from (7,9); the top-left-first scan picks (2,4).
    expect(nearestOpenTile(tiny(), 7, 9)).toEqual({ tx: 2, ty: 4 });
  });

  it('throws when the map has no open tile', () => {
    const solid: TileMap = {
      name: 'Solid',
      width: 2,
      height: 2,
      tiles: [TILE_WALL, TILE_WALL, TILE_WALL, TILE_WALL],
      spawns: { blue: [], red: [] },
    };
    expect(() => nearestOpenTile(solid, 0, 0)).toThrow();
  });
});

describe('circleOverlapsCover', () => {
  // The wall at (2,2) spans x 64..96 and y 64..96.
  it('is true for a radius-12 circle 10 units from a wall edge', () => {
    expect(circleOverlapsCover(tiny(), 54, 80, 12)).toBe(true);
  });

  it('is false for a radius-12 circle 13 units from a wall edge', () => {
    expect(circleOverlapsCover(tiny(), 51, 80, 12)).toBe(false);
  });

  it('is true when the centre is inside a cover tile', () => {
    expect(circleOverlapsCover(tiny(), 80, 80, 1)).toBe(true);
  });

  it('is false on open ground away from cover', () => {
    expect(circleOverlapsCover(tiny(), 48, 112, 12)).toBe(false);
  });

  it('uses the nearest point, so a circle near a corner but diagonal to it is clear', () => {
    // Bottom-left corner of the wall tile at (64, 96); the tiles left of and
    // below it are open. A centre 10 units left and 10 down is 14.1 away.
    expect(circleOverlapsCover(tiny(), 54, 106, 12)).toBe(false);
    expect(circleOverlapsCover(tiny(), 54, 106, 15)).toBe(true);
  });
});
