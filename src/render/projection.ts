/**
 * World-to-screen mapping. The top-down projection is a plain offset: one
 * logical canvas pixel per world unit, shifted down by the top bar. An
 * isometric renderer later replaces this object and the draw modules; the
 * input layer and the HUD only ever go through this interface.
 */
import type { Vec2 } from '../sim';

export interface Projection {
  worldToScreen(x: number, y: number): Vec2;
  screenToWorld(sx: number, sy: number): Vec2;
}

export function createTopDownProjection(offsetX: number, offsetY: number): Projection {
  return {
    worldToScreen(x: number, y: number): Vec2 {
      return { x: x + offsetX, y: y + offsetY };
    },
    screenToWorld(sx: number, sy: number): Vec2 {
      return { x: sx - offsetX, y: sy - offsetY };
    },
  };
}
