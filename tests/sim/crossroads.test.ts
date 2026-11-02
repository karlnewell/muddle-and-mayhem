import { describe, expect, it } from 'vitest';
import { TILE_CRATE, TILE_OPEN, TILE_TREE, TILE_WALL } from '../../src/sim/constants';
import { isBlocked, tileIndex, worldToTile } from '../../src/sim/map';
import { CROSSROADS, CROSSROADS_ROWS } from '../../src/sim/maps/crossroads';

describe('Crossroads map', () => {
  it('is 40 by 22 tiles', () => {
    expect(CROSSROADS.width).toBe(40);
    expect(CROSSROADS.height).toBe(22);
    expect(CROSSROADS.tiles.length).toBe(40 * 22);
    expect(CROSSROADS_ROWS.length).toBe(22);
  });

  it('has every row written out at 40 characters', () => {
    for (const row of CROSSROADS_ROWS) {
      expect(row.length).toBe(40);
    }
  });

  it('is mirror-symmetric left to right', () => {
    for (let y = 0; y < 22; y++) {
      for (let x = 0; x < 40; x++) {
        expect(CROSSROADS.tiles[y * 40 + x]).toBe(CROSSROADS.tiles[y * 40 + 39 - x]);
      }
    }
  });

  it('has five spawns per side on open tiles, blue left and red right', () => {
    expect(CROSSROADS.spawns.blue.length).toBe(5);
    expect(CROSSROADS.spawns.red.length).toBe(5);
    for (const p of CROSSROADS.spawns.blue) {
      const t = worldToTile(p.x, p.y);
      expect(isBlocked(CROSSROADS, t.tx, t.ty)).toBe(false);
      expect(t.tx).toBeLessThan(20);
    }
    for (const p of CROSSROADS.spawns.red) {
      const t = worldToTile(p.x, p.y);
      expect(isBlocked(CROSSROADS, t.tx, t.ty)).toBe(false);
      expect(t.tx).toBeGreaterThan(20);
    }
  });

  it('keeps the central crossroads open', () => {
    expect(CROSSROADS.tiles[tileIndex(CROSSROADS, 20, 10)]).toBe(TILE_OPEN);
    expect(CROSSROADS.tiles[tileIndex(CROSSROADS, 19, 10)]).toBe(TILE_OPEN);
    expect(CROSSROADS.tiles[tileIndex(CROSSROADS, 20, 11)]).toBe(TILE_OPEN);
  });

  it('contains at least one wall, one crate, and one tree', () => {
    expect(CROSSROADS.tiles).toContain(TILE_WALL);
    expect(CROSSROADS.tiles).toContain(TILE_CRATE);
    expect(CROSSROADS.tiles).toContain(TILE_TREE);
  });
});
