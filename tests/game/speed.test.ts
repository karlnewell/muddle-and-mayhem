import { describe, expect, it } from 'vitest';
import { FULL_SPEED, formatSpeed, readSpeed } from '../../src/game/speed';

describe('readSpeed', () => {
  it('is full speed with no error when the parameter is absent or empty', () => {
    expect(readSpeed('')).toEqual(FULL_SPEED);
    expect(readSpeed('?seed=7')).toEqual({ speed: 1, error: null });
    expect(readSpeed('?speed=')).toEqual({ speed: 1, error: null });
  });
  it('accepts 0.5, 0.75 and 1, alone or with other parameters', () => {
    expect(readSpeed('?speed=0.5')).toEqual({ speed: 0.5, error: null });
    expect(readSpeed('?seed=242832287&speed=0.75')).toEqual({ speed: 0.75, error: null });
    expect(readSpeed('?speed=1')).toEqual({ speed: 1, error: null });
  });
  it('rejects anything else, falling back to full speed with an error', () => {
    for (const bad of ['2', '0.25', '0', '-0.5', 'slow', '0.5x', '1e9', 'Infinity', 'NaN']) {
      const s = readSpeed(`?speed=${bad}`);
      expect(s.speed).toBe(1);
      expect(s.error).toBe(`speed: "${bad}" is not one of 0.5, 0.75, 1`);
    }
  });
});

describe('formatSpeed', () => {
  it('reads as a multiplier', () => {
    expect(formatSpeed(0.5)).toBe('0.5x');
    expect(formatSpeed(0.75)).toBe('0.75x');
    expect(formatSpeed(1)).toBe('1x');
  });
});
