import { describe, expect, it } from 'vitest';
import { createAi, createBattle, runBattle } from '../../src/sim';
import type { BattleEvent, BattleState } from '../../src/sim';
import { addClassStats, createStatsCollector, emptyClassStats, hitRate, sideTotals } from '../../src/stats/battleStats';
import type { StatsCollector } from '../../src/stats/battleStats';

/** A fresh battle whose `tick` says one step has run, with the given events on it. */
function observed(events: BattleEvent[], prepare?: (state: BattleState) => void): { state: BattleState; c: StatsCollector } {
  const state = createBattle({ seed: 1 });
  state.tick = 1;
  state.events = events;
  if (prepare !== undefined) {
    prepare(state);
  }
  const c = createStatsCollector(1, {});
  c.observe(state);
  return { state, c };
}

describe('createStatsCollector', () => {
  it('counts a shot event for the shooter\'s side and class', () => {
    const { c } = observed([{ kind: 'shot', soldierId: 0, weapon: 'gunner' }]);
    expect(c.stats().sides.blue.gunner.shots).toBe(1);
    expect(c.stats().sides.red.gunner.shots).toBe(0);
  });

  it('counts a scorcher tick with the cone active as a shot, with no event needed', () => {
    const { state, c } = observed([], (s) => {
      s.soldiers[3].firing = true;
    });
    expect(c.stats().sides.blue.scorcher.shots).toBe(1);
    state.tick = 2;
    c.observe(state);
    expect(c.stats().sides.blue.scorcher.shots).toBe(2);
    expect(c.stats().sides.red.scorcher.shots).toBe(0);
  });

  it('counts the shot for a scorcher downed on the tick it burned, so its rate never passes 100%', () => {
    // Flame runs in id order: blue scorcher 3 burns red scorcher 8, then 8 burns 3 down in the same tick,
    // so after the step 3 is downed with firing false and would get a hit with no shot.
    const { c } = observed([{ kind: 'damage', soldierId: 8, amount: 0.5, weapon: 'scorcher', sourceId: 3 }], (s) => {
      s.soldiers[3].status = 'downed';
      s.soldiers[3].firing = false;
    });
    expect(c.stats().sides.blue.scorcher.shots).toBe(1);
    expect(c.stats().sides.blue.scorcher.hits).toBe(1);
  });

  it('credits damage dealt, a hit and damage taken from a damage event', () => {
    const { c } = observed([{ kind: 'damage', soldierId: 5, amount: 5, weapon: 'gunner', sourceId: 0 }]);
    const s = c.stats();
    expect(s.sides.blue.gunner.damageDealt).toBe(5);
    expect(s.sides.blue.gunner.hits).toBe(1);
    expect(s.sides.red.gunner.damageTaken).toBe(5);
    expect(s.sides.red.gunner.hits).toBe(0);
  });

  it('counts one hit when a grenade catches two enemies on the same tick', () => {
    const { c } = observed([
      { kind: 'damage', soldierId: 5, amount: 30, weapon: 'chucker', sourceId: 2 },
      { kind: 'damage', soldierId: 6, amount: 30, weapon: 'chucker', sourceId: 2 },
    ]);
    expect(c.stats().sides.blue.chucker.hits).toBe(1);
    expect(c.stats().sides.blue.chucker.damageDealt).toBe(60);
  });

  it('counts friendly fire as damage dealt and taken but not as a hit', () => {
    const { c } = observed([{ kind: 'damage', soldierId: 1, amount: 30, weapon: 'chucker', sourceId: 2 }]);
    const s = c.stats();
    expect(s.sides.blue.chucker.damageDealt).toBe(30);
    expect(s.sides.blue.chucker.hits).toBe(0);
    expect(s.sides.blue.launcher.damageTaken).toBe(30);
  });

  it('credits a down to the source of the damage that dropped the soldier', () => {
    const { c } = observed([
      { kind: 'damage', soldierId: 0, amount: 35, weapon: 'launcher', sourceId: 6 },
      { kind: 'downed', soldierId: 0 },
    ]);
    const s = c.stats();
    expect(s.sides.red.launcher.downsInflicted).toBe(1);
    expect(s.sides.red.launcher.instantKills).toBe(0);
    expect(s.sides.blue.gunner.timesDowned).toBe(1);
  });

  it('counts a killed event as a down and an instant kill', () => {
    const { c } = observed([
      { kind: 'damage', soldierId: 0, amount: 35, weapon: 'launcher', sourceId: 6 },
      { kind: 'killed', soldierId: 0 },
    ]);
    const s = c.stats();
    expect(s.sides.red.launcher.downsInflicted).toBe(1);
    expect(s.sides.red.launcher.instantKills).toBe(1);
    expect(s.sides.blue.gunner.timesDowned).toBe(1);
  });

  it('does not credit a friendly-fire down as a down inflicted', () => {
    const { c } = observed([
      { kind: 'damage', soldierId: 1, amount: 160, weapon: 'chucker', sourceId: 2 },
      { kind: 'downed', soldierId: 1 },
    ]);
    expect(c.stats().sides.blue.chucker.downsInflicted).toBe(0);
    expect(c.stats().sides.blue.launcher.timesDowned).toBe(1);
  });

  it('counts a medic call against the class it was spent on', () => {
    const { c } = observed([{ kind: 'medic', side: 'blue', targetId: 1 }]);
    expect(c.stats().sides.blue.launcher.medicCalls).toBe(1);
  });

  it('adds a downed tick per observed tick for downed soldiers, none for dead ones', () => {
    const { state, c } = observed([], (s) => {
      s.soldiers[0].status = 'downed';
      s.soldiers[7].status = 'dead';
    });
    expect(c.stats().sides.blue.gunner.downedTicks).toBe(1);
    expect(c.stats().sides.red.chucker.downedTicks).toBe(0);
    state.tick = 2;
    c.observe(state);
    expect(c.stats().sides.blue.gunner.downedTicks).toBe(2);
  });

  it('records the first contact tick as the tick just stepped and keeps it', () => {
    const { state, c } = observed([]);
    expect(c.stats().firstContactTick).toBeNull();
    state.tick = 10;
    state.events = [{ kind: 'damage', soldierId: 5, amount: 5, weapon: 'gunner', sourceId: 0 }];
    c.observe(state);
    expect(c.stats().firstContactTick).toBe(9);
    state.tick = 11;
    c.observe(state);
    expect(c.stats().firstContactTick).toBe(9);
  });

  it('reports the last observed tick, the winner, the seed and the overrides', () => {
    const state = createBattle({ seed: 42 });
    const c = createStatsCollector(42, { MEDIC_SPEED: 2 });
    expect(c.stats().ticks).toBe(0);
    expect(c.stats().winner).toBeNull();
    state.tick = 300;
    state.winner = 'red';
    state.events = [];
    c.observe(state);
    const s = c.stats();
    expect(s.ticks).toBe(300);
    expect(s.winner).toBe('red');
    expect(s.seed).toBe(42);
    expect(s.overrides).toEqual({ MEDIC_SPEED: 2 });
  });

  it('collects a real AI-versus-AI battle through runBattle', () => {
    const seed = 7;
    const c = createStatsCollector(seed, {});
    let firstDamage: number | null = null;
    const run = runBattle({
      seed,
      maxTicks: 18000,
      controllers: [createAi('blue', seed), createAi('red', seed)],
      onStep(state) {
        if (firstDamage === null && state.events.some((e) => e.kind === 'damage')) {
          firstDamage = state.tick - 1;
        }
        c.observe(state);
      },
    });
    const s = c.stats();
    expect(s.ticks).toBe(run.ticks);
    expect(s.winner).toBe(run.state.winner);
    expect(s.firstContactTick).toBe(firstDamage);
    expect(s.sides.blue.gunner.shots).toBeGreaterThan(0);
    expect(s.sides.red.gunner.shots).toBeGreaterThan(0);
    expect(sideTotals(s, 'blue').timesDowned + sideTotals(s, 'red').timesDowned).toBeGreaterThan(0);
  });
});

describe('helpers', () => {
  it('sideTotals sums the five classes', () => {
    const { c } = observed([
      { kind: 'shot', soldierId: 0, weapon: 'gunner' },
      { kind: 'shot', soldierId: 1, weapon: 'launcher' },
      { kind: 'shot', soldierId: 2, weapon: 'chucker' },
    ]);
    expect(sideTotals(c.stats(), 'blue').shots).toBe(3);
    expect(sideTotals(c.stats(), 'red').shots).toBe(0);
  });
  it('hitRate is hits over shots, null without shots', () => {
    expect(hitRate({ ...emptyClassStats(), shots: 0, hits: 0 })).toBeNull();
    expect(hitRate({ ...emptyClassStats(), shots: 4, hits: 1 })).toBe(0.25);
  });
  it('addClassStats adds every field', () => {
    const into = emptyClassStats();
    const from = { shots: 1, hits: 2, damageDealt: 3, damageTaken: 4, downsInflicted: 5, timesDowned: 6, instantKills: 7, downedTicks: 8, medicCalls: 9 };
    addClassStats(into, from);
    addClassStats(into, from);
    expect(into).toEqual({ shots: 2, hits: 4, damageDealt: 6, damageTaken: 8, downsInflicted: 10, timesDowned: 12, instantKills: 14, downedTicks: 16, medicCalls: 18 });
  });
});
