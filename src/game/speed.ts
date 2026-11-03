/**
 * Game speed: 0.5, 0.75 or 1, half speed by default. The factor scales real
 * time before the fixed stepper accumulates it, so the simulation still
 * steps in whole fixed ticks and a slowed battle, its log, its replay and
 * its report are identical to one at full speed; only the screen is slower.
 *
 * The speed in force is `?speed=` from the URL when given, else the
 * player's last choice from the title screen or menu (kept in
 * `localStorage`), else half speed. A bad URL value never throws: the
 * stored choice or the default applies and the error is shown in the debug
 * overlay, as `?tune=` errors are. A blocked store reads as empty.
 */
export const SPEEDS: readonly number[] = [0.5, 0.75, 1];

export const DEFAULT_SPEED = 0.5;

/** The `localStorage` key for the player's last speed choice. */
export const SPEED_STORAGE_KEY = 'muddle-and-mayhem.speed';

export interface SpeedStatus {
  /** The factor real time is scaled by, one of `SPEEDS`. */
  speed: number;
  /** Why the `?speed=` parameter was rejected, or null. */
  error: string | null;
}

export const DEFAULT_SPEED_STATUS: SpeedStatus = { speed: DEFAULT_SPEED, error: null };

/** The speed `raw` names, or null when it names none. */
function parseSpeed(raw: string | null): number | null {
  if (raw === null || raw === '') {
    return null;
  }
  const value = Number(raw);
  return SPEEDS.includes(value) ? value : null;
}

/** The URL's `speed` parameter over the stored choice over the default. Never throws. */
export function chooseSpeed(search: string, stored: string | null): SpeedStatus {
  const raw = new URLSearchParams(search).get('speed');
  const fromUrl = parseSpeed(raw);
  if (fromUrl !== null) {
    return { speed: fromUrl, error: null };
  }
  const error = raw === null || raw === '' ? null : `speed: "${raw}" is not one of ${SPEEDS.join(', ')}`;
  return { speed: parseSpeed(stored) ?? DEFAULT_SPEED, error };
}

/** Accessing `window.localStorage` itself can throw, so the store comes from a function. */
type StoreSource = () => Pick<Storage, 'getItem'>;

/** The stored choice as written, or null when there is none or the store is blocked. */
export function readStoredSpeed(store: StoreSource): string | null {
  try {
    return store().getItem(SPEED_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** Remember the choice; a blocked or full store is ignored. */
export function writeStoredSpeed(store: () => Pick<Storage, 'setItem'>, speed: number): void {
  try {
    store().setItem(SPEED_STORAGE_KEY, String(speed));
  } catch {
    // ponytail: nowhere to keep it; the next visit starts at the default again
  }
}

/** One step along `SPEEDS` (`direction` -1 or 1), stopping at the ends. */
export function stepSpeed(speed: number, direction: -1 | 1): number {
  const i = SPEEDS.indexOf(speed);
  const next = Math.max(0, Math.min(SPEEDS.length - 1, (i < 0 ? 0 : i) + direction));
  return SPEEDS[next];
}

/** `0.5x`, `0.75x`, `1x`. */
export function formatSpeed(speed: number): string {
  return `${speed}x`;
}
