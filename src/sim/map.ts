/**
 * Tile map helpers. A map is plain data (see `TileMap` in types.ts): a
 * row-major tile array in which `TILE_OPEN` is walkable and every other
 * value is cover that blocks movement and, for direct fire, sight.
 *
 * World units: `TILE_SIZE` per tile; tile (tx, ty) spans
 * [tx * TILE_SIZE, (tx + 1) * TILE_SIZE) on x and likewise on y.
 */
import type { Side, TileCoord, TileMap, Vec2 } from './types';
import { CLASS_ORDER, TILE_CRATE, TILE_OPEN, TILE_SIZE, TILE_TREE, TILE_WALL } from './constants';
import { clamp, dist2 } from './vec';

/** Every map places exactly this many soldiers per side, in class order. */
const SPAWNS_PER_SIDE = CLASS_ORDER.length;

/**
 * Parse a map from rows of characters.
 *
 * Legend: '.' open, '#' wall, 'c' crate, 't' tree, 'b' blue spawn (open),
 * 'r' red spawn (open). Spawns are listed top to bottom (then left to right
 * within a row); their world point is the tile centre. Throws if any row
 * length differs from the first, if a character is not in the legend, or if
 * either side has a spawn count other than `SPAWNS_PER_SIDE`.
 */
export function parseMap(name: string, rows: readonly string[]): TileMap {
  const height = rows.length;
  const width = height === 0 ? 0 : rows[0].length;
  const tiles: number[] = [];
  const spawns: Record<Side, Vec2[]> = { blue: [], red: [] };

  for (let ty = 0; ty < height; ty++) {
    const row = rows[ty];
    if (row.length !== width) {
      throw new Error(`Map ${name}: row ${ty} has ${row.length} characters, expected ${width}`);
    }
    for (let tx = 0; tx < width; tx++) {
      const ch = row[tx];
      let tile = TILE_OPEN;
      if (ch === '#') {
        tile = TILE_WALL;
      } else if (ch === 'c') {
        tile = TILE_CRATE;
      } else if (ch === 't') {
        tile = TILE_TREE;
      } else if (ch === 'b') {
        spawns.blue.push(tileCenter(tx, ty));
      } else if (ch === 'r') {
        spawns.red.push(tileCenter(tx, ty));
      } else if (ch !== '.') {
        throw new Error(`Map ${name}: unknown character '${ch}' at row ${ty}, column ${tx}`);
      }
      tiles.push(tile);
    }
  }

  if (spawns.blue.length !== SPAWNS_PER_SIDE || spawns.red.length !== SPAWNS_PER_SIDE) {
    throw new Error(
      `Map ${name}: expected ${SPAWNS_PER_SIDE} spawns per side, got ` +
        `${spawns.blue.length} blue and ${spawns.red.length} red`,
    );
  }

  return { name, width, height, tiles, spawns };
}

/** Index into `map.tiles` for tile (tx, ty). Caller ensures the tile is in bounds. */
export function tileIndex(map: TileMap, tx: number, ty: number): number {
  return ty * map.width + tx;
}

/** True when the tile is cover or lies outside the map. */
export function isBlocked(map: TileMap, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) {
    return true;
  }
  return map.tiles[tileIndex(map, tx, ty)] !== TILE_OPEN;
}

/** The tile containing world point (x, y). */
export function worldToTile(x: number, y: number): TileCoord {
  return { tx: Math.floor(x / TILE_SIZE), ty: Math.floor(y / TILE_SIZE) };
}

/** World point at the centre of tile (tx, ty). */
export function tileCenter(tx: number, ty: number): Vec2 {
  return { x: (tx + 0.5) * TILE_SIZE, y: (ty + 0.5) * TILE_SIZE };
}

/** Map width in world units. */
export function mapWidthUnits(map: TileMap): number {
  return map.width * TILE_SIZE;
}

/** Map height in world units. */
export function mapHeightUnits(map: TileMap): number {
  return map.height * TILE_SIZE;
}

/**
 * The open tile nearest to (tx, ty) by Chebyshev distance. Searches rings
 * 0, 1, 2, ... outward, scanning each ring top-left to bottom-right, so the
 * answer is the same on every call. Throws if the map has no open tile.
 */
export function nearestOpenTile(map: TileMap, tx: number, ty: number): TileCoord {
  // The largest ring that can still reach a map corner from (tx, ty).
  const maxRing = Math.max(
    Math.abs(tx),
    Math.abs(tx - (map.width - 1)),
    Math.abs(ty),
    Math.abs(ty - (map.height - 1)),
  );
  for (let ring = 0; ring <= maxRing; ring++) {
    for (let dy = -ring; dy <= ring; dy++) {
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) {
          continue;
        }
        const cx = tx + dx;
        const cy = ty + dy;
        if (!isBlocked(map, cx, cy)) {
          return { tx: cx, ty: cy };
        }
      }
    }
  }
  throw new Error(`Map ${map.name} has no open tile`);
}

/**
 * True if the circle at (x, y) with radius r intersects any blocked tile
 * (including the area outside the map). Candidate tiles are those whose
 * bounding box meets the circle's; each is tested by clamping the centre to
 * the tile rectangle and comparing the squared distance with r * r.
 * Touching exactly at distance r does not count as overlap.
 */
export function circleOverlapsCover(map: TileMap, x: number, y: number, r: number): boolean {
  const minTx = Math.floor((x - r) / TILE_SIZE);
  const maxTx = Math.floor((x + r) / TILE_SIZE);
  const minTy = Math.floor((y - r) / TILE_SIZE);
  const maxTy = Math.floor((y + r) / TILE_SIZE);
  const r2 = r * r;
  for (let ty = minTy; ty <= maxTy; ty++) {
    for (let tx = minTx; tx <= maxTx; tx++) {
      if (!isBlocked(map, tx, ty)) {
        continue;
      }
      const left = tx * TILE_SIZE;
      const top = ty * TILE_SIZE;
      const nx = clamp(x, left, left + TILE_SIZE);
      const ny = clamp(y, top, top + TILE_SIZE);
      if (dist2(x, y, nx, ny) < r2) {
        return true;
      }
    }
  }
  return false;
}
