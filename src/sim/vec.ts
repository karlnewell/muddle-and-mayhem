/**
 * Vector helpers for the simulation. Only cross-engine-safe arithmetic:
 * `+ - * /`, `Math.sqrt`, `Math.min`, `Math.max`. Distances are usually
 * compared squared; `length` and `normalize` are for the few places that
 * need a true direction.
 */
import type { Vec2 } from './types';

/** Squared distance between (ax, ay) and (bx, by). */
export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

/** Euclidean length of (x, y). */
export function length(x: number, y: number): number {
  return Math.sqrt(x * x + y * y);
}

/** Unit vector in the direction of (x, y); the zero vector stays zero. */
export function normalize(x: number, y: number): Vec2 {
  const len = length(x, y);
  if (len === 0) {
    return { x: 0, y: 0 };
  }
  return { x: x / len, y: y / len };
}

/** Dot product of (ax, ay) and (bx, by). */
export function dot(ax: number, ay: number, bx: number, by: number): number {
  return ax * bx + ay * by;
}

/** v limited to [lo, hi]. */
export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** a modulo b wrapped into [0, b) for b > 0, written without the % operator. */
export function imod(a: number, b: number): number {
  return a - Math.floor(a / b) * b;
}
