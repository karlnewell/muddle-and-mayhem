/**
 * Transient effects: expanding impact rings, hit flashes, muzzle flashes,
 * revive pulses and a JAM label. Fades use sim-tick progress plus the
 * frame alpha, so a paused battle shows them frozen.
 */
import { soldierById } from '../sim';
import type { BattleState } from '../sim';
import { effectProgress } from './effects';
import type { Effect } from './effects';
import { lerpPosition } from './interpolate';
import { FONT_FAMILY, IMPACT_COLOUR, PALETTE, SOLDIER_DRAW } from './palette';

export function drawEffects(ctx: CanvasRenderingContext2D, state: BattleState, effects: readonly Effect[], alpha: number): void {
  for (const f of effects) {
    const t = effectProgress(f, state.tick, alpha);
    const fade = 1 - t;
    switch (f.kind) {
      case 'impact': {
        const r = Math.max(6, f.radius) * (0.4 + 0.6 * t);
        ctx.globalAlpha = fade;
        ctx.strokeStyle = IMPACT_COLOUR[f.weapon];
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(f.x, f.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = PALETTE.impact;
        ctx.beginPath();
        ctx.arc(f.x, f.y, Math.max(2, 6 * fade), 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        break;
      }
      case 'hit': {
        const s = soldierById(state, f.soldierId);
        if (s === undefined) {
          break;
        }
        const p = lerpPosition(s, alpha);
        ctx.globalAlpha = fade;
        ctx.strokeStyle = PALETTE.hitFlash;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, SOLDIER_DRAW.radius + 2, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      }
      case 'muzzle': {
        const s = soldierById(state, f.soldierId);
        if (s === undefined) {
          break;
        }
        const p = lerpPosition(s, alpha);
        ctx.globalAlpha = fade;
        ctx.fillStyle = IMPACT_COLOUR[f.weapon];
        ctx.beginPath();
        ctx.arc(p.x + s.faceX * (SOLDIER_DRAW.radius + 4), p.y + s.faceY * (SOLDIER_DRAW.radius + 4), 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        break;
      }
      case 'revive': {
        const s = soldierById(state, f.soldierId);
        if (s === undefined) {
          break;
        }
        ctx.globalAlpha = fade;
        ctx.strokeStyle = PALETTE.revive;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(s.x, s.y, SOLDIER_DRAW.radius + 4 + 20 * t, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      }
      case 'jam': {
        const s = soldierById(state, f.soldierId);
        if (s === undefined) {
          break;
        }
        const p = lerpPosition(s, alpha);
        ctx.globalAlpha = Math.min(1, fade * 2);
        ctx.fillStyle = PALETTE.jam;
        ctx.font = `bold 12px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('JAM', p.x, p.y - SOLDIER_DRAW.hpBarOffset - 6 - 6 * t);
        ctx.globalAlpha = 1;
        break;
      }
    }
  }
}
