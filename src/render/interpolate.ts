/** Interpolated position of anything with prevX/prevY and x/y, by the frame's alpha. */
import type { Vec2 } from '../sim';

export interface Interpolable {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
}

export function lerpPosition(e: Interpolable, alpha: number): Vec2 {
  return { x: e.prevX + (e.x - e.prevX) * alpha, y: e.prevY + (e.y - e.prevY) * alpha };
}
