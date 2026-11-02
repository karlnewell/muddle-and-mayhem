/**
 * One battle in play. The session owns the only mutable `BattleState`, the
 * fixed-step accumulator, the red computer opponent, and the command log.
 * Everything the player does arrives as a `Command` through `queue`; on each
 * stepped tick the queued player commands go first, then the AI's, both are
 * appended to the log in that order, and `step` consumes them. Nothing else
 * in the game writes to the state, so `replayBattle(seed, log, tick)`
 * rebuilds exactly what the player saw. A statistics collector watches
 * every stepped tick for the battle report.
 */
import { MAX_FRAME_MS, MAX_TICKS_PER_FRAME, TICK_MS } from '../render/renderConstants';
import { createAi, createBattle, hashState, replayBattle, step } from '../sim';
import type { BattleEvent, BattleState, Command, Controller, TuningOverrides } from '../sim';
import { createStatsCollector } from '../stats/battleStats';
import type { BattleStats } from '../stats/battleStats';
import { createFixedStepper } from './loop';

export interface BattleSession {
  readonly seed: number;
  /** Read-only for callers; only the session steps it. */
  readonly state: BattleState;
  readonly log: readonly Command[];
  /** Player commands waiting for the next tick (visible while paused). */
  readonly pending: readonly Command[];
  paused: boolean;
  /** Queue a player command for the next tick. Its `tick` must equal `state.tick`. */
  queue(cmd: Command): void;
  /** Step exactly one tick: queued player commands, then AI commands, logged in that order. Returns the tick's events. */
  stepOnce(): BattleEvent[];
  /** Advance by a frame's delta: zero ticks when paused or finished, else whatever the stepper allows. Returns all events from the ticks stepped. */
  advance(dtMs: number): BattleEvent[];
  /** Interpolation fraction for the renderer. */
  alpha(): number;
  /** True when replaying the log from the seed reproduces the current state hash. */
  replayMatches(): boolean;
  /** Per-side, per-class statistics so far, for the result screen and the copied report. */
  stats(): BattleStats;
}

/** `overrides` are the `?tune=` values in force, recorded on the statistics so a report carries them. */
export function createSession(seed: number, overrides: TuningOverrides = {}): BattleSession {
  const state = createBattle({ seed });
  const ai: Controller = createAi('red', seed);
  const log: Command[] = [];
  const pending: Command[] = [];
  const stepper = createFixedStepper(TICK_MS, MAX_FRAME_MS, MAX_TICKS_PER_FRAME);
  const collector = createStatsCollector(seed, overrides);

  function stepOnce(): BattleEvent[] {
    const commands: Command[] = pending.splice(0, pending.length);
    for (const cmd of ai.think(state)) {
      commands.push(cmd);
    }
    for (const cmd of commands) {
      log.push(cmd);
    }
    step(state, commands);
    collector.observe(state);
    return state.events;
  }

  const session: BattleSession = {
    seed,
    state,
    log,
    pending,
    paused: true,
    queue(cmd: Command): void {
      if (cmd.tick !== state.tick) {
        throw new Error(`queue: command tick ${cmd.tick} does not match the next tick ${state.tick}`);
      }
      pending.push(cmd);
    },
    stepOnce,
    advance(dtMs: number): BattleEvent[] {
      if (session.paused || state.winner !== null) {
        return [];
      }
      const ticks = stepper.accumulate(dtMs);
      const events: BattleEvent[] = [];
      for (let i = 0; i < ticks && state.winner === null; i++) {
        for (const e of stepOnce()) {
          events.push(e);
        }
      }
      return events;
    },
    alpha(): number {
      return stepper.alpha();
    },
    replayMatches(): boolean {
      return hashState(replayBattle(seed, log, state.tick)) === hashState(state);
    },
    stats: () => collector.stats(),
  };
  return session;
}
