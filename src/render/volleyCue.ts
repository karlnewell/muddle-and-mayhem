/**
 * The volley cue: a short flash showing who the `A` volley ordered and at
 * whom. Derived from the player's stand-fast `attack` command as it is
 * queued, so the sim never knows about it. Timed in real milliseconds:
 * stamped on the first frame after the key, so it shows while paused.
 */
import { soldierById } from '../sim';
import type { BattleState, Command, Side, Soldier } from '../sim';
import { VOLLEY_CUE_MS } from './renderConstants';

export interface VolleyCue {
  soldierIds: readonly number[];
  targetId: number;
  /** Frame time the cue started, or null until the next frame stamps it. */
  startMs: number | null;
}

/** The cue for the last stand-fast attack by `side` among `commands`, or null. */
export function volleyCueFromCommands(commands: readonly Command[], side: Side): VolleyCue | null {
  let cue: VolleyCue | null = null;
  for (const c of commands) {
    if (c.type === 'attack' && c.stand === true && c.side === side) {
      cue = { soldierIds: c.soldierIds, targetId: c.targetId, startMs: null };
    }
  }
  return cue;
}

/** Stamp an unstarted cue with the frame time; a started cue is returned as is. */
export function startVolleyCue(cue: VolleyCue, nowMs: number): VolleyCue {
  return cue.startMs === null ? { ...cue, startMs: nowMs } : cue;
}

/** 0 at the start (and before stamping), 1 once VOLLEY_CUE_MS has passed: the cue is over. */
export function volleyCueProgress(cue: VolleyCue, nowMs: number): number {
  if (cue.startMs === null) {
    return 0;
  }
  return Math.max(0, Math.min(1, (nowMs - cue.startMs) / VOLLEY_CUE_MS));
}

/** The ordered soldiers still standing, or none when the target is gone or no longer standing. */
export function volleyCueShooters(state: BattleState, cue: VolleyCue): Soldier[] {
  const target = soldierById(state, cue.targetId);
  if (target === undefined || target.status !== 'standing') {
    return [];
  }
  return cue.soldierIds.map((id) => soldierById(state, id)).filter((s): s is Soldier => s !== undefined && s.status === 'standing');
}
