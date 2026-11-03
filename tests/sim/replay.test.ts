import { describe, expect, it } from 'vitest';
import { createAi } from '../../src/sim/ai';
import { hashState, serializeState } from '../../src/sim/hash';
import { replayBattle, runBattle } from '../../src/sim/headless';
import { TICK_RATE } from '../../src/sim/constants';
import type { Command } from '../../src/sim/types';
import { DEFAULT_MAP, MAPS } from '../../src/sim/maps/registry';

const MAX_TICKS = TICK_RATE * 600; // ten minutes of battle, far more than any seed needs

describe('replay determinism', () => {
  for (const seed of [1, 7, 42, 2026]) {
    it(`AI-vs-AI battle from seed ${seed} ends and replays bit for bit`, () => {
      const run = runBattle({ seed, maxTicks: MAX_TICKS, controllers: [createAi('blue', seed), createAi('red', seed)] });
      expect(run.state.winner).not.toBeNull();
      expect(run.ticks).toBeLessThan(MAX_TICKS);
      expect(run.log.length).toBeLessThan(run.ticks);
      expect(run.log.some((c) => c.side === 'blue')).toBe(true);
      expect(run.log.some((c) => c.side === 'red')).toBe(true);
      const replayed = replayBattle(seed, run.log, run.ticks);
      expect(hashState(replayed)).toBe(hashState(run.state));
      expect(serializeState(replayed)).toBe(serializeState(run.state));
    });
  }
  it('a different seed gives a different battle', () => {
    const a = runBattle({ seed: 1, maxTicks: MAX_TICKS, controllers: [createAi('blue', 1), createAi('red', 1)] });
    const b = runBattle({ seed: 2, maxTicks: MAX_TICKS, controllers: [createAi('blue', 2), createAi('red', 2)] });
    expect(hashState(a.state)).not.toBe(hashState(b.state));
  });
  it('rejects a log whose ticks are not in ascending order', () => {
    const log: Command[] = [
      { tick: 15, side: 'blue', type: 'hold', soldierIds: [0] },
      { tick: 0, side: 'red', type: 'hold', soldierIds: [5] },
    ];
    expect(() => replayBattle(1, log, 30)).toThrow(/index 1/);
  });
  it('a tampered log gives a different final state', () => {
    const run = runBattle({ seed: 42, maxTicks: MAX_TICKS, controllers: [createAi('blue', 42), createAi('red', 42)] });
    let drop = run.log.findIndex((c) => c.type === 'move');
    if (drop < 0) drop = run.log.findIndex((c) => c.type !== 'select');
    expect(drop).toBeGreaterThanOrEqual(0);
    const log = run.log.filter((_, i) => i !== drop);
    const replayed = replayBattle(42, log, run.ticks);
    expect(hashState(replayed)).not.toBe(hashState(run.state));
  });
});

describe('replay on a named map', () => {
  it('an old Crossroads battle still replays when its map is given, and not on the default map', () => {
    const run = runBattle({ seed: 11, maxTicks: 900, map: MAPS.crossroads, controllers: [createAi('blue', 11), createAi('red', 11)] });
    expect(hashState(replayBattle(11, run.log, run.ticks, MAPS.crossroads))).toBe(hashState(run.state));
    expect(hashState(replayBattle(11, run.log, run.ticks))).not.toBe(hashState(run.state));
  });

  it('replays the default map, Compact Crossroads, when no map is given', () => {
    expect(DEFAULT_MAP).toBe(MAPS.compact);
    const run = runBattle({ seed: 11, maxTicks: 900, controllers: [createAi('blue', 11), createAi('red', 11)] });
    expect(run.state.map).toBe(MAPS.compact);
    expect(hashState(replayBattle(11, run.log, run.ticks))).toBe(hashState(run.state));
  });
});
