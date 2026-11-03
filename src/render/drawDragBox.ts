/** Draws the drag-select box in world coordinates: a faint fill and a thin outline in the side's colour. */
import type { WorldBox } from '../input/boxSelect';
import type { Side } from '../sim';
import { SIDE_COLOUR } from './palette';
import { DRAG_BOX_FILL_ALPHA, DRAG_BOX_LINE_WIDTH } from './renderConstants';

export function drawDragBox(ctx: CanvasRenderingContext2D, box: WorldBox, side: Side): void {
  const w = box.x1 - box.x0;
  const h = box.y1 - box.y0;
  ctx.fillStyle = SIDE_COLOUR[side];
  ctx.globalAlpha = DRAG_BOX_FILL_ALPHA;
  ctx.fillRect(box.x0, box.y0, w, h);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = SIDE_COLOUR[side];
  ctx.lineWidth = DRAG_BOX_LINE_WIDTH;
  // half-pixel inset so a 1-wide line lands on whole pixels
  ctx.strokeRect(box.x0 + 0.5, box.y0 + 0.5, w - 1, h - 1);
}
