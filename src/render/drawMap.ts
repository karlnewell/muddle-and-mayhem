/**
 * The battlefield tiles: open ground with a faint grid, walls, crates and
 * trees. World units map one-to-one onto logical pixels; the caller has
 * already translated the context to the field origin.
 */
import { TILE_CRATE, TILE_OPEN, TILE_SIZE, TILE_TREE, TILE_WALL } from '../sim';
import type { TileMap } from '../sim';
import { PALETTE } from './palette';

export function drawMap(ctx: CanvasRenderingContext2D, map: TileMap): void {
  const w = map.width * TILE_SIZE;
  const h = map.height * TILE_SIZE;
  ctx.fillStyle = PALETTE.ground;
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = PALETTE.groundGrid;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let tx = 1; tx < map.width; tx++) {
    ctx.moveTo(tx * TILE_SIZE + 0.5, 0);
    ctx.lineTo(tx * TILE_SIZE + 0.5, h);
  }
  for (let ty = 1; ty < map.height; ty++) {
    ctx.moveTo(0, ty * TILE_SIZE + 0.5);
    ctx.lineTo(w, ty * TILE_SIZE + 0.5);
  }
  ctx.stroke();

  for (let ty = 0; ty < map.height; ty++) {
    for (let tx = 0; tx < map.width; tx++) {
      const tile = map.tiles[ty * map.width + tx];
      if (tile === TILE_OPEN) {
        continue;
      }
      const x = tx * TILE_SIZE;
      const y = ty * TILE_SIZE;
      if (tile === TILE_WALL) {
        ctx.fillStyle = PALETTE.wall;
        ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
        ctx.strokeStyle = PALETTE.wallEdge;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 1, y + 1, TILE_SIZE - 2, TILE_SIZE - 2);
      } else if (tile === TILE_CRATE) {
        ctx.fillStyle = PALETTE.crate;
        ctx.fillRect(x + 2, y + 2, TILE_SIZE - 4, TILE_SIZE - 4);
        ctx.strokeStyle = PALETTE.crateEdge;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 3, y + 3, TILE_SIZE - 6, TILE_SIZE - 6);
        ctx.beginPath();
        ctx.moveTo(x + 4, y + 4);
        ctx.lineTo(x + TILE_SIZE - 4, y + TILE_SIZE - 4);
        ctx.moveTo(x + TILE_SIZE - 4, y + 4);
        ctx.lineTo(x + 4, y + TILE_SIZE - 4);
        ctx.stroke();
      } else if (tile === TILE_TREE) {
        ctx.fillStyle = PALETTE.tree;
        ctx.beginPath();
        ctx.arc(x + TILE_SIZE / 2, y + TILE_SIZE / 2, TILE_SIZE / 2 - 1, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = PALETTE.treeEdge;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }
}
