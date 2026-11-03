/**
 * The title screen (spec 4.7): the name, two placeholder portraits of the
 * rival generals flanking it, a Skirmish button, the game speed selector,
 * the controls, and the build in the bottom-right corner. Any click off the
 * selector starts a battle; the button is there so it is obvious where to
 * click. `titleLayout` gives every element's box, so a test can check that
 * nothing overlaps or leaves the 520-high canvas, and drawing uses the
 * same positions.
 */
import { BUILD_VERSION } from '../game/buildVersion';
import { PALETTE, SIDE_COLOUR, SIDE_NAME } from '../render/palette';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../render/renderConstants';
import type { Side } from '../sim';
import { stackButtons } from './buttons';
import type { ButtonRect, Rect } from './buttons';
import { drawButton } from './drawButtons';
import { SPEED_HINT, SPEED_LABEL, drawSpeedSelector, speedSelectorRects } from './speedSelector';
import { BUILD_LABEL, BUTTON, FONT, GAME_TITLE, SPEED_SELECTOR, TEXT_CHAR_WIDTH, TITLE, TITLE_CONTROLS } from './uiConstants';

const SUBTITLE = 'Two bumbling generals. Five soldiers each. One crossroads.';
const START_HINT = 'or click anywhere to start';
const PORTRAIT_LABEL_GAP = 22;
const PORTRAIT_ROLE_GAP = 38;

/** Box of a line of text centred on `centreX` (or ending at it when `right`), from its baseline and font size. */
function textBox(text: string, charWidth: number, fontPx: number, x: number, baseline: number, right = false): Rect {
  const w = text.length * charWidth;
  return { x: right ? x - w : x - w / 2, y: baseline - fontPx * 0.8, w, h: fontPx };
}

function union(rects: readonly Rect[]): Rect {
  const x = Math.min(...rects.map((r) => r.x));
  const y = Math.min(...rects.map((r) => r.y));
  return { x, y, w: Math.max(...rects.map((r) => r.x + r.w)) - x, h: Math.max(...rects.map((r) => r.y + r.h)) - y };
}

export interface TitleLayout {
  title: Rect;
  subtitle: Rect;
  portraits: [Rect, Rect];
  start: ButtonRect;
  hint: Rect;
  /** The selector's label, segments and key hint together. */
  speed: Rect;
  speedSegments: ButtonRect[];
  controls: Rect;
  build: Rect;
}

function portraitCentre(side: Side): { x: number; y: number } {
  return { x: side === 'blue' ? TITLE.portraitInset : LOGICAL_WIDTH - TITLE.portraitInset, y: TITLE.portraitY };
}

function portraitBox(side: Side): Rect {
  const c = portraitCentre(side);
  const r = TITLE.portraitRadius;
  const labelW = Math.max(SIDE_NAME[side].length * TEXT_CHAR_WIDTH.bodyBold, 2 * r);
  return { x: c.x - labelW / 2, y: c.y - r, w: labelW, h: 2 * r + PORTRAIT_ROLE_GAP + 4 };
}

export function titleLayout(): TitleLayout {
  const cx = LOGICAL_WIDTH / 2;
  const segments = speedSelectorRects(cx, SPEED_SELECTOR.titleTop);
  const speedLabel = textBox(SPEED_LABEL, TEXT_CHAR_WIDTH.bodyBold, 16, cx, SPEED_SELECTOR.titleTop - SPEED_SELECTOR.labelGap);
  const speedHint = textBox(SPEED_HINT, TEXT_CHAR_WIDTH.small, 13, cx, SPEED_SELECTOR.titleTop + SPEED_SELECTOR.height + SPEED_SELECTOR.hintGap);
  const widest = Math.max(...TITLE_CONTROLS.map((l) => l.length));
  const lastBaseline = TITLE.controlsTop + (TITLE_CONTROLS.length - 1) * TITLE.controlsStep;
  const controlsW = widest * TEXT_CHAR_WIDTH.body;
  return {
    title: textBox(GAME_TITLE, TEXT_CHAR_WIDTH.title, 72, cx, TITLE.titleBaseline),
    subtitle: textBox(SUBTITLE, TEXT_CHAR_WIDTH.subtitle, 20, cx, TITLE.subtitleBaseline),
    portraits: [portraitBox('blue'), portraitBox('red')],
    start: stackButtons([{ id: 'start', label: 'Skirmish' }], cx, TITLE.startTop, BUTTON.width, BUTTON.height, BUTTON.gap)[0],
    hint: textBox(START_HINT, TEXT_CHAR_WIDTH.small, 13, cx, TITLE.hintBaseline),
    speed: union([speedLabel, ...segments, speedHint]),
    speedSegments: segments,
    controls: { x: cx - controlsW / 2, y: TITLE.controlsTop - 16 * 0.8, w: controlsW, h: lastBaseline - TITLE.controlsTop + 16 },
    build: textBox(BUILD_VERSION, TEXT_CHAR_WIDTH.debug, 12, BUILD_LABEL.titleRight, BUILD_LABEL.titleBaseline, true),
  };
}

export function titleButtons(): ButtonRect[] {
  return [titleLayout().start];
}

/** The speed selector's segments on the title screen. */
export function titleSpeedRects(): ButtonRect[] {
  return titleLayout().speedSegments;
}

function drawPortrait(ctx: CanvasRenderingContext2D, side: Side, initial: string): void {
  const { x: cx, y: cy } = portraitCentre(side);
  const r = TITLE.portraitRadius;
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
  ctx.fillText(SIDE_NAME[side], cx, cy + r + PORTRAIT_LABEL_GAP);
  ctx.font = FONT.small;
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText(initial, cx, cy + r + PORTRAIT_ROLE_GAP);
}

export function drawTitle(ctx: CanvasRenderingContext2D, speed: number): void {
  const cx = LOGICAL_WIDTH / 2;
  ctx.fillStyle = PALETTE.pageBackground;
  ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  ctx.fillStyle = PALETTE.text;
  ctx.font = FONT.title;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(GAME_TITLE, cx, TITLE.titleBaseline);
  ctx.font = FONT.subtitle;
  ctx.fillStyle = PALETTE.textDim;
  ctx.fillText(SUBTITLE, cx, TITLE.subtitleBaseline);

  drawPortrait(ctx, 'blue', 'you');
  drawPortrait(ctx, 'red', 'the computer');

  for (const b of titleButtons()) {
    drawButton(ctx, b);
  }
  ctx.fillStyle = PALETTE.textDim;
  ctx.font = FONT.small;
  ctx.textAlign = 'center';
  ctx.fillText(START_HINT, cx, TITLE.hintBaseline);
  drawSpeedSelector(ctx, cx, SPEED_SELECTOR.titleTop, speed);

  ctx.font = FONT.body;
  ctx.fillStyle = PALETTE.text;
  ctx.textAlign = 'center';
  TITLE_CONTROLS.forEach((line, i) => {
    ctx.fillText(line, cx, TITLE.controlsTop + i * TITLE.controlsStep);
  });

  ctx.font = FONT.debug;
  ctx.fillStyle = PALETTE.textDim;
  ctx.textAlign = 'right';
  ctx.fillText(BUILD_VERSION, BUILD_LABEL.titleRight, BUILD_LABEL.titleBaseline);
}
