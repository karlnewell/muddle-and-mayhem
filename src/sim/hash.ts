/**
 * State hashing for replay checks and lockstep multiplayer.
 *
 * The hash is 32-bit FNV-1a over the UTF-16 code units of the state's JSON
 * serialisation. ECMAScript specifies number-to-string conversion exactly,
 * so two engines that agree on the state agree on the hash. The rng holds
 * only functions, so a replacer serialises it as its 32-bit state number;
 * two states that differ only in rng position therefore hash differently.
 */
import type { Rng } from './rng';
import type { BattleState } from './types';

const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

/** Replaces the `rng` field with its state number; every other value passes through. */
function replaceRng(key: string, value: unknown): unknown {
  return key === 'rng' ? (value as Rng).state() : value;
}

/** The JSON used by `hashState`: `JSON.stringify(state)` with the rng as its state number and no spacing. */
export function serializeState(state: BattleState): string {
  return JSON.stringify(state, replaceRng);
}

/** 32-bit FNV-1a over the UTF-16 code units of `serializeState(state)`, as an unsigned integer. */
export function hashState(state: BattleState): number {
  const json = serializeState(state);
  let h = FNV_OFFSET;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, FNV_PRIME);
  }
  return h >>> 0;
}
