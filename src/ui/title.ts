/**
 * The title screen (spec 4.7): the name, two placeholder portraits of the
 * rival generals, a Skirmish button, the game speed selector, and the
 * controls. Any click off the selector starts a battle; the button is
 * there so it is obvious where to click.
 */
import { PALETTE, SIDE_COLOUR, SIDE_NAME } from '../render/palette';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../render/renderConstants';
import type { Side } from '../sim';
import { stackButtons } from './buttons';
import type { ButtonRect } from './buttons';
import { drawButton } from './drawButtons';
import { drawSpeedSelector, speedSelectorRects } from './speedSelector';
import { BUTTON, FONT, GAME_TITLE, SPEED_SELECTOR, TITLE_CONTROLS, TITLE_CONTROLS_TOP } from './uiConstants';

export function titleButtons(): ButtonRect[] {
  return stackButtons([{ id: 'start', label: 'Skirmish' }], LOGICAL_WIDTH / 2, LOGICAL_HEIGHT * 0.56, BUTTON.width, BUTTON.height, BUTTON.gap);
}

/** The speed selector's segments on the title screen. */
export function titleSpeedRects(): ButtonRect[] {
  return speedSelectorRects(LOGICAL_WIDTH / 2, SPEED_SELECTOR.titleTop);
}

function drawPortrait(ctx: CanvasRenderingContext2D, side: Side, cx: number, cy: number, initial: string): void {
  const r = 56;
  ctx.fillStyle = SIDE_COLOUR[side];
  ctx.strokeStyle = PALETTE.outline;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // a peaked cap
  ctx.fillStyle = PALETTE.outline;
  ctx.fillRect(cx - r + 6, cy - r + 10, 2 * r - 12, 14);
  ctx.fillRect(cx - r - 6, cy - r + 22, 2 * r + 12, 6);
  // eyes
  ctx.fillStyle = PALETTE.text;
  ctx.beginPath();
  ctx.arc(cx - 18, cy - 4, 7, 0, Math.PI * 2);
  ctx.arc(cx + 18, cy - 4, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.outline;
  ctx.beginPath();
  ctx.arc(cx - 16 + (side === 'blue' ? 2 : -2), cy - 4, 3, 0, Math.PI * 2);
  ctx.arc(cx + 20 + (side === 'blue' ? 2 : -2), cy - 4, 3, 0, Math.PI * 2);
  ctx.fill();
  // moustache
  ctx.strokeStyle = PALETTE.outline;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx - 20, cy + 22);
  ctx.quadraticCurveTo(cx, cy + 12, cx + 20, cy + 22);
  ctx.stroke();
  ctx.fillStyle = PALETTE.text;
  ctx.font = FONT.bodyBold;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(SIDE_NAME[side], cx, cy + r + 28);
  ctx.font = FONT.small;
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText(initial, cx, cy + r + 46);
}

export function drawTitle(ctx: CanvasRenderingContext2D, speed: number): void {
  ctx.fillStyle = PALETTE.pageBackground;
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  ctx.fillStyle = PALETTE.text;
  ctx.font = FONT.title;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(GAME_TITLE, LOGICAL_WIDTH / 2, LOGICAL_HEIGHT * 0.2);
  ctx.font = FONT.subtitle;
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText('Two bumbling generals. Five soldiers each. One crossroads.', LOGICAL_WIDTH / 2, LOGICAL_HEIGHT * 0.2 + 36);

  drawPortrait(ctx, 'blue', LOGICAL_WIDTH / 2 - 220, LOGICAL_HEIGHT * 0.39, 'you');
  drawPortrait(ctx, 'red', LOGICAL_WIDTH / 2 + 220, LOGICAL_HEIGHT * 0.39, 'the computer');
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = FONT.heading;
  ctx.textAlign = 'center';
  ctx.fillText('vs', LOGICAL_WIDTH / 2, LOGICAL_HEIGHT * 0.39 + 12);

  for (const b of titleButtons()) {
    drawButton(ctx, b);
  }
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = FONT.small;
  ctx.textAlign = 'center';
  ctx.fillText('or click anywhere to start', LOGICAL_WIDTH / 2, LOGICAL_HEIGHT * 0.56 + BUTTON.height + 24);
  drawSpeedSelector(ctx, LOGICAL_WIDTH / 2, SPEED_SELECTOR.titleTop, speed);

  ctx.font = FONT.body;
  ctx.fillStyle = PALETTE.text;
  ctx.textAlign = 'center';
  TITLE_CONTROLS.forEach((line, i) => {
    ctx.fillText(line, LOGICAL_WIDTH / 2, TITLE_CONTROLS_TOP + i * 26);
  });
}
