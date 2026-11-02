/**
 * Short-lived visual effects derived from the simulation's per-tick events.
 * Pure data: each effect records the tick it started and the tick it ends,
 * so the renderer fades it by sim time and pause freezes it. `app.ts`
 * drains `state.events` after every stepped tick (the sim clears them at
 * the start of each step) and prunes expired effects once per frame.
 */
import type { BattleEvent, SoldierClass } from '../sim';
import { HIT_FLASH_TICKS, IMPACT_EFFECT_TICKS, JAM_LABEL_TICKS, MUZZLE_FLASH_TICKS, REVIVE_PULSE_TICKS } from './renderConstants';

export type Effect =
  | { kind: 'impact'; x: number; y: number; radius: number; weapon: SoldierClass; start: number; until: number }
  | { kind: 'hit'; soldierId: number; start: number; until: number }
  | { kind: 'jam'; soldierId: number; start: number; until: number }
  | { kind: 'revive'; soldierId: number; start: number; until: number }
  | { kind: 'muzzle'; soldierId: number; weapon: SoldierClass; start: number; until: number };

export function effectsFromEvents(events: readonly BattleEvent[], tick: number): Effect[] {
  const out: Effect[] = [];
  for (const e of events) {
    switch (e.kind) {
      case 'impact':
        out.push({ kind: 'impact', x: e.x, y: e.y, radius: e.radius, weapon: e.weapon, start: tick, until: tick + IMPACT_EFFECT_TICKS });
        break;
      case 'damage':
        out.push({ kind: 'hit', soldierId: e.soldierId, start: tick, until: tick + HIT_FLASH_TICKS });
        break;
      case 'jam':
        out.push({ kind: 'jam', soldierId: e.soldierId, start: tick, until: tick + JAM_LABEL_TICKS });
        break;
      case 'revived':
        out.push({ kind: 'revive', soldierId: e.soldierId, start: tick, until: tick + REVIVE_PULSE_TICKS });
        break;
      case 'shot':
        out.push({ kind: 'muzzle', soldierId: e.soldierId, weapon: e.weapon, start: tick, until: tick + MUZZLE_FLASH_TICKS });
        break;
      default:
        break;
    }
  }
  return out;
}

/** Effects still alive at `tick` (an effect ends when `tick >= until`). */
export function pruneEffects(effects: readonly Effect[], tick: number): Effect[] {
  return effects.filter((f) => f.until > tick);
}

/** 0 at start, 1 at the end, for fades. */
export function effectProgress(f: Effect, tick: number, alpha: number): number {
  const span = f.until - f.start;
  if (span <= 0) {
    return 1;
  }
  return Math.max(0, Math.min(1, (tick + alpha - f.start) / span));
}
