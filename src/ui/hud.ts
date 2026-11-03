/**
 * The in-battle HUD (spec 4.8, Plan 7 layout): a top bar across the full
 * width with the title, badges, clock and squad counts; and a side panel
 * beside the field, on the player's side, with five soldier cards stacked
 * in slot order (slot number, name, class, HP, HP bar, cooldown bar,
 * status), both sides' medic calls, the pause status and the build
 * version. Cards double as buttons: `hudCardRects` gives their rectangles
 * so a click on one selects that slot. The controls hint lives on the
 * title screen and in the Esc menu, not here.
 */
import { CLASS_NAME, PALETTE, SIDE_COLOUR, SIDE_NAME } from '../render/palette';
import { FIELD_WIDTH, LOGICAL_WIDTH, TOP_BAR_HEIGHT, battleLayout } from '../render/renderConstants';
import { CLASS_ORDER, MAX_HP, WEAPONS, standingCount } from '../sim';
import type { BattleState, Side, Soldier } from '../sim';
import type { ButtonRect } from './buttons';
import { roundRect } from './drawButtons';
import { formatClock } from './text';
import { BUILD_VERSION } from '../game/buildVersion';
import { DEFAULT_SPEED, formatSpeed } from '../game/speed';
import { FONT, GAME_TITLE, HUD, SPEED_BADGE, STATUS_TEXT, TOP_BAR, TUNED_BADGE } from './uiConstants';

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

/** The side panel: below the top bar, on the player's side of the field. */
export function sidePanelRect(playerSide: Side): ButtonRect {
  return { id: 'panel', label: '', x: battleLayout(playerSide).panelX, y: HUD.top, w: HUD.width, h: HUD.height };
}

/** The five soldier cards, stacked top to bottom in slot order inside the side panel. */
export function hudCardRects(playerSide: Side): ButtonRect[] {
  const panel = sidePanelRect(playerSide);
  const rects: ButtonRect[] = [];
  for (let i = 0; i < HUD.cardCount; i++) {
    rects.push({
      id: `slot${i}`,
      label: '',
      x: panel.x + HUD.inset,
      y: panel.y + HUD.inset + i * (HUD.cardHeight + HUD.cardGap),
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
  const box = HUD.slotBox;
  ctx.fillStyle = SIDE_COLOUR[s.side];
  ctx.fillRect(rect.x + 6, rect.y + 6, box, box);
  ctx.fillStyle = PALETTE.text;
  ctx.font = FONT.bodyBold;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(slot + 1), rect.x + 6 + box / 2, rect.y + 6 + box / 2 + 1);
  // name and status on the first line, class and HP on the second
  const textX = rect.x + 6 + box + 8;
  const right = rect.x + rect.w - 8;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = FONT.bodyBold;
  ctx.fillText(s.name, textX, rect.y + 21);
  ctx.textAlign = 'right';
  ctx.font = FONT.smallBold;
  ctx.fillStyle = s.status === 'standing' ? PALETTE.hpHigh : PALETTE.hpLow;
  ctx.fillText(statusOf(s), right, rect.y + 21);
  ctx.textAlign = 'left';
  ctx.font = FONT.small;
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText(CLASS_NAME[s.cls], textX, rect.y + 39);
  ctx.textAlign = 'right';
  ctx.fillText(`HP ${Math.max(0, Math.floor(s.hp))}`, right, rect.y + 39);
  ctx.textAlign = 'left';
  // hp bar
  const barX = rect.x + 8;
  const barW = rect.w - 16;
  const barY = rect.y + 46;
  ctx.fillStyle = PALETTE.hpBack;
  ctx.fillRect(barX, barY, barW, HUD.hpBarHeight);
  const fraction = Math.max(0, Math.min(1, s.hp / MAX_HP));
  ctx.fillStyle = hpColour(fraction);
  ctx.fillRect(barX, barY, barW * fraction, HUD.hpBarHeight);
  // cooldown bar
  const weapon = WEAPONS[s.cls];
  const cdY = barY + HUD.hpBarHeight + 4;
  ctx.fillStyle = PALETTE.hpBack;
  ctx.fillRect(barX, cdY, barW, HUD.cooldownBarHeight);
  if (weapon.cooldown > 0 && s.cooldown > 0) {
    ctx.fillStyle = PALETTE.cooldown;
    ctx.fillRect(barX, cdY, barW * Math.min(1, s.cooldown / weapon.cooldown), HUD.cooldownBarHeight);
  }
  ctx.globalAlpha = 1;
}

/** Below the cards: both sides' medic calls in a box, then PAUSED while paused, then the build stamp. */
function drawPanelFooter(ctx: CanvasRenderingContext2D, state: BattleState, view: HudView): void {
  const panel = sidePanelRect(view.playerSide);
  const x = panel.x + HUD.inset;
  const w = HUD.cardWidth;
  const y = panel.y + HUD.medicTop;
  roundRect(ctx, x, y, w, HUD.medicHeight, HUD.cardRadius);
  ctx.fillStyle = PALETTE.panel;
  ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = FONT.smallBold;
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText('MEDIC CALLS', x + 10, y + 18);
  const sides: Side[] = ['blue', 'red'];
  sides.forEach((side, i) => {
    const rowY = y + 36 + i * 16;
    ctx.fillStyle = SIDE_COLOUR[side];
    ctx.fillRect(x + 10, rowY - 10, 10, 10);
    ctx.fillStyle = PALETTE.text;
    ctx.font = FONT.small;
    ctx.fillText(SIDE_NAME[side], x + 26, rowY);
    const calls = state.sides[side].medicCalls;
    ctx.font = FONT.bodyBold;
    ctx.textAlign = 'right';
    ctx.fillText('+'.repeat(calls) + '·'.repeat(Math.max(0, 3 - calls)), x + w - 10, rowY);
    ctx.textAlign = 'left';
  });
  if (view.paused) {
    ctx.font = FONT.bodyBold;
    ctx.fillStyle = PALETTE.selection;
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', panel.x + panel.w / 2, panel.y + HUD.pausedBaseline);
  }
  ctx.font = FONT.debug;
  ctx.fillStyle = PALETTE.textDim;
  ctx.textAlign = 'right';
  ctx.fillText(BUILD_VERSION, x + w, panel.y + HUD.buildBaseline);
  ctx.textAlign = 'left';
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

function drawPausedBanner(ctx: CanvasRenderingContext2D, playerSide: Side): void {
  const w = 420;
  const h = 40;
  const centreX = battleLayout(playerSide).fieldX + FIELD_WIDTH / 2;
  const x = centreX - w / 2;
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
  ctx.fillText('PAUSED   press Space to resume', centreX, y + h / 2 + 1);
}

export function drawHud(ctx: CanvasRenderingContext2D, state: BattleState, view: HudView): void {
  drawTopBar(ctx, state, view);
  const panel = sidePanelRect(view.playerSide);
  ctx.fillStyle = PALETTE.pageBackground;
  ctx.fillRect(panel.x, panel.y, panel.w, panel.h);
  const sideIndex = view.playerSide === 'blue' ? 0 : 1;
  hudCardRects(view.playerSide).forEach((rect, i) => {
    const s = state.soldiers[sideIndex * CLASS_ORDER.length + i];
    if (s !== undefined) {
      drawCard(ctx, rect, i, s, view.selection.includes(s.id));
    }
  });
  drawPanelFooter(ctx, state, view);
  if (view.paused && state.winner === null) {
    drawPausedBanner(ctx, view.playerSide);
  }
}
