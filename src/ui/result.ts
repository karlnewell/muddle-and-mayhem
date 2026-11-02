/** The result screen (spec 4.7): who won, soldiers standing, time, Play again and Title. */
import { PALETTE, SIDE_COLOUR, SIDE_NAME } from '../render/palette';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../render/renderConstants';
import { standingCount } from '../sim';
import type { BattleState, Side } from '../sim';
import { stackButtons } from './buttons';
import type { ButtonRect } from './buttons';
import { drawButton, drawOverlayPanel } from './drawButtons';
import { formatClock } from './text';
import { BUTTON, FONT } from './uiConstants';

const PANEL_HEIGHT = 340;

export function resultButtons(): ButtonRect[] {
  const top = (LOGICAL_HEIGHT - PANEL_HEIGHT) / 2 + 200;
  return stackButtons(
    [
      { id: 'playAgain', label: 'Play again' },
      { id: 'title', label: 'Title' },
    ],
    LOGICAL_WIDTH / 2,
    top,
    BUTTON.width,
    BUTTON.height,
    BUTTON.gap,
  );
}

export function winnerText(winner: Side | 'draw' | null, playerSide: Side): string {
  if (winner === null) {
    return '';
  }
  if (winner === 'draw') {
    return 'A draw. Both squads are down.';
  }
  return winner === playerSide ? `${SIDE_NAME[winner]} wins!` : `${SIDE_NAME[winner]} wins.`;
}

export function drawResult(ctx: CanvasRenderingContext2D, state: BattleState, playerSide: Side): void {
  const panel = drawOverlayPanel(ctx, LOGICAL_WIDTH, LOGICAL_HEIGHT, PANEL_HEIGHT);
  const winner = state.winner;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = FONT.heading;
  ctx.fillStyle = winner === 'draw' || winner === null ? PALETTE.text : SIDE_COLOUR[winner];
  ctx.fillText(winnerText(winner, playerSide), LOGICAL_WIDTH / 2, panel.y + 64);
  ctx.font = FONT.body;
  ctx.fillStyle = PALETTE.text;
  const blue = standingCount(state, 'blue');
  const red = standingCount(state, 'red');
  ctx.fillText(`Standing:  ${SIDE_NAME.blue} ${blue}   ${SIDE_NAME.red} ${red}`, LOGICAL_WIDTH / 2, panel.y + 112);
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText(`Time ${formatClock(state.tick)}    Seed ${state.seed}`, LOGICAL_WIDTH / 2, panel.y + 144);
  for (const b of resultButtons()) {
    drawButton(ctx, b);
  }
}
