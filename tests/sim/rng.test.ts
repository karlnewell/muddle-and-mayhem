import { describe, expect, it } from 'vitest';
import { createRng } from '../../src/sim/rng';

describe('createRng', () => {
  it('is deterministic for a seed', () => {
    const a = createRng(12345);
    const b = createRng(12345);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });
  it('differs across seeds', () => {
    expect(createRng(1).next()).not.toBe(createRng(2).next());
  });
  it('next() stays in [0, 1)', () => {
    const r = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.next();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('int(n) stays in [0, n)', () => {
    const r = createRng(9);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(6);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
    }
  });
  it('state() changes after next() and matches across equal seeds and draws', () => {
    const r = createRng(21);
    const before = r.state();
    r.next();
    expect(r.state()).not.toBe(before);
    const a = createRng(99);
    const b = createRng(99);
    for (let i = 0; i < 7; i++) {
      a.next();
      b.next();
    }
    expect(a.state()).toBe(b.state());
  });
  it('chance(0) is never true and chance(1) is always true', () => {
    const r = createRng(3);
    for (let i = 0; i < 100; i++) {
      expect(r.chance(0)).toBe(false);
      expect(r.chance(1)).toBe(true);
    }
  });
});
