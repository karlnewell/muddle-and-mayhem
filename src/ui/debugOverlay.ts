/**
 * The debug overlay (issue #7): a translucent panel over the battlefield
 * listing every soldier, refreshed every frame. Reads state and session
 * facts, writes nothing. Toggled with D or started with `?debug=1`.
 */
import { PALETTE, SIDE_COLOUR } from '../render/palette';
import type { BattleState } from '../sim';
import { formatDebugHeader, formatDebugRows } from './debugText';
import type { DebugHeaderInfo } from './debugText';
import { roundRect } from './drawButtons';
import { DEBUG_OVERLAY, FONT } from './uiConstants';

function textWidth(ctx: CanvasRenderingContext2D, line: string): number {
  const measured = ctx.measureText(line).width;
  return Number.isFinite(measured) && measured > 0 ? measured : line.length * DEBUG_OVERLAY.charWidth;
}

export function drawDebugOverlay(ctx: CanvasRenderingContext2D, state: BattleState, info: DebugHeaderInfo): void {
  const header = formatDebugHeader(state, info);
  const rows = formatDebugRows(state);
  const lines = [...header, '', ...rows];
  const o = DEBUG_OVERLAY;
  const swatchSpace = o.swatch + 6;
  ctx.font = FONT.debug;
  let widest = 0;
  for (const line of lines) {
    widest = Math.max(widest, textWidth(ctx, line));
  }
  const w = widest + swatchSpace + 2 * o.padding;
  const h = lines.length * o.lineHeight + 2 * o.padding;
  const x = o.right - w;
  const y = o.top;

  roundRect(ctx, x, y, w, h, o.radius);
  ctx.fillStyle = PALETTE.debugPanel;
  ctx.fill();
  ctx.strokeStyle = PALETTE.debugPanelEdge;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const textX = x + o.padding + swatchSpace;
  lines.forEach((line, i) => {
    const lineY = y + o.padding + (i + 0.5) * o.lineHeight;
    const soldierIndex = i - header.length - 2; // header, blank line, column header, then soldiers
    const soldier = soldierIndex >= 0 ? state.soldiers[soldierIndex] : undefined;
    if (soldier !== undefined) {
      ctx.fillStyle = SIDE_COLOUR[soldier.side];
      ctx.fillRect(x + o.padding, lineY - o.swatch / 2, o.swatch, o.swatch);
      ctx.fillStyle = soldier.status === 'standing' ? PALETTE.debugText : PALETTE.debugDim;
    } else if (i < header.length) {
      ctx.fillStyle = PALETTE.debugHeading;
    } else {
      ctx.fillStyle = PALETTE.debugDim;
    }
    ctx.fillText(line, textX, lineY);
  });
  ctx.textBaseline = 'alphabetic';
}
