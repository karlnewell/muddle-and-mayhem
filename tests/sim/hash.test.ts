import { describe, expect, it } from 'vitest';
import { createBattle } from '../../src/sim/battle';
import { hashState, serializeState } from '../../src/sim/hash';

describe('hashState', () => {
  it('hashes the same state to the same value', () => {
    const a = createBattle({ seed: 7 });
    const b = createBattle({ seed: 7 });
    expect(hashState(a)).toBe(hashState(a));
    expect(hashState(a)).toBe(hashState(b));
  });

  it('changes when one soldier moves by a single unit', () => {
    const a = createBattle({ seed: 7 });
    const b = createBattle({ seed: 7 });
    b.soldiers[3].x += 1;
    expect(hashState(a)).not.toBe(hashState(b));
  });

  it('is an unsigned 32-bit integer', () => {
    for (const seed of [0, 1, 42, 0xffffffff]) {
      const h = hashState(createBattle({ seed }));
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(4294967296);
    }
  });

  it('is FNV-1a over the UTF-16 code units of the serialisation', () => {
    const state = createBattle({ seed: 3 });
    const json = serializeState(state);
    let h = 0x811c9dc5;
    for (let i = 0; i < json.length; i++) {
      h ^= json.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    expect(hashState(state)).toBe(h >>> 0);
  });
});

describe('serializeState', () => {
  it('is JSON that carries the tick and the rng as its state number', () => {
    const json = serializeState(createBattle({ seed: 7 }));
    expect(json).toContain('"tick"');
    expect(JSON.parse(json).tick).toBe(0);
    expect(json).toMatch(/"rng":-?\d+/);
    expect(typeof JSON.parse(json).rng).toBe('number');
    expect(json).not.toContain('function');
    expect(json).not.toContain('=>');
  });
  it('changes when only the rng has advanced', () => {
    const state = createBattle({ seed: 7 });
    const before = hashState(state);
    state.rng.next();
    expect(hashState(state)).not.toBe(before);
  });
});
