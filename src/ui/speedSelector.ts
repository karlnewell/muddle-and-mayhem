/**
 * The game speed selector: 0.5x, 0.75x and 1x as three segments, the one
 * in force filled. Drawn on the title screen and in the Esc menu; a click
 * on a segment picks it, and the left and right arrow keys step along.
 */
import { formatSpeed, SPEEDS } from '../game/speed';
import { PALETTE } from '../render/palette';
import type { ButtonRect } from './buttons';
import { roundRect } from './drawButtons';
import { FONT, SPEED_SELECTOR } from './uiConstants';

const ID_PREFIX = 'speed:';

/** The three segments, centred on `centreX` with their top edge at `top`. */
export function speedSelectorRects(centreX: number, top: number): ButtonRect[] {
  const { segmentWidth: w, height: h, gap } = SPEED_SELECTOR;
  const left = centreX - (SPEEDS.length * w + (SPEEDS.length - 1) * gap) / 2;
  return SPEEDS.map((speed, i) => ({ id: `${ID_PREFIX}${speed}`, label: formatSpeed(speed), x: left + i * (w + gap), y: top, w, h }));
}

/** The speed a hit segment id names, or null for any other id. */
export function speedFromButton(id: string | null): number | null {
  return id !== null && id.startsWith(ID_PREFIX) ? Number(id.slice(ID_PREFIX.length)) : null;
}

export function drawSpeedSelector(ctx: CanvasRenderingContext2D, centreX: number, top: number, current: number): void {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = FONT.bodyBold;
  ctx.fillStyle = PALETTE.text;
  ctx.fillText('Game speed', centreX, top - SPEED_SELECTOR.labelGap);
  for (const r of speedSelectorRects(centreX, top)) {
    const on = speedFromButton(r.id) === current;
    roundRect(ctx, r.x, r.y, r.w, r.h, SPEED_SELECTOR.radius);
    ctx.fillStyle = on ? PALETTE.selection : PALETTE.button;
    ctx.fill();
    ctx.strokeStyle = on ? PALETTE.selection : PALETTE.buttonEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = on ? PALETTE.pageBackground : PALETTE.buttonText;
    ctx.font = FONT.button;
    ctx.textBaseline = 'middle';
    ctx.fillText(r.label, r.x + r.w / 2, r.y + r.h / 2 + 1);
    ctx.textBaseline = 'alphabetic';
  }
  ctx.font = FONT.small;
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText('click, or Left / Right arrow keys', centreX, top + SPEED_SELECTOR.height + SPEED_SELECTOR.hintGap);
}
