/** The Esc menu: Resume, Restart, Title, the game speed selector and the controls hint, over the frozen battle. */
import { PALETTE } from '../render/palette';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../render/renderConstants';
import { stackButtons } from './buttons';
import type { ButtonRect, Rect } from './buttons';
import { drawButton, drawOverlayPanel } from './drawButtons';
import { drawSpeedSelector, speedSelectorRects } from './speedSelector';
import { BUTTON, CONTROLS_HINT_LINES, FONT, MENU, SPEED_SELECTOR, TEXT_CHAR_WIDTH } from './uiConstants';

/** The panel, centred on the canvas. */
export function menuPanelRect(): Rect {
  return { x: (LOGICAL_WIDTH - MENU.width) / 2, y: (LOGICAL_HEIGHT - MENU.height) / 2, w: MENU.width, h: MENU.height };
}

/** The two controls-hint lines with their boxes, centred at the panel's foot. */
export function menuHintLines(): { text: string; baseline: number; rect: Rect }[] {
  const panel = menuPanelRect();
  return CONTROLS_HINT_LINES.map((text, i) => {
    const baseline = panel.y + MENU.hintBaseline + i * MENU.hintStep;
    const w = text.length * TEXT_CHAR_WIDTH.small;
    return { text, baseline, rect: { x: LOGICAL_WIDTH / 2 - w / 2, y: baseline - 11, w, h: 13 } };
  });
}

export function menuButtons(): ButtonRect[] {
  const top = menuPanelRect().y + MENU.buttonsTop;
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
  const panel = drawOverlayPanel(ctx, LOGICAL_WIDTH, LOGICAL_HEIGHT, MENU.width, MENU.height);
  ctx.fillStyle = PALETTE.text;
  ctx.font = FONT.heading;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('Menu', LOGICAL_WIDTH / 2, panel.y + MENU.headingY);
  for (const b of menuButtons()) {
    drawButton(ctx, b);
  }
  drawSpeedSelector(ctx, LOGICAL_WIDTH / 2, selectorTop(), speed);
  ctx.font = FONT.small;
  ctx.fillStyle = PALETTE.textDim;
  ctx.textAlign = 'center';
  for (const line of menuHintLines()) {
    ctx.fillText(line.text, LOGICAL_WIDTH / 2, line.baseline);
  }
}
