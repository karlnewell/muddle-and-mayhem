/**
 * Fits the fixed logical canvas (LOGICAL_WIDTH by LOGICAL_HEIGHT) into the
 * window: one uniform scale, letterboxed, with the backing store multiplied
 * by devicePixelRatio for crisp lines. Pure functions; `main.ts` applies the
 * result to the canvas element and the context transform.
 */
import type { Vec2 } from '../sim';

export interface Viewport {
  /** CSS pixels per logical pixel. */
  scale: number;
  cssWidth: number;
  cssHeight: number;
  pixelWidth: number;
  pixelHeight: number;
  dpr: number;
}

export function fitViewport(windowW: number, windowH: number, dpr: number, logicalW: number, logicalH: number): Viewport {
  const scale = Math.min(windowW / logicalW, windowH / logicalH);
  const cssWidth = Math.floor(logicalW * scale);
  const cssHeight = Math.floor(logicalH * scale);
  return {
    scale,
    cssWidth,
    cssHeight,
    pixelWidth: Math.round(cssWidth * dpr),
    pixelHeight: Math.round(cssHeight * dpr),
    dpr,
  };
}

/** Client (CSS pixel) coordinates to logical canvas pixels, given the canvas's bounding rect origin. */
export function clientToLogical(v: Viewport, clientX: number, clientY: number, rectLeft: number, rectTop: number): Vec2 {
  return { x: (clientX - rectLeft) / v.scale, y: (clientY - rectTop) / v.scale };
}

/** Logical canvas pixels to client offsets from the canvas's top-left corner. */
export function logicalToClientOffset(v: Viewport, x: number, y: number): Vec2 {
  return { x: x * v.scale, y: y * v.scale };
}
