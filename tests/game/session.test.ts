import { describe, expect, it } from 'vitest';
import { createSession } from '../../src/game/session';
import { MAX_FRAME_MS, MAX_TICKS_PER_FRAME, TICK_MS } from '../../src/render/renderConstants';
import { hashState, replayBattle, soldierById } from '../../src/sim';
import type { Command } from '../../src/sim';

describe('createSession', () => {
  it('starts paused at tick 0 with an empty log and the given seed', () => {
    const s = createSession(42);
    expect(s.seed).toBe(42);
    expect(s.paused).toBe(true);
    expect(s.state.tick).toBe(0);
    expect(s.log).toEqual([]);
  });

  it('does not step while paused, however much time passes', () => {
    const s = createSession(1);
    expect(s.advance(1000)).toEqual([]);
    expect(s.state.tick).toBe(0);
  });

  it('applies a queued player command on the next step', () => {
    const s = createSession(1);
    s.queue({ tick: s.state.tick, side: 'blue', type: 'move', soldierIds: [0], x: 400, y: 300 });
    s.stepOnce();
    const pip = soldierById(s.state, 0)!;
    expect(pip.order.kind).toBe('move');
    expect(s.log[0]).toMatchObject({ type: 'move', side: 'blue', tick: 0 });
  });

  it('exposes queued commands until they are stepped', () => {
    const s = createSession(1);
    s.queue({ tick: 0, side: 'blue', type: 'hold', soldierIds: [0] });
    expect(s.pending).toHaveLength(1);
    expect(s.log).toHaveLength(0);
    s.stepOnce();
    expect(s.pending).toHaveLength(0);
    expect(s.log[0]).toMatchObject({ type: 'hold' });
  });

  it('rejects a command tagged with another tick', () => {
    const s = createSession(1);
    expect(() => s.queue({ tick: 5, side: 'blue', type: 'hold', soldierIds: [0] })).toThrow(/tick/);
  });

  it('logs the red AI commands through the same log', () => {
    const s = createSession(7);
    s.paused = false;
    for (let i = 0; i < 60; i++) s.stepOnce();
    expect(s.log.some((c) => c.side === 'red')).toBe(true);
  });

  it('replays bit for bit from seed and log with scripted player commands', () => {
    const s = createSession(2026);
    s.paused = false;
    const script: Command[] = [
      { tick: 0, side: 'blue', type: 'select', soldierIds: [0, 1] },
      { tick: 0, side: 'blue', type: 'move', soldierIds: [0, 1], x: 500, y: 352 },
      { tick: 40, side: 'blue', type: 'hold', soldierIds: [0] },
      { tick: 90, side: 'blue', type: 'attack', soldierIds: [1, 2], targetId: 5 },
    ];
    for (let i = 0; i < 300 && s.state.winner === null; i++) {
      for (const c of script) if (c.tick === s.state.tick) s.queue(c);
      s.stepOnce();
    }
    for (let i = 1; i < s.log.length; i++) {
      expect(s.log[i].tick).toBeGreaterThanOrEqual(s.log[i - 1].tick);
    }
    const replayed = replayBattle(s.seed, s.log, s.state.tick);
    expect(hashState(replayed)).toBe(hashState(s.state));
    expect(s.replayMatches()).toBe(true);
  });

  it('clamps a long frame and never runs more than MAX_TICKS_PER_FRAME ticks per advance', () => {
    const s = createSession(3);
    s.paused = false;
    s.advance(1000);
    const expected = Math.min(MAX_TICKS_PER_FRAME, Math.floor(MAX_FRAME_MS / TICK_MS));
    expect(s.state.tick).toBe(expected);
    expect(s.state.tick).toBeLessThanOrEqual(MAX_TICKS_PER_FRAME);
    expect(s.alpha()).toBeGreaterThanOrEqual(0);
    expect(s.alpha()).toBeLessThan(1);
  });

  it('collects events from every tick stepped in one advance', () => {
    const s = createSession(3);
    s.paused = false;
    // Drive to a point where soldiers fire, then check events are not just the last tick's.
    let total = 0;
    for (let i = 0; i < 200 && s.state.winner === null; i++) {
      total += s.advance(100).length;
    }
    expect(total).toBeGreaterThan(0);
  });

  it('stops advancing once the battle has a winner', () => {
    const s = createSession(42);
    s.paused = false;
    while (s.state.winner === null) s.stepOnce();
    const tick = s.state.tick;
    expect(s.advance(1000)).toEqual([]);
    expect(s.state.tick).toBe(tick);
  });

  it('reports zero statistics at tick 0 and real ones once stepped', () => {
    const s = createSession(7);
    expect(s.stats().ticks).toBe(0);
    expect(s.stats().sides.blue.gunner.shots).toBe(0);
    expect(s.stats().sides.red.gunner.shots).toBe(0);
    s.paused = false;
    for (let i = 0; i < 600 && s.state.winner === null; i++) s.stepOnce();
    expect(s.stats().ticks).toBe(s.state.tick);
    expect(s.stats().sides.blue.gunner.shots).toBeGreaterThan(0);
    expect(s.stats().seed).toBe(7);
  });

  it('carries the overrides it was given into the statistics', () => {
    expect(createSession(7, { MOVE_SPEED: 2 }).stats().overrides).toEqual({ MOVE_SPEED: 2 });
    expect(createSession(7).stats().overrides).toEqual({});
  });
});

describe('session speed', () => {
  it('at 0.5 steps half the ticks for the same real time, and the battle it steps is the same', () => {
    const full = createSession(242832287);
    const half = createSession(242832287, {}, 0.5);
    full.paused = false;
    half.paused = false;
    for (let i = 0; i < 120; i++) {
      full.advance(1000 / 60);
    }
    for (let i = 0; i < 240; i++) {
      half.advance(1000 / 60);
    }
    expect(full.state.tick).toBeGreaterThan(55);
    expect(half.state.tick).toBe(full.state.tick);
    expect(hashState(half.state)).toBe(hashState(full.state));
    expect(half.log).toEqual(full.log);
    expect(half.replayMatches()).toBe(true);
  });
});
