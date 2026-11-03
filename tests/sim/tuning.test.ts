import { afterEach, describe, expect, it } from 'vitest';
import * as constants from '../../src/sim/constants';
import { createAi } from '../../src/sim/ai';
import { runBattle } from '../../src/sim/headless';
import { TUNABLE_NAMES, overrideTuning, validateTuning } from '../../src/sim/constants';

// Vitest gives every test file its own module instances, so overriding here
// cannot leak into other files; afterEach still restores the defaults.
const defaults = {
  MEDIC_SPEED: constants.MEDIC_SPEED,
  WEAPONS: constants.WEAPONS,
  CLASS_STATS: constants.CLASS_STATS,
};

describe('overrideTuning', () => {
  afterEach(() => {
    overrideTuning({ MEDIC_SPEED: defaults.MEDIC_SPEED });
    overrideTuning({ WEAPONS: defaults.WEAPONS });
    overrideTuning({ CLASS_STATS: defaults.CLASS_STATS });
  });

  it('replaces a scalar tunable that other modules read live', () => {
    overrideTuning({ MEDIC_SPEED: 1 });
    expect(constants.MEDIC_SPEED).toBe(1);
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
    expect(() => overrideTuning({ MEDIC_SPEED: '2' } as never)).toThrow(/must be a number/);
  });

  it('is all or nothing: a bad name later in the object leaves earlier scalars untouched', () => {
    expect(() => overrideTuning({ MEDIC_SPEED: 1, BOGUS: 2 } as never)).toThrow(/unknown tunable/);
    expect(constants.MEDIC_SPEED).toBe(defaults.MEDIC_SPEED);
  });
});

describe('validateTuning', () => {
  it('accepts a good object without changing anything', () => {
    expect(() => validateTuning({ MEDIC_SPEED: 1 })).not.toThrow();
    expect(() => validateTuning({ WEAPONS: { launcher: { cooldown: 180 } } })).not.toThrow();
    expect(() => validateTuning({})).not.toThrow();
    expect(constants.MEDIC_SPEED).toBe(defaults.MEDIC_SPEED);
    expect(constants.WEAPONS.launcher.cooldown).toBe(defaults.WEAPONS.launcher.cooldown);
  });
  it('rejects anything but a plain object', () => {
    expect(() => validateTuning([])).toThrow(/object/);
    expect(() => validateTuning(null)).toThrow(/object/);
    expect(() => validateTuning('MEDIC_SPEED')).toThrow(/object/);
  });
  it('rejects unknown names, classes and weapon fields, and wrong types', () => {
    expect(() => validateTuning({ BOGUS: 1 })).toThrow(/unknown tunable/);
    expect(() => validateTuning({ WEAPONS: { sniper: { range: 1 } } })).toThrow(/unknown class/);
    expect(() => validateTuning({ WEAPONS: { gunner: { bogus: 1 } } })).toThrow(/unknown weapon field/);
    expect(() => validateTuning({ WEAPONS: { gunner: { cooldown: 'x' } } })).toThrow(/must be a number/);
    expect(() => validateTuning({ WEAPONS: 5 })).toThrow(/WEAPONS/);
    expect(() => validateTuning({ MEDIC_SPEED: Infinity })).toThrow(/must be a number/);
  });
});

describe('CLASS_STATS overrides', () => {
  afterEach(() => {
    overrideTuning({ CLASS_STATS: defaults.CLASS_STATS });
  });

  it('merges one class field and leaves the other field and the other classes alone', () => {
    overrideTuning({ CLASS_STATS: { scorcher: { maxHp: 100 } } });
    expect(constants.CLASS_STATS.scorcher).toEqual({ maxHp: 100, speed: defaults.CLASS_STATS.scorcher.speed });
    for (const cls of ['gunner', 'launcher', 'chucker', 'blaster'] as const) {
      expect(constants.CLASS_STATS[cls]).toEqual(defaults.CLASS_STATS[cls]);
    }
  });

  it('accepts a good CLASS_STATS object without changing anything', () => {
    expect(() => validateTuning({ CLASS_STATS: { scorcher: { maxHp: 100, speed: 2.07 }, launcher: { speed: 1.53 } } })).not.toThrow();
    expect(constants.CLASS_STATS).toEqual(defaults.CLASS_STATS);
  });

  it('rejects a non-object, an unknown class, an unknown field, a wrong type and a non-finite value', () => {
    expect(() => validateTuning({ CLASS_STATS: 3 })).toThrow(/CLASS_STATS must be an object/);
    expect(() => validateTuning({ CLASS_STATS: { medic: { maxHp: 1 } } })).toThrow(/unknown class medic/);
    expect(() => validateTuning({ CLASS_STATS: { scorcher: { armour: 1 } } })).toThrow(/unknown class stat scorcher\.armour/);
    expect(() => validateTuning({ CLASS_STATS: { scorcher: 5 } })).toThrow(/must be an object of fields/);
    expect(() => validateTuning({ CLASS_STATS: { scorcher: { maxHp: '100' } } })).toThrow(/must be a number/);
    expect(() => validateTuning({ CLASS_STATS: { scorcher: { speed: Infinity } } })).toThrow(/must be a number/);
    expect(() => validateTuning({ CLASS_STATS: { scorcher: { speed: NaN } } })).toThrow(/must be a number/);
    expect(() => validateTuning({ CLASS_STATS: { scorcher: { speed: null } } })).toThrow(/must be a number/);
  });

  it('is all or nothing: a bad class after a good one leaves the table unchanged', () => {
    expect(() => overrideTuning({ CLASS_STATS: { scorcher: { maxHp: 100 }, launcher: { armour: 1 } } } as never)).toThrow(/unknown class stat/);
    expect(constants.CLASS_STATS).toEqual(defaults.CLASS_STATS);
  });

  it('rejects the retired MAX_HP and MOVE_SPEED as unknown tunables', () => {
    expect(() => validateTuning({ MAX_HP: 120 })).toThrow(/unknown tunable MAX_HP/);
    expect(() => validateTuning({ MOVE_SPEED: 2 })).toThrow(/unknown tunable MOVE_SPEED/);
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

describe('AI wait flags', () => {
  it('AI_LOBBER_WAIT and AI_SCORCHER_WAIT are tunables', () => {
    expect(TUNABLE_NAMES).toContain('AI_LOBBER_WAIT');
    expect(TUNABLE_NAMES).toContain('AI_SCORCHER_WAIT');
  });
});

describe('TUNABLE_NAMES', () => {
  it('lists every scalar tunable once', () => {
    expect(TUNABLE_NAMES).toContain('MEDIC_SPEED');
    expect(TUNABLE_NAMES).toContain('AI_SPACING_PENALTY');
    expect(TUNABLE_NAMES).not.toContain('MAX_HP');
    expect(TUNABLE_NAMES).not.toContain('MOVE_SPEED');
    expect(TUNABLE_NAMES).toContain('AI_STAY_BONUS');
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
