import { describe, expect, it } from 'vitest';
import { createBattle, step } from '../../src/sim/battle';
import { CLASS_ORDER, MAX_HP, MEDIC_CALLS, SQUAD_NAMES } from '../../src/sim/constants';
import { CROSSROADS } from '../../src/sim/maps/crossroads';
import type { Command } from '../../src/sim/types';

describe('createBattle', () => {
  it('builds ten standing soldiers on the Crossroads spawns in class order', () => {
    const state = createBattle({ seed: 1 });
    expect(state.tick).toBe(0);
    expect(state.seed).toBe(1);
    expect(state.winner).toBeNull();
    expect(state.map).toBe(CROSSROADS);
    expect(state.soldiers.length).toBe(10);
    expect(state.projectiles).toEqual([]);
    expect(state.medics).toEqual([]);
    expect(state.events).toEqual([]);
    expect(state.nextProjectileId).toBe(0);
    expect(state.sides.blue).toEqual({ medicCalls: MEDIC_CALLS, selected: [] });
    expect(state.sides.red).toEqual({ medicCalls: MEDIC_CALLS, selected: [] });

    for (let id = 0; id < 10; id++) {
      const s = state.soldiers[id];
      const side = id < 5 ? 'blue' : 'red';
      const i = id < 5 ? id : id - 5;
      expect(s.id).toBe(id);
      expect(s.side).toBe(side);
      expect(s.cls).toBe(CLASS_ORDER[i]);
      expect(s.name).toBe(SQUAD_NAMES[side][i]);
      expect({ x: s.x, y: s.y }).toEqual(CROSSROADS.spawns[side][i]);
      expect({ x: s.prevX, y: s.prevY }).toEqual(CROSSROADS.spawns[side][i]);
      expect(s.hp).toBe(MAX_HP);
      expect(s.status).toBe('standing');
      expect(s.order).toEqual({ kind: 'hold' });
      expect(s.path).toEqual([]);
      expect(s.faceX).toBe(side === 'blue' ? 1 : -1);
      expect(s.faceY).toBe(0);
      expect(s.cooldown).toBe(0);
      expect(s.targetId).toBeNull();
      expect(s.firing).toBe(false);
      expect(s.stuckTicks).toBe(0);
      expect(s.lastRepathTick).toBe(-1);
      expect(s.downedTick).toBe(-1);
      expect(s.orderTick).toBe(-1);
    }
  });

  it('seeds the rng from the seed', () => {
    const a = createBattle({ seed: 7 });
    const b = createBattle({ seed: 7 });
    const c = createBattle({ seed: 8 });
    const first = a.rng.next();
    expect(b.rng.next()).toBe(first);
    expect(c.rng.next()).not.toBe(first);
  });
});

describe('step', () => {
  it('increments the tick and leaves idle soldiers where they are', () => {
    const state = createBattle({ seed: 1 });
    step(state, []);
    expect(state.tick).toBe(1);
    for (const s of state.soldiers) {
      expect(s.prevX).toBe(s.x);
      expect(s.prevY).toBe(s.y);
      expect(s.order).toEqual({ kind: 'hold' });
    }
  });

  it('ignores a command tagged with a different tick', () => {
    const state = createBattle({ seed: 1 });
    const late: Command = { tick: 5, side: 'blue', type: 'move', soldierIds: [0], x: 200, y: 208 };
    step(state, [late]);
    expect(state.soldiers[0].order).toEqual({ kind: 'hold' });
    expect(state.soldiers[0].x).toBe(CROSSROADS.spawns.blue[0].x);
  });

  it('applies a command tagged with the current tick', () => {
    const state = createBattle({ seed: 1 });
    const now: Command = { tick: 0, side: 'blue', type: 'move', soldierIds: [0], x: 200, y: 208 };
    step(state, [now]);
    expect(state.soldiers[0].order).toEqual({ kind: 'move', x: 200, y: 208 });
    expect(state.soldiers[0].x).toBeGreaterThan(CROSSROADS.spawns.blue[0].x);
  });

  it('clears the events list at the start of every step', () => {
    const state = createBattle({ seed: 1 });
    state.events.push({ kind: 'jam', soldierId: 0 });
    step(state, []);
    expect(state.events).toEqual([]);
  });

  it('does nothing once a winner is set', () => {
    const state = createBattle({ seed: 1 });
    state.winner = 'blue';
    step(state, []);
    expect(state.tick).toBe(0);
  });

  it('is deterministic: same seed and commands give JSON-equal states', () => {
    const commands: Command[] = [
      { tick: 0, side: 'blue', type: 'move', soldierIds: [0, 1], x: 400, y: 300 },
      { tick: 0, side: 'red', type: 'attack', soldierIds: [5, 6, 7], targetId: 0 },
      { tick: 10, side: 'blue', type: 'attack', soldierIds: [2, 3, 4], targetId: 9 },
      { tick: 40, side: 'red', type: 'move', soldierIds: [8, 9], x: 700, y: 352 },
      { tick: 60, side: 'blue', type: 'hold', soldierIds: [0] },
    ];
    const a = createBattle({ seed: 42 });
    const b = createBattle({ seed: 42 });
    for (let i = 0; i < 100; i++) {
      step(a, commands);
      step(b, commands);
    }
    expect(a.tick).toBe(100);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
