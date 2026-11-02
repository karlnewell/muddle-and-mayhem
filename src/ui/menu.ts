/** The Esc menu: Resume, Restart, Title, over the frozen battle. */
import { PALETTE } from '../render/palette';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../render/renderConstants';
import { stackButtons } from './buttons';
import type { ButtonRect } from './buttons';
import { drawButton, drawOverlayPanel } from './drawButtons';
import { BUTTON, FONT, PANEL } from './uiConstants';

const PANEL_HEIGHT = 300;

export function menuButtons(): ButtonRect[] {
  const top = (LOGICAL_HEIGHT - PANEL_HEIGHT) / 2 + 90;
  return stackButtons(
    [
      { id: 'resume', label: 'Resume' },
      { id: 'restart', label: 'Restart' },
      { id: 'title', label: 'Title' },
    ],
    LOGICAL_WIDTH / 2,
    top,
    BUTTON.width,
    BUTTON.height,
    BUTTON.gap,
  );
}

export function drawMenu(ctx: CanvasRenderingContext2D): void {
  const panel = drawOverlayPanel(ctx, LOGICAL_WIDTH, LOGICAL_HEIGHT, PANEL.width, PANEL_HEIGHT);
  ctx.fillStyle = PALETTE.text;
  ctx.font = FONT.heading;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Menu', LOGICAL_WIDTH / 2, panel.y + 56);
  for (const b of menuButtons()) {
    drawButton(ctx, b);
  }
}
