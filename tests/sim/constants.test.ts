import { describe, expect, it } from 'vitest';
import {
  CLASS_ORDER,
  DIRECTIONS16,
  FLAME_CONE_COS,
  SIDES,
  SQUAD_NAMES,
  WEAPONS,
} from '../../src/sim/constants';

describe('WEAPONS', () => {
  it('has exactly the five classes in CLASS_ORDER', () => {
    expect(Object.keys(WEAPONS).sort()).toEqual([...CLASS_ORDER].sort());
    expect(CLASS_ORDER).toHaveLength(5);
  });
  it('keeps the range ordering', () => {
    expect(WEAPONS.launcher.range).toBeGreaterThan(WEAPONS.gunner.range);
    expect(WEAPONS.gunner.range).toBeGreaterThanOrEqual(WEAPONS.chucker.range);
    expect(WEAPONS.chucker.range).toBeGreaterThan(WEAPONS.blaster.range);
    expect(WEAPONS.blaster.range).toBeGreaterThan(WEAPONS.scorcher.range);
  });
  it('gunner has the smallest non-zero cooldown and blaster the largest', () => {
    const cooldowns = CLASS_ORDER.map((cls) => WEAPONS[cls].cooldown);
    const nonZero = cooldowns.filter((c) => c > 0);
    expect(WEAPONS.gunner.cooldown).toBeGreaterThan(0);
    expect(WEAPONS.gunner.cooldown).toBe(Math.min(...nonZero));
    expect(WEAPONS.blaster.cooldown).toBe(Math.max(...cooldowns));
  });
  it('scorcher has no cooldown', () => {
    expect(WEAPONS.scorcher.cooldown).toBe(0);
  });
});

describe('DIRECTIONS16', () => {
  it('has 16 unit vectors', () => {
    expect(DIRECTIONS16).toHaveLength(16);
    for (const d of DIRECTIONS16) {
      expect(Math.abs(d.x * d.x + d.y * d.y - 1)).toBeLessThan(1e-12);
    }
  });
});

describe('SQUAD_NAMES', () => {
  it('has five distinct names per side', () => {
    for (const side of SIDES) {
      const names = SQUAD_NAMES[side];
      expect(names).toHaveLength(5);
      expect(new Set(names).size).toBe(5);
    }
  });
});

describe('FLAME_CONE_COS', () => {
  it('is between 0 and 1', () => {
    expect(FLAME_CONE_COS).toBeGreaterThan(0);
    expect(FLAME_CONE_COS).toBeLessThan(1);
  });
});
