/**
 * Layout and timing tunables for the renderer and the game loop. Logical
 * canvas pixels: the battlefield is drawn at one logical pixel per world
 * unit, with a top bar above it and the HUD below; the viewport scales the
 * whole logical canvas to fit the window.
 */
import { CROSSROADS, TICK_RATE, mapHeightUnits, mapWidthUnits } from '../sim';

export const FIELD_WIDTH = mapWidthUnits(CROSSROADS);
export const FIELD_HEIGHT = mapHeightUnits(CROSSROADS);
export const TOP_BAR_HEIGHT = 40;
export const HUD_HEIGHT = 132;
export const LOGICAL_WIDTH = FIELD_WIDTH;
export const LOGICAL_HEIGHT = TOP_BAR_HEIGHT + FIELD_HEIGHT + HUD_HEIGHT;

export const TICK_MS = 1000 / TICK_RATE;
/** A frame longer than this (a hidden tab, a stall) is treated as this long. */
export const MAX_FRAME_MS = 250;
/** Never run more ticks than this in one frame, whatever the accumulator holds. */
export const MAX_TICKS_PER_FRAME = 8;

/** Soldiers are picked within this many world units of their centre. */
export const PICK_RADIUS = 18;

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
