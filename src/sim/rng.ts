/**
 * Seeded pseudo-random number generator for the simulation.
 *
 * Mulberry32: a small, fast 32-bit generator. It uses only integer bit
 * operations, Math.imul, and one division, all of which produce identical
 * results in every JavaScript engine, so a battle seeded here replays
 * bit for bit on any browser.
 *
 * This is the only source of randomness the simulation may use.
 */
export interface Rng {
  /** A float in [0, 1). */
  next(): number;
  /** An integer in [0, maxExclusive). */
  int(maxExclusive: number): number;
  /** True with probability p (p in [0, 1]). */
  chance(p: number): boolean;
  /** The 32-bit generator state, for serialisation. */
  state(): number;
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0;

  const next = (): number => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    int: (maxExclusive) => Math.floor(next() * maxExclusive),
    chance: (p) => next() < p,
    state: () => s,
  };
}
