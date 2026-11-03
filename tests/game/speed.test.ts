import { describe, expect, it } from 'vitest';
import { DEFAULT_SPEED, chooseSpeed, formatSpeed, readStoredSpeed, stepSpeed, writeStoredSpeed } from '../../src/game/speed';

describe('chooseSpeed', () => {
  it('is half speed with no error when neither the URL nor the store has a value', () => {
    expect(DEFAULT_SPEED).toBe(0.5);
    expect(chooseSpeed('', null)).toEqual({ speed: 0.5, error: null });
    expect(chooseSpeed('?seed=7', null)).toEqual({ speed: 0.5, error: null });
    expect(chooseSpeed('?speed=', null)).toEqual({ speed: 0.5, error: null });
  });
  it('takes a stored choice when the URL has none', () => {
    expect(chooseSpeed('', '0.75')).toEqual({ speed: 0.75, error: null });
    expect(chooseSpeed('?seed=7', '1')).toEqual({ speed: 1, error: null });
  });
  it('lets the URL win over the stored choice', () => {
    expect(chooseSpeed('?speed=1', '0.75')).toEqual({ speed: 1, error: null });
    expect(chooseSpeed('?seed=242832287&speed=0.75', '0.5')).toEqual({ speed: 0.75, error: null });
  });
  it('ignores a stored value that is not a speed', () => {
    for (const bad of ['', '2', 'fast', '0.50x', 'null']) {
      expect(chooseSpeed('', bad)).toEqual({ speed: 0.5, error: null });
    }
  });
  it('rejects a bad URL value with an error, falling back to the stored choice, then the default', () => {
    for (const bad of ['2', '0.25', '0', '-0.5', 'slow', '0.5x', '1e9', 'Infinity', 'NaN']) {
      expect(chooseSpeed(`?speed=${bad}`, null)).toEqual({ speed: 0.5, error: `speed: "${bad}" is not one of 0.5, 0.75, 1` });
    }
    expect(chooseSpeed('?speed=2', '0.75')).toEqual({ speed: 0.75, error: 'speed: "2" is not one of 0.5, 0.75, 1' });
  });
});

describe('stored speed', () => {
  it('reads and writes through the given store', () => {
    const items = new Map<string, string>();
    const store = { getItem: (k: string) => items.get(k) ?? null, setItem: (k: string, v: string) => void items.set(k, v) };
    expect(readStoredSpeed(() => store)).toBeNull();
    writeStoredSpeed(() => store, 0.75);
    expect(readStoredSpeed(() => store)).toBe('0.75');
  });
  it('treats a blocked store as empty and never throws', () => {
    const blocked = () => {
      throw new Error('SecurityError');
    };
    const throwing = {
      getItem: (): string | null => {
        throw new Error('denied');
      },
      setItem: (): void => {
        throw new Error('quota');
      },
    };
    expect(readStoredSpeed(blocked)).toBeNull();
    expect(readStoredSpeed(() => throwing)).toBeNull();
    expect(() => writeStoredSpeed(blocked, 1)).not.toThrow();
    expect(() => writeStoredSpeed(() => throwing, 1)).not.toThrow();
    expect(chooseSpeed('', readStoredSpeed(blocked))).toEqual({ speed: 0.5, error: null });
  });
});

describe('stepSpeed', () => {
  it('moves one step along 0.5, 0.75, 1 and stops at the ends', () => {
    expect(stepSpeed(0.5, 1)).toBe(0.75);
    expect(stepSpeed(0.75, 1)).toBe(1);
    expect(stepSpeed(1, 1)).toBe(1);
    expect(stepSpeed(1, -1)).toBe(0.75);
    expect(stepSpeed(0.5, -1)).toBe(0.5);
  });
});

describe('formatSpeed', () => {
  it('reads as a multiplier', () => {
    expect(formatSpeed(0.5)).toBe('0.5x');
    expect(formatSpeed(0.75)).toBe('0.75x');
    expect(formatSpeed(1)).toBe('1x');
  });
});
