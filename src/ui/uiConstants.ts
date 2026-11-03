/**
 * Layout, fonts and fixed strings for the HUD and screens. Logical canvas
 * pixels. Changing the look means changing numbers here, not in the draw
 * code.
 */
import { FONT_FAMILY } from '../render/palette';
import { FIELD_HEIGHT, LOGICAL_HEIGHT, LOGICAL_WIDTH, SIDE_PANEL_WIDTH, TOP_BAR_HEIGHT } from '../render/renderConstants';

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

/**
 * The side panel beside the field (`battleLayout` puts it on the player's
 * side): five soldier cards stacked in slot order, then the medic calls,
 * the pause status and the build stamp. Offsets are from the panel's
 * top-left corner.
 */
export const HUD = {
  top: TOP_BAR_HEIGHT,
  width: SIDE_PANEL_WIDTH,
  height: FIELD_HEIGHT,
  inset: 8,
  cardCount: 5,
  cardWidth: SIDE_PANEL_WIDTH - 16,
  cardHeight: 66,
  cardGap: 6,
  cardRadius: 6,
  slotBox: 20,
  hpBarHeight: 8,
  cooldownBarHeight: 3,
  /** The medic-calls box starts this far below the panel's top edge (below the last card) and is this high. */
  medicTop: 370,
  medicHeight: 58,
  /** Baselines below the panel's top edge. */
  pausedBaseline: 452,
  buildBaseline: 472,
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

/** The SPEED badge, just right of the TUNED badge's place, shown while the speed is not the half-speed default. */
export const SPEED_BADGE = {
  x: TUNED_BADGE.x + TUNED_BADGE.w + 8,
  y: TUNED_BADGE.y,
  w: 104,
  h: TUNED_BADGE.h,
  radius: TUNED_BADGE.radius,
} as const;

/**
 * Monospace character widths per font, for laying out text without a
 * canvas to measure it (0.6 em, which the usual monospace faces match
 * or undercut). Layout tests use the same numbers.
 */
export const TEXT_CHAR_WIDTH = {
  title: 43.2,
  subtitle: 12,
  body: 9.6,
  bodyBold: 9.6,
  small: 7.8,
  debug: 7.2,
} as const;

/**
 * The game speed selector on the title screen and in the Esc menu: three
 * segments side by side, a label above and a key hint below. `titleTop`
 * is the segments' top edge on the title screen; in the menu they sit
 * `menuGap` below the last button.
 */
export const SPEED_SELECTOR = {
  segmentWidth: 84,
  height: 36,
  gap: 6,
  radius: 6,
  labelGap: 10,
  hintGap: 20,
  titleTop: 300,
  menuGap: 40,
} as const;

/**
 * The title screen, fitted to 520 high: the name and the line under it,
 * the two generals' portraits flanking the name, the Skirmish button and
 * its hint, the speed selector, the controls list and the build stamp.
 * Baselines and tops in logical pixels.
 */
export const TITLE = {
  titleBaseline: 78,
  subtitleBaseline: 112,
  portraitRadius: 44,
  /** Portrait centres sit this far in from the left and right edges. */
  portraitInset: 92,
  portraitY: 78,
  startTop: 196,
  hintBaseline: 262,
  controlsTop: 392,
  controlsStep: 20,
} as const;

/** The build version, small and dim: bottom-right of the title screen; in battle it sits at the bottom of the side panel (`HUD.buildBaseline`). */
export const BUILD_LABEL = {
  titleRight: LOGICAL_WIDTH - 12,
  titleBaseline: LOGICAL_HEIGHT - 6,
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

/** The Esc menu panel: heading, three buttons, the speed selector and the two-line controls hint at its foot. */
export const MENU = {
  width: 760,
  height: 410,
  headingY: 50,
  buttonsTop: 76,
  /** Baseline of the first hint line, from the panel's top; the second follows `hintStep` below. */
  hintBaseline: 372,
  hintStep: 18,
} as const;

/** The result screen: a wider panel holding the winner lines, the per-class report table and three buttons. */
export const RESULT = {
  panelWidth: 760,
  panelHeight: 500,
  headingY: 44,
  standingY: 72,
  infoY: 94,
  tableTop: 106,
  tableX: 24,
  rowHeight: 15,
  /** Header plus five classes and a total per side. */
  tableRows: 13,
  buttonsTop: 318,
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

/** The keys in two lines, at the foot of the Esc menu; the title screen has the longer `TITLE_CONTROLS`. */
export const CONTROLS_HINT_LINES: readonly string[] = [
  'Left click: select   Right click: move / attack / medic   A: volley   H: hold',
  'M: medic   1-5: slots   S: all   Space: pause   Esc: menu',
];

export const TITLE_CONTROLS: readonly string[] = [
  'Left click a blue soldier to select it (shift adds). Keys 1 to 5 pick by slot, S all.',
  'Right click the ground to move, an enemy to attack, a downed friend to call the medic.',
  'A: the whole squad fires at the enemy nearest the cursor without moving. H holds position.',
  'M calls the medic for a selected downed soldier. Three calls per side.',
  'Space pauses and resumes. The battle starts paused so you can give the first orders.',
  'Esc opens the menu. Last squad standing wins.',
];

export const STATUS_TEXT = { standing: 'OK', downed: 'DOWN', dead: 'DEAD', jam: 'JAM' } as const;
