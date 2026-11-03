/** The Esc menu: Resume, Restart, Title and the game speed selector, over the frozen battle. */
import { PALETTE } from '../render/palette';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../render/renderConstants';
import { stackButtons } from './buttons';
import type { ButtonRect } from './buttons';
import { drawButton, drawOverlayPanel } from './drawButtons';
import { drawSpeedSelector, speedSelectorRects } from './speedSelector';
import { BUTTON, FONT, PANEL, SPEED_SELECTOR } from './uiConstants';

const PANEL_HEIGHT = 400;

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

/** The top edge of the speed selector's segments, below the last button. */
function selectorTop(): number {
  const last = menuButtons()[menuButtons().length - 1];
  return last.y + last.h + SPEED_SELECTOR.menuGap;
}

/** The speed selector's segments in the menu. */
export function menuSpeedRects(): ButtonRect[] {
  return speedSelectorRects(LOGICAL_WIDTH / 2, selectorTop());
}

export function drawMenu(ctx: CanvasRenderingContext2D, speed: number): void {
  const panel = drawOverlayPanel(ctx, LOGICAL_WIDTH, LOGICAL_HEIGHT, PANEL.width, PANEL_HEIGHT);
  ctx.fillStyle = PALETTE.text;
  ctx.font = FONT.heading;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Menu', LOGICAL_WIDTH / 2, panel.y + 56);
  for (const b of menuButtons()) {
    drawButton(ctx, b);
  }
  drawSpeedSelector(ctx, LOGICAL_WIDTH / 2, selectorTop(), speed);
}
