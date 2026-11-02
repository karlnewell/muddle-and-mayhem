/**
 * The result screen (spec 4.7): who won, soldiers standing, time and seed,
 * the per-class battle report, and Play again, Copy report and Title. The
 * report rows come from `src/stats/reportText.ts`; this file only places
 * them. The copy button's label follows `CopyState` so the player sees
 * whether the clipboard took the text or the fallback overlay has it.
 */
import { PALETTE, SIDE_COLOUR, SIDE_NAME } from '../render/palette';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../render/renderConstants';
import { standingCount } from '../sim';
import type { BattleState, Side } from '../sim';
import { stackButtons } from './buttons';
import type { ButtonRect } from './buttons';
import { drawButton, drawOverlayPanel } from './drawButtons';
import { formatClock } from './text';
import { BUTTON, FONT, RESULT } from './uiConstants';

export type CopyState = 'idle' | 'copied' | 'shown';

export interface ResultView {
  /** `formatReportRows(stats)`: the header, then class and total rows. */
  rows: readonly string[];
  copyState: CopyState;
}

const COPY_LABEL: Readonly<Record<CopyState, string>> = {
  idle: 'Copy report',
  copied: 'Copied',
  shown: 'Report shown below',
};

function panelTop(): number {
  return (LOGICAL_HEIGHT - RESULT.panelHeight) / 2;
}

/** The canvas y just below the last table row. */
export function resultTableBottom(): number {
  return panelTop() + RESULT.tableTop + RESULT.tableRows * RESULT.rowHeight;
}

export function resultButtons(copyState: CopyState): ButtonRect[] {
  return stackButtons(
    [
      { id: 'playAgain', label: 'Play again' },
      { id: 'copyReport', label: COPY_LABEL[copyState] },
      { id: 'title', label: 'Title' },
    ],
    LOGICAL_WIDTH / 2,
    panelTop() + RESULT.buttonsTop,
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

function drawTable(ctx: CanvasRenderingContext2D, panelX: number, rows: readonly string[]): void {
  ctx.font = FONT.debug;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const x = panelX + RESULT.tableX;
  rows.forEach((row, i) => {
    const y = panelTop() + RESULT.tableTop + (i + 0.5) * RESULT.rowHeight;
    const isTotal = row.includes(' total ');
    ctx.fillStyle = i === 0 ? PALETTE.textDim : isTotal ? PALETTE.text : PALETTE.debugText;
    ctx.font = isTotal ? FONT.debugBold : FONT.debug;
    ctx.fillText(row, x, y);
  });
  ctx.textBaseline = 'alphabetic';
}

export function drawResult(ctx: CanvasRenderingContext2D, state: BattleState, playerSide: Side, view: ResultView): void {
  const panel = drawOverlayPanel(ctx, LOGICAL_WIDTH, LOGICAL_HEIGHT, RESULT.panelWidth, RESULT.panelHeight);
  const winner = state.winner;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.font = FONT.heading;
  ctx.fillStyle = winner === 'draw' || winner === null ? PALETTE.text : SIDE_COLOUR[winner];
  ctx.fillText(winnerText(winner, playerSide), LOGICAL_WIDTH / 2, panel.y + RESULT.headingY);
  ctx.font = FONT.body;
  ctx.fillStyle = PALETTE.text;
  const blue = standingCount(state, 'blue');
  const red = standingCount(state, 'red');
  ctx.fillText(`Standing:  ${SIDE_NAME.blue} ${blue}   ${SIDE_NAME.red} ${red}`, LOGICAL_WIDTH / 2, panel.y + RESULT.standingY);
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText(`Time ${formatClock(state.tick)}    Seed ${state.seed}`, LOGICAL_WIDTH / 2, panel.y + RESULT.infoY);
  drawTable(ctx, panel.x, view.rows);
  for (const b of resultButtons(view.copyState)) {
    drawButton(ctx, b);
  }
}
