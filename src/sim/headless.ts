/**
 * Headless runner and replayer. `runBattle` drives a battle with controllers
 * and records every command they issue; `replayBattle` rebuilds the same
 * battle from the seed and that log alone, never asking a controller. The
 * replay determinism test compares the two states bit for bit.
 */
import type { Controller } from './ai';
import type { BattleState, Command, TileMap } from './types';
import { createBattle, step } from './battle';

export interface RunOptions {
  seed: number;
  maxTicks: number;
  controllers: Controller[];
  map?: TileMap;
}

export interface RunResult {
  state: BattleState;
  log: Command[];
  ticks: number;
}

/**
 * Create a battle, and each tick collect every controller's commands (in
 * controller order), append them to the log, and step. Stops at a winner or
 * maxTicks.
 */
export function runBattle(options: RunOptions): RunResult {
  const state = createBattle({ seed: options.seed, map: options.map });
  const log: Command[] = [];
  while (state.winner === null && state.tick < options.maxTicks) {
    const commands: Command[] = [];
    for (const controller of options.controllers) {
      for (const cmd of controller.think(state)) {
        commands.push(cmd);
      }
    }
    for (const cmd of commands) {
      log.push(cmd);
    }
    step(state, commands);
  }
  return { state, log, ticks: state.tick };
}

/**
 * Create a battle from the seed and feed only the log, grouped by tick, for
 * `ticks` ticks. Never calls a controller. The log is in tick order, so a
 * single cursor splits it; commands tagged beyond `ticks` are never reached.
 */
export function replayBattle(seed: number, log: readonly Command[], ticks: number, map?: TileMap): BattleState {
  const state = createBattle({ seed, map });
  let cursor = 0;
  for (let tick = 0; tick < ticks; tick++) {
    const commands: Command[] = [];
    while (cursor < log.length && log[cursor].tick <= tick) {
      if (log[cursor].tick === tick) {
        commands.push(log[cursor]);
      }
      cursor++;
    }
    step(state, commands);
  }
  return state;
}
