/**
 * The in-battle HUD (spec 4.8): a top bar with the clock, enemies standing
 * and the pause state; a bottom strip with five soldier cards for the
 * player's squad (slot number, name, class, HP bar, cooldown bar, status),
 * a side panel with both sides' medic calls and the build version, and a
 * controls hint. Cards
 * double as buttons: `hudCardRects` gives their rectangles so a click on
 * one selects that slot.
 */
import { CLASS_NAME, PALETTE, SIDE_COLOUR, SIDE_NAME } from '../render/palette';
import { LOGICAL_WIDTH, TOP_BAR_HEIGHT } from '../render/renderConstants';
import { CLASS_ORDER, MAX_HP, WEAPONS, standingCount } from '../sim';
import type { BattleState, Side, Soldier } from '../sim';
import type { ButtonRect } from './buttons';
import { roundRect } from './drawButtons';
import { formatClock } from './text';
import { BUILD_VERSION } from '../game/buildVersion';
import { DEFAULT_SPEED, formatSpeed } from '../game/speed';
import { BUILD_LABEL, CONTROLS_HINT, FONT, GAME_TITLE, HUD, SPEED_BADGE, STATUS_TEXT, TOP_BAR, TUNED_BADGE } from './uiConstants';

export interface HudView {
  playerSide: Side;
  selection: readonly number[];
  paused: boolean;
  /** True while a `?tune=` override is in force: the top bar shows the TUNED badge. */
  tuned: boolean;
  /** The game speed; anything but the half-speed default shows the SPEED badge. Absent means the default. */
  speed?: number;
}

/** The TUNED badge rectangle, fixed so a test can read its pixels. */
export function tunedBadgeRect(): ButtonRect {
  return { id: 'tuned', label: 'TUNED', x: TUNED_BADGE.x, y: TUNED_BADGE.y, w: TUNED_BADGE.w, h: TUNED_BADGE.h };
}

/** The SPEED badge rectangle, beside the TUNED badge's place whether or not that badge is shown. */
export function speedBadgeRect(speed: number): ButtonRect {
  return { id: 'speed', label: `SPEED ${formatSpeed(speed)}`, x: SPEED_BADGE.x, y: SPEED_BADGE.y, w: SPEED_BADGE.w, h: SPEED_BADGE.h };
}

function drawBadge(ctx: CanvasRenderingContext2D, r: ButtonRect): void {
  roundRect(ctx, r.x, r.y, r.w, r.h, TUNED_BADGE.radius);
  ctx.fillStyle = PALETTE.selection;
  ctx.fill();
  ctx.fillStyle = PALETTE.pageBackground;
  ctx.font = FONT.smallBold;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(r.label, r.x + r.w / 2, r.y + r.h / 2 + 1);
}

export function hudCardRects(): ButtonRect[] {
  const rects: ButtonRect[] = [];
  for (let i = 0; i < HUD.cardCount; i++) {
    rects.push({
      id: `slot${i}`,
      label: '',
      x: HUD.cardX + i * (HUD.cardWidth + HUD.cardGap),
      y: HUD.top + HUD.cardY,
      w: HUD.cardWidth,
      h: HUD.cardHeight,
    });
  }
  return rects;
}

function hpColour(fraction: number): string {
  if (fraction > 0.6) {
    return PALETTE.hpHigh;
  }
  return fraction > 0.3 ? PALETTE.hpMid : PALETTE.hpLow;
}

function statusOf(s: Soldier): string {
  if (s.status !== 'standing') {
    return STATUS_TEXT[s.status];
  }
  const weapon = WEAPONS[s.cls];
  return weapon.cooldown > 0 && s.cooldown > weapon.cooldown ? STATUS_TEXT.jam : STATUS_TEXT.standing;
}

function drawCard(ctx: CanvasRenderingContext2D, rect: ButtonRect, slot: number, s: Soldier, selected: boolean): void {
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, HUD.cardRadius);
  ctx.fillStyle = PALETTE.panel;
  ctx.fill();
  ctx.strokeStyle = selected ? PALETTE.selection : PALETTE.panelEdge;
  ctx.lineWidth = selected ? 3 : 2;
  ctx.stroke();

  const dim = s.status !== 'standing';
  ctx.globalAlpha = dim ? 0.6 : 1;
  // slot box
  ctx.fillStyle = SIDE_COLOUR[s.side];
  ctx.fillRect(rect.x + 8, rect.y + 8, HUD.slotBox, HUD.slotBox);
  ctx.fillStyle = PALETTE.text;
  ctx.font = FONT.bodyBold;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(slot + 1), rect.x + 8 + HUD.slotBox / 2, rect.y + 8 + HUD.slotBox / 2 + 1);
  // name and class
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = FONT.bodyBold;
  ctx.fillText(s.name, rect.x + 40, rect.y + 22);
  ctx.font = FONT.small;
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText(CLASS_NAME[s.cls], rect.x + 40, rect.y + 38);
  // status
  ctx.textAlign = 'right';
  ctx.font = FONT.smallBold;
  ctx.fillStyle = s.status === 'standing' ? PALETTE.hpHigh : PALETTE.hpLow;
  ctx.fillText(statusOf(s), rect.x + rect.w - 10, rect.y + 22);
  ctx.textAlign = 'left';
  // hp bar
  const barX = rect.x + 10;
  const barW = rect.w - 20;
  const barY = rect.y + 52;
  ctx.fillStyle = PALETTE.hpBack;
  ctx.fillRect(barX, barY, barW, HUD.hpBarHeight);
  const fraction = Math.max(0, Math.min(1, s.hp / MAX_HP));
  ctx.fillStyle = hpColour(fraction);
  ctx.fillRect(barX, barY, barW * fraction, HUD.hpBarHeight);
  ctx.font = FONT.small;
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText(`HP ${Math.max(0, Math.floor(s.hp))}`, barX, barY + HUD.hpBarHeight + 16);
  // cooldown bar
  const weapon = WEAPONS[s.cls];
  const cdY = barY + HUD.hpBarHeight + 22;
  ctx.fillStyle = PALETTE.hpBack;
  ctx.fillRect(barX, cdY, barW, HUD.cooldownBarHeight);
  if (weapon.cooldown > 0 && s.cooldown > 0) {
    ctx.fillStyle = PALETTE.cooldown;
    ctx.fillRect(barX, cdY, barW * Math.min(1, s.cooldown / weapon.cooldown), HUD.cooldownBarHeight);
  }
  ctx.globalAlpha = 1;
}

function drawSidePanel(ctx: CanvasRenderingContext2D, state: BattleState, view: HudView): void {
  const x = HUD.panelX;
  const y = HUD.top + HUD.cardY;
  roundRect(ctx, x, y, HUD.panelWidth, HUD.cardHeight, HUD.cardRadius);
  ctx.fillStyle = PALETTE.panel;
  ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = FONT.smallBold;
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText('MEDIC CALLS', x + 12, y + 22);
  const sides: Side[] = ['blue', 'red'];
  sides.forEach((side, i) => {
    const rowY = y + 44 + i * 22;
    ctx.fillStyle = SIDE_COLOUR[side];
    ctx.fillRect(x + 12, rowY - 11, 12, 12);
    ctx.fillStyle = PALETTE.text;
    ctx.font = FONT.small;
    ctx.fillText(SIDE_NAME[side], x + 32, rowY);
    const calls = state.sides[side].medicCalls;
    ctx.font = FONT.bodyBold;
    ctx.textAlign = 'right';
    ctx.fillText('+'.repeat(calls) + '·'.repeat(Math.max(0, 3 - calls)), x + HUD.panelWidth - 12, rowY);
    ctx.textAlign = 'left';
  });
  ctx.font = FONT.debug;
  ctx.fillStyle = PALETTE.textDim;
  ctx.textAlign = 'right';
  ctx.fillText(BUILD_VERSION, x + HUD.panelWidth - BUILD_LABEL.panelInset, HUD.top + BUILD_LABEL.panelBaseline);
  ctx.textAlign = 'left';
  if (view.paused) {
    ctx.font = FONT.bodyBold;
    ctx.fillStyle = PALETTE.selection;
    ctx.textAlign = 'right';
    ctx.fillText('PAUSED', x + HUD.panelWidth - 12, y + 22);
    ctx.textAlign = 'left';
  }
}

function drawTopBar(ctx: CanvasRenderingContext2D, state: BattleState, view: HudView): void {
  ctx.fillStyle = PALETTE.panel;
  ctx.fillRect(0, 0, LOGICAL_WIDTH, TOP_BAR.height);
  ctx.textBaseline = 'middle';
  ctx.font = FONT.bodyBold;
  ctx.fillStyle = PALETTE.text;
  ctx.textAlign = 'left';
  ctx.fillText(GAME_TITLE, TOP_BAR.padding, TOP_BAR.height / 2 + 1);
  if (view.tuned) {
    drawBadge(ctx, tunedBadgeRect());
  }
  if (view.speed !== undefined && view.speed !== DEFAULT_SPEED) {
    drawBadge(ctx, speedBadgeRect(view.speed));
  }
  ctx.textBaseline = 'middle';
  ctx.font = FONT.bodyBold;
  ctx.fillStyle = PALETTE.text;
  ctx.textAlign = 'center';
  ctx.fillText(formatClock(state.tick), LOGICAL_WIDTH / 2, TOP_BAR.height / 2 + 1);
  const enemy: Side = view.playerSide === 'blue' ? 'red' : 'blue';
  ctx.textAlign = 'right';
  ctx.font = FONT.body;
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText(
    `Squad ${standingCount(state, view.playerSide)} / ${CLASS_ORDER.length}    Enemies ${standingCount(state, enemy)} / ${CLASS_ORDER.length}`,
    LOGICAL_WIDTH - TOP_BAR.padding,
    TOP_BAR.height / 2 + 1,
  );
}

function drawPausedBanner(ctx: CanvasRenderingContext2D): void {
  const w = 420;
  const h = 40;
  const x = (LOGICAL_WIDTH - w) / 2;
  const y = TOP_BAR_HEIGHT + 12;
  roundRect(ctx, x, y, w, h, 8);
  ctx.fillStyle = PALETTE.pausedBanner;
  ctx.fill();
  ctx.strokeStyle = PALETTE.selection;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = PALETTE.selection;
  ctx.font = FONT.banner;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('PAUSED   press Space to resume', LOGICAL_WIDTH / 2, y + h / 2 + 1);
}

export function drawHud(ctx: CanvasRenderingContext2D, state: BattleState, view: HudView): void {
  drawTopBar(ctx, state, view);
  ctx.fillStyle = PALETTE.pageBackground;
  ctx.fillRect(0, HUD.top, LOGICAL_WIDTH, HUD.height);
  const rects = hudCardRects();
  const sideIndex = view.playerSide === 'blue' ? 0 : 1;
  rects.forEach((rect, i) => {
    const s = state.soldiers[sideIndex * CLASS_ORDER.length + i];
    if (s !== undefined) {
      drawCard(ctx, rect, i, s, view.selection.includes(s.id));
    }
  });
  drawSidePanel(ctx, state, view);
  ctx.font = FONT.small;
  ctx.fillStyle = PALETTE.textDim;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(CONTROLS_HINT, LOGICAL_WIDTH / 2, HUD.top + HUD.hintY);
  if (view.paused && state.winner === null) {
    drawPausedBanner(ctx);
  }
}
