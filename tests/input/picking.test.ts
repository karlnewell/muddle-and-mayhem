import { describe, expect, it } from 'vitest';
import { pickSoldier } from '../../src/input/picking';
import { createBattle, soldierById } from '../../src/sim';

describe('pickSoldier', () => {
  it('returns the soldier within radius of the point and null elsewhere', () => {
    const state = createBattle({ seed: 1 });
    const pip = soldierById(state, 0)!;
    expect(pickSoldier(state, pip.x + 5, pip.y - 5, 18)?.id).toBe(0);
    expect(pickSoldier(state, pip.x + 40, pip.y, 18)).toBeNull();
  });
  it('prefers the nearest when two are in reach', () => {
    const state = createBattle({ seed: 1 });
    const a = soldierById(state, 0)!;
    const b = soldierById(state, 1)!;
    b.x = a.x;
    b.y = a.y + 20;
    expect(pickSoldier(state, a.x, a.y + 12, 18)?.id).toBe(1);
    expect(pickSoldier(state, a.x, a.y + 8, 18)?.id).toBe(0);
  });
  it('ignores dead soldiers but picks downed ones', () => {
    const state = createBattle({ seed: 1 });
    const a = soldierById(state, 0)!;
    a.status = 'dead';
    expect(pickSoldier(state, a.x, a.y, 18)).toBeNull();
    a.status = 'downed';
    expect(pickSoldier(state, a.x, a.y, 18)?.id).toBe(0);
  });
});
