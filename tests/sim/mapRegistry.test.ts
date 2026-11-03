import { describe, expect, it } from 'vitest';
import { COMPACT_CROSSROADS, CROSSROADS, DEFAULT_MAP, DEFAULT_MAP_ID, MAPS, MAP_IDS, createBattle, mapIdOf, parseMap } from '../../src/sim';
import { CROSSROADS_ROWS } from '../../src/sim/maps/crossroads';

describe('map registry', () => {
  it('names both maps by id', () => {
    expect(MAPS.crossroads).toBe(CROSSROADS);
    expect(MAPS.compact).toBe(COMPACT_CROSSROADS);
    expect([...MAP_IDS].sort()).toEqual(['compact', 'crossroads']);
  });

  it('finds the id of a registered map, by identity or by name', () => {
    expect(mapIdOf(CROSSROADS)).toBe('crossroads');
    expect(mapIdOf(COMPACT_CROSSROADS)).toBe('compact');
    expect(mapIdOf(parseMap('Crossroads', CROSSROADS_ROWS))).toBe('crossroads');
    expect(mapIdOf(parseMap('Other', CROSSROADS_ROWS))).toBeNull();
  });

  it('has a default map that createBattle uses', () => {
    expect(DEFAULT_MAP).toBe(MAPS[DEFAULT_MAP_ID]);
    expect(createBattle({ seed: 1 }).map).toBe(DEFAULT_MAP);
  });
});
