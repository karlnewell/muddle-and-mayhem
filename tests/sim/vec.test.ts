import { describe, expect, it } from 'vitest';
import { clamp, dist2, dot, imod, length, normalize } from '../../src/sim/vec';

describe('vec', () => {
  it('dist2 returns the squared distance', () => {
    expect(dist2(0, 0, 3, 4)).toBe(25);
  });
  it('length returns the Euclidean length', () => {
    expect(length(3, 4)).toBe(5);
  });
  it('normalize returns a unit vector', () => {
    expect(normalize(3, 4)).toEqual({ x: 0.6, y: 0.8 });
  });
  it('normalize keeps the zero vector at zero', () => {
    expect(normalize(0, 0)).toEqual({ x: 0, y: 0 });
  });
  it('dot of perpendicular vectors is 0', () => {
    expect(dot(1, 0, 0, 1)).toBe(0);
  });
  it('clamp limits to the range', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clamp(2, 0, 3)).toBe(2);
  });
  it('imod wraps into [0, b) for positive and negative a', () => {
    expect(imod(17, 16)).toBe(1);
    expect(imod(16, 16)).toBe(0);
    expect(imod(5, 16)).toBe(5);
    expect(imod(-1, 16)).toBe(15);
    expect(imod(-17, 16)).toBe(15);
  });
});
