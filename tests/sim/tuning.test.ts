import { afterEach, describe, expect, it } from 'vitest';
import * as constants from '../../src/sim/constants';
import { createAi } from '../../src/sim/ai';
import { runBattle } from '../../src/sim/headless';
import { TUNABLE_NAMES, overrideTuning, validateTuning } from '../../src/sim/constants';

// Vitest gives every test file its own module instances, so overriding here
// cannot leak into other files; afterEach still restores the defaults.
const defaults = {
  MOVE_SPEED: constants.MOVE_SPEED,
  WEAPONS: constants.WEAPONS,
};

describe('overrideTuning', () => {
  afterEach(() => {
    overrideTuning({ MOVE_SPEED: defaults.MOVE_SPEED });
    overrideTuning({ WEAPONS: defaults.WEAPONS });
  });

  it('replaces a scalar tunable that other modules read live', () => {
    overrideTuning({ MOVE_SPEED: 1 });
    expect(constants.MOVE_SPEED).toBe(1);
  });

  it('merges one weapon field and leaves the rest alone', () => {
    const before = constants.WEAPONS.gunner;
    overrideTuning({ WEAPONS: { gunner: { cooldown: before.cooldown + 7 } } });
    expect(constants.WEAPONS.gunner.cooldown).toBe(before.cooldown + 7);
    expect(constants.WEAPONS.gunner.damage).toBe(before.damage);
    expect(constants.WEAPONS.launcher).toEqual(defaults.WEAPONS.launcher);
  });

  it('rejects unknown names, unknown classes and non-numbers', () => {
    expect(() => overrideTuning({ TICK_RATE: 60 } as never)).toThrow(/unknown tunable/);
    expect(() => overrideTuning({ WEAPONS: { sniper: { range: 1 } } } as never)).toThrow(/unknown class/);
    expect(() => overrideTuning({ MOVE_SPEED: '2' } as never)).toThrow(/must be a number/);
  });

  it('is all or nothing: a bad name later in the object leaves earlier scalars untouched', () => {
    expect(() => overrideTuning({ MOVE_SPEED: 1, BOGUS: 2 } as never)).toThrow(/unknown tunable/);
    expect(constants.MOVE_SPEED).toBe(defaults.MOVE_SPEED);
  });
});

describe('validateTuning', () => {
  it('accepts a good object without changing anything', () => {
    expect(() => validateTuning({ MOVE_SPEED: 1 })).not.toThrow();
    expect(() => validateTuning({ WEAPONS: { launcher: { cooldown: 180 } } })).not.toThrow();
    expect(() => validateTuning({})).not.toThrow();
    expect(constants.MOVE_SPEED).toBe(defaults.MOVE_SPEED);
    expect(constants.WEAPONS.launcher.cooldown).toBe(defaults.WEAPONS.launcher.cooldown);
  });
  it('rejects anything but a plain object', () => {
    expect(() => validateTuning([])).toThrow(/object/);
    expect(() => validateTuning(null)).toThrow(/object/);
    expect(() => validateTuning('MOVE_SPEED')).toThrow(/object/);
  });
  it('rejects unknown names, classes and weapon fields, and wrong types', () => {
    expect(() => validateTuning({ BOGUS: 1 })).toThrow(/unknown tunable/);
    expect(() => validateTuning({ WEAPONS: { sniper: { range: 1 } } })).toThrow(/unknown class/);
    expect(() => validateTuning({ WEAPONS: { gunner: { bogus: 1 } } })).toThrow(/unknown weapon field/);
    expect(() => validateTuning({ WEAPONS: { gunner: { cooldown: 'x' } } })).toThrow(/must be a number/);
    expect(() => validateTuning({ WEAPONS: 5 })).toThrow(/WEAPONS/);
    expect(() => validateTuning({ MOVE_SPEED: Infinity })).toThrow(/must be a number/);
  });
});

describe('COVER_SPLASH_FRACTION', () => {
  it('is a tunable that other modules read live', () => {
    const before = constants.COVER_SPLASH_FRACTION;
    expect(TUNABLE_NAMES).toContain('COVER_SPLASH_FRACTION');
    try {
      overrideTuning({ COVER_SPLASH_FRACTION: 0.25 });
      expect(constants.COVER_SPLASH_FRACTION).toBe(0.25);
    } finally {
      overrideTuning({ COVER_SPLASH_FRACTION: before });
    }
  });
});

describe('FIRING_MOVE_FRACTION and fireWhileMoving', () => {
  it('FIRING_MOVE_FRACTION is a tunable that other modules read live', () => {
    const before = constants.FIRING_MOVE_FRACTION;
    expect(TUNABLE_NAMES).toContain('FIRING_MOVE_FRACTION');
    try {
      overrideTuning({ FIRING_MOVE_FRACTION: 0.25 });
      expect(constants.FIRING_MOVE_FRACTION).toBe(0.25);
    } finally {
      overrideTuning({ FIRING_MOVE_FRACTION: before });
    }
  });
  it('fireWhileMoving is a boolean weapon field that validates by type', () => {
    expect(() => validateTuning({ WEAPONS: { scorcher: { fireWhileMoving: false } } })).not.toThrow();
    expect(() => validateTuning({ WEAPONS: { scorcher: { fireWhileMoving: 0 } } })).toThrow(/must be a boolean/);
  });
});

describe('TUNABLE_NAMES', () => {
  it('lists every scalar tunable once', () => {
    expect(TUNABLE_NAMES).toContain('MOVE_SPEED');
    expect(TUNABLE_NAMES).toContain('AI_SPACING_PENALTY');
    expect(new Set(TUNABLE_NAMES).size).toBe(TUNABLE_NAMES.length);
    for (const name of TUNABLE_NAMES) {
      expect(() => validateTuning({ [name]: 1 })).not.toThrow();
    }
  });
});

describe('runBattle onStep', () => {
  it('is called once per tick with that tick\'s events still on the state', () => {
    const seed = 3;
    let calls = 0;
    let sawEvent = false;
    const run = runBattle({
      seed,
      maxTicks: 600,
      controllers: [createAi('blue', seed), createAi('red', seed)],
      onStep(state) {
        calls++;
        expect(state.tick).toBe(calls);
        if (state.events.length > 0) {
          sawEvent = true;
        }
      },
    });
    expect(calls).toBe(run.ticks);
    expect(sawEvent).toBe(true);
  });
});
