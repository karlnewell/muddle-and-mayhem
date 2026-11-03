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
export { COMPACT_CROSSROADS } from './maps/compactCrossroads';
export { DEFAULT_MAP, DEFAULT_MAP_ID, MAPS, MAP_IDS, mapIdOf } from './maps/registry';
export type { MapId } from './maps/registry';
export { parseMap, worldToTile, tileCenter, isBlocked, mapWidthUnits, mapHeightUnits } from './map';
export { hasLineOfSight } from './los';
export { canFireAt, inRange } from './targeting';
export { soldierById, isActive, standingCount, hpFraction } from './soldiers';
export { createRng } from './rng';
export type { Rng } from './rng';
export * from './constants';
export type * from './types';
