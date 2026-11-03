/**
 * Game speed from the page URL. `?speed=0.5` (or 0.75, or 1) scales real
 * time before the fixed stepper accumulates it, so the simulation still
 * steps in whole fixed ticks and a slowed battle, its log, its replay and
 * its report are identical to one at full speed; only the screen is slower.
 * Any other value never throws: the battle runs at full speed and the error
 * is shown in the debug overlay, as `?tune=` errors are.
 */
export const SPEEDS: readonly number[] = [0.5, 0.75, 1];

export interface SpeedStatus {
  /** The factor real time is scaled by, one of `SPEEDS`. */
  speed: number;
  /** Why the parameter was rejected, or null. */
  error: string | null;
}

export const FULL_SPEED: SpeedStatus = { speed: 1, error: null };

/** Parse the `speed` parameter. Never throws. */
export function readSpeed(search: string): SpeedStatus {
  const raw = new URLSearchParams(search).get('speed');
  if (raw === null || raw === '') {
    return { ...FULL_SPEED };
  }
  const value = Number(raw);
  if (!SPEEDS.includes(value)) {
    return { speed: 1, error: `speed: "${raw}" is not one of ${SPEEDS.join(', ')}` };
  }
  return { speed: value, error: null };
}

/** `0.5x`, `0.75x`, `1x`. */
export function formatSpeed(speed: number): string {
  return `${speed}x`;
}
