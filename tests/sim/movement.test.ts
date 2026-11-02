import { describe, expect, it } from 'vitest';
import { createBattle, step } from '../../src/sim/battle';
import { applyCommand } from '../../src/sim/commands';
import { MOVE_SPEED, SOLDIER_RADIUS } from '../../src/sim/constants';
import { circleOverlapsCover, mapHeightUnits, mapWidthUnits, parseMap, tileCenter } from '../../src/sim/map';
import { moveSoldiers } from '../../src/sim/movement';
import type { BattleState, Soldier, TileMap } from '../../src/sim/types';
import { dist2 } from '../../src/sim/vec';

const never = (): boolean => false;

/** A 10 by 10 map with a wall down column 4 from row 0 to row 7; spawns sit on row 9. */
function wallMap(): TileMap {
  const rows: string[] = [];
  for (let ty = 0; ty < 8; ty++) {
    rows.push('....#.....');
  }
  rows.push('..........');
  rows.push('bbbbbrrrrr');
  return parseMap('Wall', rows);
}

/** Every soldier except `keep` is downed so it plays no part in movement. */
function isolate(state: BattleState, keep: readonly number[]): void {
  for (const s of state.soldiers) {
    if (!keep.includes(s.id)) {
      s.status = 'downed';
    }
  }
}

function dist(a: Soldier, b: Soldier): number {
  return Math.sqrt(dist2(a.x, a.y, b.x, b.y));
}

describe('moveSoldiers', () => {
  it('walks 64 units along open ground and arrives exactly, then holds', () => {
    const state = createBattle({ seed: 1 });
    const s = state.soldiers[0];
    const destX = s.x + 64;
    const destY = s.y;
    applyCommand(state, { tick: 0, side: 'blue', type: 'move', soldierIds: [0], x: destX, y: destY });
    const budget = Math.ceil(64 / MOVE_SPEED) + 5;
    let arrivedAt = -1;
    for (let t = 0; t < budget; t++) {
      step(state, []);
      if (s.order.kind === 'hold') {
        arrivedAt = state.tick;
        break;
      }
    }
    expect(arrivedAt).toBeGreaterThan(0);
    expect(arrivedAt).toBeLessThanOrEqual(budget);
    expect(arrivedAt).toBeGreaterThanOrEqual(Math.floor(64 / MOVE_SPEED));
    expect(s.x).toBe(destX);
    expect(s.y).toBe(destY);
    expect(s.path).toEqual([]);
    expect(s.faceX).toBe(1);
    expect(s.faceY).toBe(0);
  });

  it('walks around a wall and never enters cover on the way', () => {
    const map = wallMap();
    const state = createBattle({ seed: 1, map });
    isolate(state, [0, 9]); // red 9 stays standing, off the route, so the win check does not end the battle
    const s = state.soldiers[0];
    const start = tileCenter(1, 4);
    const dest = tileCenter(8, 4);
    s.x = start.x;
    s.y = start.y;
    s.prevX = start.x;
    s.prevY = start.y;
    applyCommand(state, { tick: 0, side: 'blue', type: 'move', soldierIds: [0], x: dest.x, y: dest.y });
    expect(s.path.length).toBeGreaterThan(7); // longer than the straight line of 7 tiles
    // Generous budget: a detour of about 11 tiles plus slack at MOVE_SPEED.
    const budget = Math.ceil((14 * 32) / MOVE_SPEED);
    for (let t = 0; t < budget && s.order.kind !== 'hold'; t++) {
      step(state, []);
      expect(circleOverlapsCover(map, s.x, s.y, SOLDIER_RADIUS)).toBe(false);
    }
    expect(s.order).toEqual({ kind: 'hold' });
    expect(Math.sqrt(dist2(s.x, s.y, dest.x, dest.y))).toBeLessThanOrEqual(2);
  });

  it('keeps two soldiers sent to one point apart by their diameter', () => {
    const state = createBattle({ seed: 1 });
    const a = state.soldiers[0];
    const b = state.soldiers[1];
    const x = a.x;
    const y = (a.y + b.y) / 2;
    applyCommand(state, { tick: 0, side: 'blue', type: 'move', soldierIds: [0, 1], x, y });
    for (let t = 0; t < 100; t++) {
      step(state, []);
    }
    expect(a.order).toEqual({ kind: 'hold' });
    expect(b.order).toEqual({ kind: 'hold' });
    expect(dist(a, b)).toBeGreaterThanOrEqual(2 * SOLDIER_RADIUS - 0.01);
  });

  it('separates every overlapping pair, not only the first', () => {
    const state = createBattle({ seed: 1 });
    const point = tileCenter(10, 10);
    for (let id = 0; id < 5; id++) {
      state.soldiers[id].x = point.x;
      state.soldiers[id].y = point.y;
    }
    for (let t = 0; t < 30; t++) {
      step(state, []);
    }
    for (let i = 0; i < 5; i++) {
      for (let j = i + 1; j < 5; j++) {
        expect(dist(state.soldiers[i], state.soldiers[j])).toBeGreaterThanOrEqual(2 * SOLDIER_RADIUS - 0.01);
      }
    }
  });

  it('approaches a far enemy under an attack order while canFireAt is false', () => {
    const state = createBattle({ seed: 1 });
    const s = state.soldiers[0];
    const target = state.soldiers[5];
    applyCommand(state, { tick: 0, side: 'blue', type: 'attack', soldierIds: [0], targetId: 5 });
    let last = dist(s, target);
    for (let t = 0; t < 40; t++) {
      step(state, []);
      const now = dist(s, target);
      expect(now).toBeLessThan(last);
      last = now;
    }
    expect(s.order).toEqual({ kind: 'attack', targetId: 5 });
  });

  it('stops and faces the target when canFireAt is true', () => {
    const state = createBattle({ seed: 1 });
    const s = state.soldiers[0];
    applyCommand(state, { tick: 0, side: 'blue', type: 'attack', soldierIds: [0], targetId: 7 });
    moveSoldiers(state, never);
    expect(s.path.length).toBeGreaterThan(0);
    const x = s.x;
    const y = s.y;
    moveSoldiers(state, () => true);
    expect(s.x).toBe(x);
    expect(s.y).toBe(y);
    expect(s.path).toEqual([]);
    expect(s.faceX).toBeGreaterThan(0.9);
    expect(s.faceY).toBeGreaterThan(0);
  });

  it('turns an attack order into hold when the target goes down', () => {
    const state = createBattle({ seed: 1 });
    applyCommand(state, { tick: 0, side: 'blue', type: 'attack', soldierIds: [0], targetId: 5 });
    step(state, []);
    state.soldiers[5].status = 'downed';
    step(state, []);
    expect(state.soldiers[0].order).toEqual({ kind: 'hold' });
    expect(state.soldiers[0].path).toEqual([]);
  });

  it('skips downed and dead soldiers entirely', () => {
    const state = createBattle({ seed: 1 });
    const downed = state.soldiers[1];
    const dead = state.soldiers[2];
    const walker = state.soldiers[0];
    downed.status = 'downed';
    dead.status = 'dead';
    // Park both bodies on the walker's straight-line route.
    downed.x = walker.x + 32;
    downed.y = walker.y;
    dead.x = walker.x + 64;
    dead.y = walker.y;
    const before = JSON.stringify([downed, dead]);
    applyCommand(state, { tick: 0, side: 'blue', type: 'move', soldierIds: [0], x: walker.x + 96, y: walker.y });
    for (let t = 0; t < Math.ceil(96 / MOVE_SPEED) + 5; t++) {
      step(state, []);
    }
    expect(walker.order).toEqual({ kind: 'hold' });
    expect(walker.x).toBeCloseTo(downed.x + 64, 5);
    expect(JSON.stringify([downed, dead])).toBe(before);
  });

  it('never lets a soldier leave the map rectangle', () => {
    const state = createBattle({ seed: 1 });
    const w = mapWidthUnits(state.map);
    const h = mapHeightUnits(state.map);
    // One soldier placed outside the map, the rest ordered past its edges.
    state.soldiers[0].x = -50;
    state.soldiers[0].y = -50;
    applyCommand(state, { tick: 0, side: 'blue', type: 'move', soldierIds: [1, 2], x: -100, y: 300 });
    applyCommand(state, { tick: 0, side: 'red', type: 'move', soldierIds: [5, 6], x: w + 100, y: h + 100 });
    for (let t = 0; t < 120; t++) {
      step(state, []);
      for (const s of state.soldiers) {
        expect(s.x).toBeGreaterThanOrEqual(SOLDIER_RADIUS);
        expect(s.x).toBeLessThanOrEqual(w - SOLDIER_RADIUS);
        expect(s.y).toBeGreaterThanOrEqual(SOLDIER_RADIUS);
        expect(s.y).toBeLessThanOrEqual(h - SOLDIER_RADIUS);
      }
    }
    expect(state.soldiers[1].order).toEqual({ kind: 'hold' });
  });

  it('pushes a soldier placed inside cover back onto open ground', () => {
    const state = createBattle({ seed: 1 });
    const s = state.soldiers[0];
    const crate = tileCenter(8, 6);
    s.x = crate.x - 10;
    s.y = crate.y + 3;
    step(state, []);
    expect(circleOverlapsCover(state.map, s.x, s.y, SOLDIER_RADIUS)).toBe(false);
    expect(dist2(s.x, s.y, crate.x - 10, crate.y + 3)).toBeLessThan(40 * 40);
  });
});
