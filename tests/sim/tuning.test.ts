import { afterEach, describe, expect, it } from 'vitest';
import * as constants from '../../src/sim/constants';
import { createAi } from '../../src/sim/ai';
import { runBattle } from '../../src/sim/headless';
import { overrideTuning } from '../../src/sim/constants';

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
});

describe('runBattle onStep', () => {
  it('is called once per tick with that tick\'s events still on the state', () => {
    const seed = 3;
    let calls = 0;
    let sawEvent = false;
    const run = runBattle({
      seed,
      maxTicks: 200,
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
