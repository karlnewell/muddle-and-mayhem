import { describe, expect, it } from 'vitest';
import { createBattle, step } from '../../src/sim/battle';
import type { BattleState, Side, SoldierStatus } from '../../src/sim/types';
import { checkVictory } from '../../src/sim/victory';

function setSide(state: BattleState, side: Side, status: SoldierStatus): void {
  for (const s of state.soldiers) {
    if (s.side === side) {
      s.status = status;
      if (status !== 'standing') {
        s.hp = 0;
      }
    }
  }
}

describe('checkVictory', () => {
  it('leaves winner null while both sides have standing soldiers', () => {
    const state = createBattle({ seed: 1 });
    checkVictory(state);
    expect(state.winner).toBeNull();
    expect(state.events).toEqual([]);
  });

  it('declares blue when every red soldier is downed, with one victory event, once', () => {
    const state = createBattle({ seed: 1 });
    setSide(state, 'red', 'downed');
    checkVictory(state);
    expect(state.winner).toBe('blue');
    expect(state.events).toEqual([{ kind: 'victory', winner: 'blue' }]);
    checkVictory(state);
    expect(state.winner).toBe('blue');
    expect(state.events).toEqual([{ kind: 'victory', winner: 'blue' }]);
  });

  it('declares red when every blue soldier is out', () => {
    const state = createBattle({ seed: 1 });
    setSide(state, 'blue', 'dead');
    checkVictory(state);
    expect(state.winner).toBe('red');
    expect(state.events).toEqual([{ kind: 'victory', winner: 'red' }]);
  });

  it('counts downed and dead the same, and one standing soldier keeps the side alive', () => {
    const state = createBattle({ seed: 1 });
    state.soldiers[5].status = 'dead';
    state.soldiers[6].status = 'dead';
    state.soldiers[7].status = 'downed';
    state.soldiers[8].status = 'downed';
    checkVictory(state);
    expect(state.winner).toBeNull();
    expect(state.events).toEqual([]);

    state.soldiers[9].status = 'downed';
    checkVictory(state);
    expect(state.winner).toBe('blue');
    expect(state.events).toEqual([{ kind: 'victory', winner: 'blue' }]);
  });

  it('is a draw when neither side has a standing soldier', () => {
    const state = createBattle({ seed: 1 });
    setSide(state, 'blue', 'downed');
    setSide(state, 'red', 'dead');
    checkVictory(state);
    expect(state.winner).toBe('draw');
    expect(state.events).toEqual([{ kind: 'victory', winner: 'draw' }]);
  });

  it('never changes a winner once set', () => {
    const state = createBattle({ seed: 1 });
    state.winner = 'blue';
    setSide(state, 'blue', 'downed');
    checkVictory(state);
    expect(state.winner).toBe('blue');
    expect(state.events).toEqual([]);
  });
});

describe('step with the win check', () => {
  it('sets the winner at the end of the tick and freezes the battle afterwards', () => {
    const state = createBattle({ seed: 1 });
    setSide(state, 'red', 'downed');
    step(state, []);
    expect(state.tick).toBe(1);
    expect(state.winner).toBe('blue');
    expect(state.events).toContainEqual({ kind: 'victory', winner: 'blue' });
    step(state, []);
    step(state, []);
    expect(state.tick).toBe(1);
  });
});
