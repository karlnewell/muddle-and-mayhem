/**
 * Soldiers in every state: ash for the dead, a flattened ellipse for the
 * downed (with a medic prompt on friendlies while calls remain), and for
 * the standing a side-coloured disc with class letter, facing mark, HP bar
 * and cooldown bar. Selected soldiers get a dashed ring, a dashed path to
 * their destination and a reticle on their attack target. The flame cone
 * of a firing Scorcher is drawn here too, since it hangs off the soldier.
 */
import { WEAPONS, hpFraction, soldierById } from '../sim';
import type { BattleState, Command, Side, Soldier, Vec2 } from '../sim';
import { lerpPosition } from './interpolate';
import { CLASS_LETTER, PALETTE, SIDE_COLOUR, SIDE_COLOUR_DIM, SOLDIER_DRAW } from './palette';

function hpColour(fraction: number): string {
  if (fraction > 0.6) {
    return PALETTE.hpHigh;
  }
  return fraction > 0.3 ? PALETTE.hpMid : PALETTE.hpLow;
}

export function drawAsh(ctx: CanvasRenderingContext2D, s: Soldier): void {
  ctx.fillStyle = PALETTE.ash;
  ctx.beginPath();
  ctx.ellipse(s.x, s.y, SOLDIER_DRAW.ashRx, SOLDIER_DRAW.ashRy, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.ashFleck;
  ctx.beginPath();
  ctx.arc(s.x - 5, s.y - 2, 2, 0, Math.PI * 2);
  ctx.arc(s.x + 4, s.y + 3, 1.5, 0, Math.PI * 2);
  ctx.arc(s.x + 1, s.y - 4, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

export function drawDowned(ctx: CanvasRenderingContext2D, s: Soldier, showPrompt: boolean): void {
  ctx.fillStyle = SIDE_COLOUR_DIM[s.side];
  ctx.strokeStyle = PALETTE.outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(s.x, s.y, SOLDIER_DRAW.downedRx, SOLDIER_DRAW.downedRy, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  if (showPrompt) {
    ctx.fillStyle = PALETTE.medicCross;
    ctx.font = SOLDIER_DRAW.promptFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText('+', s.x, s.y - SOLDIER_DRAW.downedRy - 4);
  }
}

function drawBars(ctx: CanvasRenderingContext2D, s: Soldier, p: Vec2): void {
  const w = SOLDIER_DRAW.hpBarWidth;
  const h = SOLDIER_DRAW.hpBarHeight;
  const x = p.x - w / 2;
  const y = p.y - SOLDIER_DRAW.hpBarOffset;
  const fraction = hpFraction(s);
  ctx.fillStyle = PALETTE.hpBack;
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = hpColour(fraction);
  ctx.fillRect(x, y, w * fraction, h);
  const weaponCooldown = WEAPONS[s.cls].cooldown;
  if (s.cooldown > 0 && weaponCooldown > 0) {
    const cd = Math.min(1, s.cooldown / weaponCooldown);
    ctx.fillStyle = PALETTE.cooldown;
    ctx.fillRect(x, y + h + 1, w * cd, SOLDIER_DRAW.cooldownBarHeight);
  }
}

export function drawStanding(ctx: CanvasRenderingContext2D, s: Soldier, p: Vec2): void {
  const r = SOLDIER_DRAW.radius;
  ctx.fillStyle = SIDE_COLOUR[s.side];
  ctx.strokeStyle = PALETTE.outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // facing mark
  ctx.strokeStyle = PALETTE.outline;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(p.x + s.faceX * (r - SOLDIER_DRAW.facingInset), p.y + s.faceY * (r - SOLDIER_DRAW.facingInset));
  ctx.lineTo(p.x + s.faceX * (r + SOLDIER_DRAW.facingOutset), p.y + s.faceY * (r + SOLDIER_DRAW.facingOutset));
  ctx.stroke();
  ctx.fillStyle = PALETTE.text;
  ctx.font = SOLDIER_DRAW.letterFont;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(CLASS_LETTER[s.cls], p.x, p.y + 1);
  drawBars(ctx, s, p);
}

export function drawSelection(ctx: CanvasRenderingContext2D, state: BattleState, s: Soldier, p: Vec2, alpha: number): void {
  ctx.strokeStyle = PALETTE.selection;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.beginPath();
  if (s.status === 'standing') {
    ctx.arc(p.x, p.y, SOLDIER_DRAW.ringRadius, 0, Math.PI * 2);
  } else {
    ctx.ellipse(p.x, p.y, SOLDIER_DRAW.downedRx + 5, SOLDIER_DRAW.downedRy + 5, 0, 0, Math.PI * 2);
  }
  ctx.stroke();
  if (s.status === 'standing' && s.order.kind === 'move') {
    ctx.strokeStyle = PALETTE.path;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    for (const w of s.path) {
      ctx.lineTo(w.x, w.y);
    }
    ctx.lineTo(s.order.x, s.order.y);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(s.order.x - 5, s.order.y - 5);
    ctx.lineTo(s.order.x + 5, s.order.y + 5);
    ctx.moveTo(s.order.x + 5, s.order.y - 5);
    ctx.lineTo(s.order.x - 5, s.order.y + 5);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  if (s.status === 'standing' && s.order.kind === 'attack') {
    const target = soldierById(state, s.order.targetId);
    if (target !== undefined && target.status === 'standing') {
      const t = lerpPosition(target, alpha);
      const r = SOLDIER_DRAW.ringRadius + 2;
      ctx.strokeStyle = PALETTE.reticle;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
      ctx.moveTo(t.x - r - 4, t.y);
      ctx.lineTo(t.x - r + 6, t.y);
      ctx.moveTo(t.x + r - 6, t.y);
      ctx.lineTo(t.x + r + 4, t.y);
      ctx.moveTo(t.x, t.y - r - 4);
      ctx.lineTo(t.x, t.y - r + 6);
      ctx.moveTo(t.x, t.y + r - 6);
      ctx.lineTo(t.x, t.y + r + 4);
      ctx.stroke();
    }
  }
}

/** A translucent 60-degree wedge of weapon range along the Scorcher's facing while it fires. */
export function drawFlameCone(ctx: CanvasRenderingContext2D, s: Soldier, p: Vec2): void {
  const range = WEAPONS.scorcher.range;
  const facing = Math.atan2(s.faceY, s.faceX);
  const half = Math.PI / 6;
  ctx.fillStyle = PALETTE.flame;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.arc(p.x, p.y, range, facing - half, facing + half);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PALETTE.flameCore;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.arc(p.x, p.y, range * 0.55, facing - half * 0.6, facing + half * 0.6);
  ctx.closePath();
  ctx.fill();
}

function drawGhostMarker(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.beginPath();
  ctx.moveTo(x - 5, y - 5);
  ctx.lineTo(x + 5, y + 5);
  ctx.moveTo(x + 5, y - 5);
  ctx.lineTo(x - 5, y + 5);
  ctx.stroke();
}

/**
 * Orders the player has given that the sim has not applied yet (queued
 * while paused): a faint dashed line to a move point, a faint ring on an
 * attack target, a faint cross on a medic target. Gone the tick they apply.
 */
export function drawPendingOrders(ctx: CanvasRenderingContext2D, state: BattleState, pending: readonly Command[], alpha: number): void {
  if (pending.length === 0) {
    return;
  }
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 5]);
  for (const cmd of pending) {
    if (cmd.type === 'move') {
      ctx.strokeStyle = PALETTE.path;
      for (const id of cmd.soldierIds) {
        const s = soldierById(state, id);
        if (s === undefined || s.status !== 'standing') {
          continue;
        }
        const p = lerpPosition(s, alpha);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(cmd.x, cmd.y);
        ctx.stroke();
      }
      drawGhostMarker(ctx, cmd.x, cmd.y);
    } else if (cmd.type === 'attack') {
      const t = soldierById(state, cmd.targetId);
      if (t !== undefined && t.status === 'standing') {
        const p = lerpPosition(t, alpha);
        ctx.strokeStyle = PALETTE.reticle;
        ctx.beginPath();
        ctx.arc(p.x, p.y, SOLDIER_DRAW.ringRadius + 2, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (cmd.type === 'medic') {
      const t = soldierById(state, cmd.targetId);
      if (t !== undefined && t.status === 'downed') {
        ctx.strokeStyle = PALETTE.medicCross;
        ctx.beginPath();
        ctx.ellipse(t.x, t.y, SOLDIER_DRAW.downedRx + 5, SOLDIER_DRAW.downedRy + 5, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

export interface SoldierViewOptions {
  selection: readonly number[];
  alpha: number;
  playerSide: Side;
}

/** Everything soldier-related, in the layer order ash, downed, selection marks, standing, flame. */
export function drawSoldiers(ctx: CanvasRenderingContext2D, state: BattleState, view: SoldierViewOptions): void {
  const callsLeft = state.sides[view.playerSide].medicCalls > 0 && state.winner === null;
  for (const s of state.soldiers) {
    if (s.status === 'dead') {
      drawAsh(ctx, s);
    }
  }
  for (const s of state.soldiers) {
    if (s.status === 'downed') {
      const runUnderWay = state.medics.some((m) => m.targetId === s.id);
      drawDowned(ctx, s, s.side === view.playerSide && callsLeft && !runUnderWay);
    }
  }
  for (const id of view.selection) {
    const s = soldierById(state, id);
    if (s !== undefined && s.status !== 'dead') {
      drawSelection(ctx, state, s, lerpPosition(s, view.alpha), view.alpha);
    }
  }
  for (const s of state.soldiers) {
    if (s.status === 'standing') {
      drawStanding(ctx, s, lerpPosition(s, view.alpha));
    }
  }
  for (const s of state.soldiers) {
    if (s.status === 'standing' && s.cls === 'scorcher' && s.firing) {
      drawFlameCone(ctx, s, lerpPosition(s, view.alpha));
    }
  }
}
