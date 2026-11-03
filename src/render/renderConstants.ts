/**
 * Layout and timing tunables for the renderer and the game loop. Logical
 * canvas pixels: a top bar across the full width, and below it the side
 * panel (the HUD) beside the battlefield, which is drawn at one logical
 * pixel per world unit. The viewport scales the whole logical canvas to fit
 * the window, so a smaller field is what makes soldiers draw bigger.
 */
import { DEFAULT_MAP, TICK_RATE, mapHeightUnits, mapWidthUnits } from '../sim';
import type { Side } from '../sim';

export const FIELD_WIDTH = mapWidthUnits(DEFAULT_MAP);
export const FIELD_HEIGHT = mapHeightUnits(DEFAULT_MAP);
export const TOP_BAR_HEIGHT = 40;
/** The side panel holding the soldier cards, medic calls, pause status and build stamp. */
export const SIDE_PANEL_WIDTH = 200;
export const LOGICAL_WIDTH = SIDE_PANEL_WIDTH + FIELD_WIDTH;
export const LOGICAL_HEIGHT = TOP_BAR_HEIGHT + FIELD_HEIGHT;

/** Where the side panel and the field sit below the top bar. */
export interface BattleLayout {
  panelX: number;
  fieldX: number;
  top: number;
}

/**
 * The side panel sits on the player's side of the field, the side the
 * player's squad spawns on: left for blue (always, today), right for red,
 * so a future second player commanding red gets the panel on the right.
 */
export function battleLayout(playerSide: Side): BattleLayout {
  return playerSide === 'blue'
    ? { panelX: 0, fieldX: SIDE_PANEL_WIDTH, top: TOP_BAR_HEIGHT }
    : { panelX: FIELD_WIDTH, fieldX: 0, top: TOP_BAR_HEIGHT };
}

export const TICK_MS = 1000 / TICK_RATE;
/** A frame longer than this (a hidden tab, a stall) is treated as this long. */
export const MAX_FRAME_MS = 250;
/** Never run more ticks than this in one frame, whatever the accumulator holds. */
export const MAX_TICKS_PER_FRAME = 8;

/** Soldiers are picked within this many world units of their centre. */
export const PICK_RADIUS = 18;
/** A left press that travels more than this many logical pixels before release is a drag box, not a click. */
export const DRAG_SELECT_THRESHOLD = 4;
/** The drag box: a thin outline in the player's side colour over a faint fill of the same colour. */
export const DRAG_BOX_LINE_WIDTH = 1;
export const DRAG_BOX_FILL_ALPHA = 0.15;

/** Effect lifetimes, in sim ticks, so pause freezes them. */
export const IMPACT_EFFECT_TICKS = 12;
export const HIT_FLASH_TICKS = 6;
export const JAM_LABEL_TICKS = 30;
export const REVIVE_PULSE_TICKS = 20;
export const MUZZLE_FLASH_TICKS = 3;

/** Lobbed shots arc this many logical pixels high at mid-flight (render only). */
export const LOB_ARC_HEIGHT = 64;
/** Rockets draw a trail this many logical pixels long. */
export const ROCKET_TRAIL = 18;

/**
 * The volley cue: lines from each ordered soldier to the target, a ring on
 * the target and a VOLLEY label. Real milliseconds, not ticks, so it shows
 * when the volley is given while paused and lasts the same at any speed.
 */
export const VOLLEY_CUE_MS = 600;
export const VOLLEY_LINE_WIDTH = 3;
/** The target ring grows from the soldier ring radius by this many logical pixels. */
export const VOLLEY_RING_GROWTH = 18;
/** The VOLLEY label sits this far above the target's centre. */
export const VOLLEY_LABEL_OFFSET = 30;
