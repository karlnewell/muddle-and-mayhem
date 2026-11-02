import { describe, expect, it } from 'vitest';
import { nextSeed, seedFromSearch } from '../../src/game/seed';

describe('seedFromSearch', () => {
  it('reads ?seed=N', () => {
    expect(seedFromSearch('?seed=42', () => 0.5)).toEqual({ seed: 42, fixed: true });
    expect(seedFromSearch('?foo=1&seed=7', () => 0.5)).toEqual({ seed: 7, fixed: true });
  });
  it('falls back to a random 32-bit unsigned integer', () => {
    const r = seedFromSearch('', () => 0.5);
    expect(r.fixed).toBe(false);
    expect(r.seed).toBe(2147483648);
    const top = seedFromSearch('?seed=notanumber', () => 0.999999999);
    expect(Number.isInteger(top.seed)).toBe(true);
    expect(top.seed).toBeLessThan(4294967296);
  });
});

describe('nextSeed', () => {
  it('increments a fixed seed and re-rolls a random one', () => {
    expect(nextSeed({ seed: 42, fixed: true }, () => 0.5)).toEqual({ seed: 43, fixed: true });
    expect(nextSeed({ seed: 42, fixed: false }, () => 0.25)).toEqual({ seed: 1073741824, fixed: false });
  });
});
