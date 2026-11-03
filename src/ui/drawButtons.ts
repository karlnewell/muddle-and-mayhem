/** Drawing for canvas buttons and the panels that hold them. */
import { PALETTE } from '../render/palette';
import type { ButtonRect } from './buttons';
import { BUTTON, FONT, PANEL } from './uiConstants';

export function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function drawButton(ctx: CanvasRenderingContext2D, b: ButtonRect): void {
  roundRect(ctx, b.x, b.y, b.w, b.h, BUTTON.radius);
  ctx.fillStyle = PALETTE.button;
  ctx.fill();
  ctx.strokeStyle = PALETTE.buttonEdge;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = PALETTE.buttonText;
  ctx.font = FONT.button;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
}

/** A dim overlay over the whole canvas and a centred panel of the given size; returns the panel's top-left. */
/** Dims the whole canvas and draws a panel, centred unless `top` is given. */
export function drawOverlayPanel(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  panelW: number,
  panelH: number,
  top?: number,
): { x: number; y: number } {
  ctx.fillStyle = PALETTE.overlay;
  ctx.fillRect(0, 0, canvasW, canvasH);
  const x = (canvasW - panelW) / 2;
  const y = top ?? (canvasH - panelH) / 2;
  roundRect(ctx, x, y, panelW, panelH, PANEL.radius);
  ctx.fillStyle = PALETTE.panel;
  ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 2;
  ctx.stroke();
  return { x, y };
}
