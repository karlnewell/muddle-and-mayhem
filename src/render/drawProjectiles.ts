/**
 * Projectiles and medic runs. Direct rounds are interpolated between
 * their previous and current positions; lobbed rounds follow a render-only
 * parabola between launch point and landing point, with a shadow on the
 * ground so the player can see where they will land. Medics are a white
 * disc with a red cross and a dashed line to the body they run for.
 */
import { soldierById } from '../sim';
import type { BattleState, MedicRun, Projectile } from '../sim';
import { lerpPosition } from './interpolate';
import { PALETTE } from './palette';
import { LOB_ARC_HEIGHT, ROCKET_TRAIL } from './renderConstants';

function drawDirect(ctx: CanvasRenderingContext2D, p: Projectile, alpha: number): void {
  const pos = lerpPosition(p, alpha);
  const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy) || 1;
  const ux = p.vx / speed;
  const uy = p.vy / speed;
  if (p.weapon === 'launcher') {
    ctx.strokeStyle = PALETTE.rocketTrail;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(pos.x - ux * ROCKET_TRAIL, pos.y - uy * ROCKET_TRAIL);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.fillStyle = PALETTE.rocket;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, 4, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.strokeStyle = PALETTE.bullet;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(pos.x - ux * 6, pos.y - uy * 6);
  ctx.lineTo(pos.x, pos.y);
  ctx.stroke();
}

function drawLobbed(ctx: CanvasRenderingContext2D, p: Projectile, tick: number, alpha: number): void {
  const span = Math.max(1, p.landTick - p.launchTick);
  const t = Math.max(0, Math.min(1, (tick + alpha - p.launchTick) / span));
  const gx = p.startX + (p.targetX - p.startX) * t;
  const gy = p.startY + (p.targetY - p.startY) * t;
  const height = LOB_ARC_HEIGHT * 4 * t * (1 - t);
  ctx.fillStyle = PALETTE.shadow;
  ctx.beginPath();
  ctx.ellipse(gx, gy, 5, 3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = p.weapon === 'blaster' ? PALETTE.dynamite : PALETTE.grenade;
  ctx.strokeStyle = PALETTE.outline;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(gx, gy - height, p.weapon === 'blaster' ? 5 : 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

export function drawProjectiles(ctx: CanvasRenderingContext2D, state: BattleState, alpha: number): void {
  for (const p of state.projectiles) {
    if (p.kind === 'direct') {
      drawDirect(ctx, p, alpha);
    } else {
      drawLobbed(ctx, p, state.tick, alpha);
    }
  }
}

function drawMedic(ctx: CanvasRenderingContext2D, state: BattleState, m: MedicRun, alpha: number): void {
  const pos = lerpPosition(m, alpha);
  const target = soldierById(state, m.targetId);
  if (target !== undefined) {
    ctx.strokeStyle = PALETTE.medicLine;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(target.x, target.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.fillStyle = PALETTE.medic;
  ctx.strokeStyle = PALETTE.outline;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = PALETTE.medicCross;
  ctx.fillRect(pos.x - 1.5, pos.y - 6, 3, 12);
  ctx.fillRect(pos.x - 6, pos.y - 1.5, 12, 3);
}

export function drawMedics(ctx: CanvasRenderingContext2D, state: BattleState, alpha: number): void {
  for (const m of state.medics) {
    drawMedic(ctx, state, m, alpha);
  }
}
