/**
 * Public surface of the simulation, as Plan 3 (renderer, input, UI) consumes it.
 * Everything else under `src/sim/` is internal.
 */
export { createBattle, step } from './battle';
export type { BattleOptions } from './battle';
export { createAi } from './ai';
export type { Controller } from './ai';
export { hashState, serializeState } from './hash';
export { runBattle, replayBattle } from './headless';
export type { RunOptions, RunResult } from './headless';
export { CROSSROADS } from './maps/crossroads';
export { parseMap, worldToTile, tileCenter, isBlocked, mapWidthUnits, mapHeightUnits } from './map';
export { hasLineOfSight } from './los';
export { soldierById, isActive, standingCount } from './soldiers';
export { createRng } from './rng';
export type { Rng } from './rng';
export * from './constants';
export type * from './types';
