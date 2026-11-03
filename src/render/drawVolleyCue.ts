/**
 * Draws the volley cue: a line from each ordered soldier to the target, a
 * ring that grows out from the target, and a VOLLEY label above it, all in
 * the side's colour and fading out as `progress` runs from 0 to 1.
 */
import { soldierById } from '../sim';
import type { BattleState, Side } from '../sim';
import { lerpPosition } from './interpolate';
import { FONT_FAMILY, PALETTE, SIDE_COLOUR, SOLDIER_DRAW } from './palette';
import { VOLLEY_LABEL_OFFSET, VOLLEY_LINE_WIDTH, VOLLEY_RING_GROWTH } from './renderConstants';
import { volleyCueShooters } from './volleyCue';
import type { VolleyCue } from './volleyCue';

export interface VolleyView {
  cue: VolleyCue;
  /** 0 when given, 1 when over. */
  progress: number;
  side: Side;
}

export function drawVolleyCue(ctx: CanvasRenderingContext2D, state: BattleState, view: VolleyView, alpha: number): void {
  const shooters = volleyCueShooters(state, view.cue);
  const target = soldierById(state, view.cue.targetId);
  if (shooters.length === 0 || target === undefined || view.progress >= 1) {
    return;
  }
  const t = lerpPosition(target, alpha);
  const colour = SIDE_COLOUR[view.side];
  ctx.globalAlpha = 1 - view.progress;
  ctx.strokeStyle = colour;
  ctx.lineWidth = VOLLEY_LINE_WIDTH;
  ctx.beginPath();
  for (const s of shooters) {
    const p = lerpPosition(s, alpha);
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(t.x, t.y);
  }
  ctx.stroke();
  // a white core under a side-coloured ring, so the flash reads on dark ground too
  const r = SOLDIER_DRAW.ringRadius + VOLLEY_RING_GROWTH * view.progress;
  ctx.lineWidth = VOLLEY_LINE_WIDTH + 2;
  ctx.strokeStyle = PALETTE.text;
  ctx.beginPath();
  ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = VOLLEY_LINE_WIDTH;
  ctx.strokeStyle = colour;
  ctx.stroke();
  ctx.font = `bold 16px ${FONT_FAMILY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.lineWidth = 3;
  ctx.strokeStyle = PALETTE.outline;
  ctx.strokeText('VOLLEY', t.x, t.y - VOLLEY_LABEL_OFFSET);
  ctx.fillStyle = PALETTE.text;
  ctx.fillText('VOLLEY', t.x, t.y - VOLLEY_LABEL_OFFSET);
  ctx.globalAlpha = 1;
}
