/**
 * Fixed-timestep accumulator. The render loop hands it each frame's delta
 * in milliseconds and runs as many whole simulation ticks as it returns;
 * the remainder is kept for the next frame and exposed as `alpha`, the
 * fraction of a tick the renderer should interpolate by.
 *
 * Two guards keep a stalled tab from snowballing: a frame's delta is clamped
 * to `maxFrameMs`, and at most `maxTicksPerFrame` ticks are returned per
 * frame, with the excess dropped rather than carried.
 */
export interface FixedStepper {
  /** Add a frame's delta; returns the number of whole ticks to run now. */
  accumulate(dtMs: number): number;
  /** Fraction of the next tick already elapsed, in [0, 1). */
  alpha(): number;
  /** Forget any partial tick (new battle). */
  reset(): void;
}

export function createFixedStepper(tickMs: number, maxFrameMs: number, maxTicksPerFrame: number): FixedStepper {
  let accumulator = 0;
  return {
    accumulate(dtMs: number): number {
      const dt = Math.max(0, Math.min(maxFrameMs, dtMs));
      accumulator += dt;
      let ticks = Math.floor(accumulator / tickMs);
      if (ticks > maxTicksPerFrame) {
        ticks = maxTicksPerFrame;
        accumulator = accumulator - Math.floor(accumulator / tickMs) * tickMs + ticks * tickMs;
      }
      accumulator -= ticks * tickMs;
      return ticks;
    },
    alpha(): number {
      return Math.min(0.999999, accumulator / tickMs);
    },
    reset(): void {
      accumulator = 0;
    },
  };
}
