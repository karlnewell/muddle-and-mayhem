/**
 * The battle: one mutable BattleState created by `createBattle` and advanced
 * one fixed tick at a time by `step`. Each step applies the commands tagged
 * with the current tick, in the order given, then runs the tick phases in a
 * fixed order. Everything on the state is plain data except `rng`.
 */
import type { BattleState, Command, TileMap } from './types';
import { MEDIC_CALLS } from './constants';
import { applyCommand } from './commands';
import { CROSSROADS } from './maps/crossroads';
import { moveSoldiers } from './movement';
import { advanceProjectiles } from './projectiles';
import { createRng } from './rng';
import { createSoldiers } from './soldiers';
import { canFireAt } from './targeting';
import { checkVictory } from './victory';
import { fireWeapons } from './weapons';

export interface BattleOptions {
  seed: number;
  map?: TileMap;
}

/** A fresh battle at tick 0 on the given map (Crossroads by default), seeded for replay. */
export function createBattle(options: BattleOptions): BattleState {
  const map = options.map ?? CROSSROADS;
  return {
    tick: 0,
    seed: options.seed,
    map,
    soldiers: createSoldiers(map),
    projectiles: [],
    medics: [],
    sides: {
      blue: { medicCalls: MEDIC_CALLS, selected: [] },
      red: { medicCalls: MEDIC_CALLS, selected: [] },
    },
    winner: null,
    nextProjectileId: 0,
    events: [],
    rng: createRng(options.seed),
  };
}

/**
 * Advance the battle one tick. A finished battle (winner set) is frozen and
 * returns at once. Commands tagged with another tick are ignored.
 */
export function step(state: BattleState, commands: readonly Command[]): void {
  if (state.winner !== null) {
    return;
  }
  state.events = [];
  for (const cmd of commands) {
    if (cmd.tick === state.tick) {
      applyCommand(state, cmd);
    }
  }
  // phase: orders and movement
  moveSoldiers(state, (s, t) => canFireAt(state, s, t));
  // phase: firing
  fireWeapons(state);
  // phase: projectiles
  advanceProjectiles(state);
  // phase: flame (Task 9: applyFlame)
  // phase: medics (Task 10: advanceMedics)
  // phase: win check
  checkVictory(state);
  state.tick++;
}
