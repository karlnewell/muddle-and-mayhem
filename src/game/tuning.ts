/**
 * Live tuning overrides from the page URL. `?tune=<JSON>` carries the same
 * `TuningOverrides` object `npm run measure` accepts, URL-encoded or not,
 * for example `?seed=7&tune={"WEAPONS":{"launcher":{"cooldown":180}}}`.
 * `main.ts` applies it through `overrideTuning` before the app and any
 * battle exist; the live bindings in `src/sim/constants.ts` then carry the
 * values across Play again and Restart. A bad value never throws: the
 * battle starts with shipped balance and the error is shown in the debug
 * overlay and on `window.__mm.tuneError`.
 */
import { overrideTuning, validateTuning } from '../sim';
import type { TuningOverrides } from '../sim';

export interface TuneStatus {
  /** The validated overrides, or an empty object when absent or invalid. */
  overrides: TuningOverrides;
  /** True when at least one override is in force. */
  active: boolean;
  /** Why the parameter was rejected, or null. */
  error: string | null;
}

export const NO_TUNING: TuneStatus = { overrides: {}, active: false, error: null };

/** Parse and validate the `tune` parameter without applying it. Never throws. */
export function readTune(search: string): TuneStatus {
  const raw = new URLSearchParams(search).get('tune');
  if (raw === null || raw === '') {
    return { overrides: {}, active: false, error: null };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    return { overrides: {}, active: false, error: `tune: not valid JSON (${(e as Error).message})` };
  }
  try {
    validateTuning(parsed);
  } catch (e) {
    return { overrides: {}, active: false, error: `tune: ${(e as Error).message}` };
  }
  return { overrides: parsed, active: Object.keys(parsed).length > 0, error: null };
}

/** `readTune`, then apply the overrides when there are any. */
export function applyTune(search: string): TuneStatus {
  const status = readTune(search);
  if (status.active) {
    overrideTuning(status.overrides);
  }
  return status;
}
