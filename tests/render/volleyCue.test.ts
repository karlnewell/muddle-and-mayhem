import { describe, expect, it } from 'vitest';
import { VOLLEY_CUE_MS } from '../../src/render/renderConstants';
import { startVolleyCue, volleyCueFromCommands, volleyCueProgress, volleyCueShooters } from '../../src/render/volleyCue';
import { createBattle } from '../../src/sim';
import type { Command } from '../../src/sim';

const volley: Command = { tick: 0, side: 'blue', type: 'attack', soldierIds: [0, 1, 2, 3, 4], targetId: 8, stand: true };

describe('volleyCueFromCommands', () => {
  it('takes the soldiers and target of a stand-fast attack on the player side', () => {
    expect(volleyCueFromCommands([volley], 'blue')).toEqual({ soldierIds: [0, 1, 2, 3, 4], targetId: 8, startMs: null });
  });
  it('ignores ordinary attacks, other commands and the other side', () => {
    const plain: Command = { tick: 0, side: 'blue', type: 'attack', soldierIds: [1], targetId: 6 };
    const move: Command = { tick: 0, side: 'blue', type: 'move', soldierIds: [1], x: 100, y: 100 };
    expect(volleyCueFromCommands([plain, move], 'blue')).toBeNull();
    expect(volleyCueFromCommands([{ ...volley, side: 'red', soldierIds: [5], targetId: 0 }], 'blue')).toBeNull();
  });
});

describe('volleyCueShooters', () => {
  it('draws only soldiers still standing, and nothing once the target is down', () => {
    const state = createBattle({ seed: 7 });
    const cue = volleyCueFromCommands([volley], 'blue')!;
    state.soldiers[2].status = 'downed';
    expect(volleyCueShooters(state, cue).map((s) => s.id)).toEqual([0, 1, 3, 4]);
    state.soldiers[8].status = 'downed';
    expect(volleyCueShooters(state, cue)).toEqual([]);
  });
});

describe('volleyCueProgress', () => {
  it('holds at 0 until stamped, then runs to 1 over VOLLEY_CUE_MS of real time', () => {
    const cue = volleyCueFromCommands([volley], 'blue')!;
    expect(volleyCueProgress(cue, 5000)).toBe(0);
    const started = startVolleyCue(cue, 1000);
    expect(started.startMs).toBe(1000);
    expect(startVolleyCue(started, 2000)).toBe(started);
    expect(volleyCueProgress(started, 1000)).toBe(0);
    expect(volleyCueProgress(started, 1000 + VOLLEY_CUE_MS / 2)).toBeCloseTo(0.5);
    expect(volleyCueProgress(started, 1000 + VOLLEY_CUE_MS)).toBe(1);
    expect(volleyCueProgress(started, 1000 + VOLLEY_CUE_MS * 3)).toBe(1);
  });
});
