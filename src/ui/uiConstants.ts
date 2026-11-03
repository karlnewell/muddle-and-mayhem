/**
 * Layout, fonts and fixed strings for the HUD and screens. Logical canvas
 * pixels. Changing the look means changing numbers here, not in the draw
 * code.
 */
import { FONT_FAMILY } from '../render/palette';
import { FIELD_HEIGHT, HUD_HEIGHT, LOGICAL_WIDTH, TOP_BAR_HEIGHT } from '../render/renderConstants';

export const GAME_TITLE = 'Muddle & Mayhem';

export const FONT = {
  title: `bold 72px ${FONT_FAMILY}`,
  subtitle: `20px ${FONT_FAMILY}`,
  heading: `bold 36px ${FONT_FAMILY}`,
  body: `16px ${FONT_FAMILY}`,
  bodyBold: `bold 16px ${FONT_FAMILY}`,
  small: `13px ${FONT_FAMILY}`,
  smallBold: `bold 13px ${FONT_FAMILY}`,
  button: `bold 18px ${FONT_FAMILY}`,
  banner: `bold 22px ${FONT_FAMILY}`,
  portrait: `bold 40px ${FONT_FAMILY}`,
  debug: `12px ${FONT_FAMILY}`,
  debugBold: `bold 12px ${FONT_FAMILY}`,
} as const;

export const HUD = {
  top: TOP_BAR_HEIGHT + FIELD_HEIGHT,
  height: HUD_HEIGHT,
  cardCount: 5,
  cardX: 12,
  cardY: 10,
  cardWidth: 196,
  cardHeight: 90,
  cardGap: 8,
  cardRadius: 6,
  slotBox: 22,
  hpBarHeight: 8,
  cooldownBarHeight: 4,
  panelX: 12 + 5 * (196 + 8),
  panelWidth: LOGICAL_WIDTH - 12 - (12 + 5 * (196 + 8)),
  hintY: HUD_HEIGHT - 12,
} as const;

export const TOP_BAR = {
  height: TOP_BAR_HEIGHT,
  padding: 14,
} as const;

/** The TUNED badge in the top bar, beside the title, shown while any `?tune=` override is active. */
export const TUNED_BADGE = {
  x: 180,
  y: 9,
  w: 64,
  h: 22,
  radius: 4,
} as const;

/** The SPEED badge, just right of the TUNED badge's place, shown while `?speed=` is below 1. */
export const SPEED_BADGE = {
  x: TUNED_BADGE.x + TUNED_BADGE.w + 8,
  y: TUNED_BADGE.y,
  w: 104,
  h: TUNED_BADGE.h,
  radius: TUNED_BADGE.radius,
} as const;

export const BUTTON = {
  width: 260,
  height: 44,
  gap: 14,
  radius: 8,
} as const;

export const PANEL = {
  width: 560,
  radius: 12,
} as const;

/** The result screen: a wider panel holding the winner lines, the per-class report table and three buttons. */
export const RESULT = {
  panelWidth: 760,
  panelHeight: 620,
  headingY: 56,
  standingY: 92,
  infoY: 118,
  tableTop: 150,
  tableX: 24,
  rowHeight: 19,
  /** Header plus five classes and a total per side. */
  tableRows: 13,
  buttonsTop: 420,
} as const;

/** The debug overlay: a translucent panel in the top-right corner of the battlefield, below the paused banner. */
export const DEBUG_OVERLAY = {
  right: LOGICAL_WIDTH - 12,
  top: TOP_BAR_HEIGHT + 64,
  padding: 10,
  lineHeight: 15,
  radius: 6,
  swatch: 8,
  /** Fallback character width when the context cannot measure text. */
  charWidth: 7.2,
} as const;

export const CONTROLS_HINT =
  'Left click: select   Right click: move / attack / medic   A: volley   H: hold   M: medic   1-5: slots   S: all   Space: pause   Esc: menu';

export const TITLE_CONTROLS: readonly string[] = [
  'Left click a blue soldier to select it (shift adds). Keys 1 to 5 pick by slot, S all.',
  'Right click the ground to move, an enemy to attack, a downed friend to call the medic.',
  'A: the whole squad fires at the enemy nearest the cursor without moving. H holds position.',
  'M calls the medic for a selected downed soldier. Three calls per side.',
  'Space pauses and resumes. The battle starts paused so you can give the first orders.',
  'Esc opens the menu. Last squad standing wins.',
];

export const STATUS_TEXT = { standing: 'OK', downed: 'DOWN', dead: 'DEAD', jam: 'JAM' } as const;
