import { afterEach, describe, expect, it } from 'vitest';
import { applyTune, readTune } from '../../src/game/tuning';
import * as constants from '../../src/sim/constants';
import { overrideTuning } from '../../src/sim/constants';

const defaults = { MEDIC_SPEED: constants.MEDIC_SPEED, WEAPONS: constants.WEAPONS };
const launcherJson = '{"WEAPONS":{"launcher":{"cooldown":180}}}';

describe('readTune', () => {
  it('is inactive with no error when the parameter is absent', () => {
    expect(readTune('')).toEqual({ overrides: {}, active: false, error: null });
    expect(readTune('?seed=7')).toEqual({ overrides: {}, active: false, error: null });
  });
  it('parses an encoded or a raw JSON object, alone or beside other parameters', () => {
    expect(readTune('?tune=%7B%22MEDIC_SPEED%22%3A2%7D')).toEqual({ overrides: { MEDIC_SPEED: 2 }, active: true, error: null });
    expect(readTune('?seed=7&tune={"MEDIC_SPEED":2}')).toEqual({ overrides: { MEDIC_SPEED: 2 }, active: true, error: null });
  });
  it('keeps a nested CLASS_STATS merge as given', () => {
    expect(readTune('?tune={"CLASS_STATS":{"scorcher":{"maxHp":100,"speed":2.07}}}')).toEqual({
      overrides: { CLASS_STATS: { scorcher: { maxHp: 100, speed: 2.07 } } }, active: true, error: null,
    });
  });
  it('rejects the retired MOVE_SPEED as an unknown tunable', () => {
    const status = readTune('?tune={"MOVE_SPEED":2}');
    expect(status.active).toBe(false);
    expect(status.error).toMatch(/unknown tunable/);
  });
  it('keeps a nested WEAPONS merge as given', () => {
    expect(readTune(`?tune=${launcherJson}`).overrides).toEqual({ WEAPONS: { launcher: { cooldown: 180 } } });
  });
  it('reports bad JSON instead of throwing', () => {
    const status = readTune('?tune=not json');
    expect(status.active).toBe(false);
    expect(status.overrides).toEqual({});
    expect(status.error).toMatch(/JSON/);
  });
  it('reports an unknown tunable instead of throwing', () => {
    const status = readTune('?tune={"BOGUS":1}');
    expect(status.active).toBe(false);
    expect(status.overrides).toEqual({});
    expect(status.error).toMatch(/unknown tunable/);
  });
  it('treats an empty object as no overrides', () => {
    expect(readTune('?tune={}')).toEqual({ overrides: {}, active: false, error: null });
  });
});

describe('applyTune', () => {
  afterEach(() => {
    overrideTuning({ MEDIC_SPEED: defaults.MEDIC_SPEED, WEAPONS: defaults.WEAPONS });
  });
  it('applies a valid override so the sim modules see it', () => {
    const status = applyTune(`?seed=7&tune=${launcherJson}`);
    expect(status.active).toBe(true);
    expect(constants.WEAPONS.launcher.cooldown).toBe(180);
    expect(constants.WEAPONS.launcher.damage).toBe(defaults.WEAPONS.launcher.damage);
  });
  it('changes nothing for an invalid override', () => {
    const status = applyTune('?tune={"MEDIC_SPEED":1,"BOGUS":1}');
    expect(status.active).toBe(false);
    expect(status.error).toMatch(/unknown tunable/);
    expect(constants.MEDIC_SPEED).toBe(defaults.MEDIC_SPEED);
  });
});
