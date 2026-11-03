import { describe, expect, it } from 'vitest';
import { createBattle, step } from '../../src/sim/battle';
import { applyCommand } from '../../src/sim/commands';
import { FIRING_MOVE_FRACTION, MOVE_SPEED, SOLDIER_RADIUS, overrideTuning } from '../../src/sim/constants';
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

/** A cooldown no test runs long enough to exhaust. */
const NEVER_FIRES = 1_000_000_000;

/** A 16 by 8 map of open ground with spawns on row 7, blue left and red right. */
function openMap(): TileMap {
  const rows: string[] = [];
  for (let ty = 0; ty < 7; ty++) {
    rows.push('................');
  }
  rows.push('bbbbb......rrrrr');
  return parseMap('Open', rows);
}

/**
 * A 16 by 8 map split by a two-tile-thick wall on rows 2 and 3, pierced by
 * two one-tile corridors at columns 4 and 13; spawns on row 7.
 */
function corridorMap(): TileMap {
  return parseMap('Corridors', [
    '................',
    '................',
    '####.########.##',
    '####.########.##',
    '................',
    '................',
    '................',
    'bbbbb......rrrrr',
  ]);
}

/**
 * Blue 0 standing at `moverTile`, blue 1 holding at `holderTile`, red 9
 * standing muzzled at its spawn so the battle has no winner, everyone else
 * downed. Returns the mover and the holder.
 */
function moverAndHolder(map: TileMap, moverTile: [number, number], holderTile: [number, number]): { state: BattleState; mover: Soldier; holder: Soldier } {
  const state = createBattle({ seed: 1, map });
  isolate(state, [0, 1, 9]);
  state.soldiers[9].cooldown = NEVER_FIRES;
  const mover = state.soldiers[0];
  const holder = state.soldiers[1];
  const m = tileCenter(moverTile[0], moverTile[1]);
  const h = tileCenter(holderTile[0], holderTile[1]);
  mover.x = m.x;
  mover.y = m.y;
  mover.prevX = m.x;
  mover.prevY = m.y;
  holder.x = h.x;
  holder.y = h.y;
  holder.prevX = h.x;
  holder.prevY = h.y;
  return { state, mover, holder };
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

  describe('movers yield to holders', () => {
    it('leaves a holder bit-identical when a mover walks into it, and the mover goes around', () => {
      const { state, mover, holder } = moverAndHolder(openMap(), [4, 1], [4, 3]);
      const hx = holder.x;
      const hy = holder.y;
      const dest = tileCenter(4, 6);
      applyCommand(state, { tick: 0, side: 'blue', type: 'move', soldierIds: [0], x: dest.x, y: dest.y });
      for (let t = 0; t < 200 && mover.order.kind !== 'hold'; t++) {
        step(state, []);
        expect(holder.x).toBe(hx);
        expect(holder.y).toBe(hy);
        expect(holder.order).toEqual({ kind: 'hold' });
        expect(dist(mover, holder)).toBeGreaterThanOrEqual(2 * SOLDIER_RADIUS - 0.01);
      }
      expect(mover.order).toEqual({ kind: 'hold' });
      expect(Math.sqrt(dist2(mover.x, mover.y, dest.x, dest.y))).toBeLessThanOrEqual(2);
    });

    it('routes around a holder blocking a one-tile corridor and arrives without ever overlapping it', () => {
      const map = corridorMap();
      const { state, mover, holder } = moverAndHolder(map, [4, 0], [4, 3]);
      const hx = holder.x;
      const hy = holder.y;
      const dest = tileCenter(4, 5);
      applyCommand(state, { tick: 0, side: 'blue', type: 'move', soldierIds: [0], x: dest.x, y: dest.y });
      // The first plan takes the short way through the blocked corridor.
      expect(mover.path.length).toBeLessThan(8);
      let farthestX = mover.x;
      // Budget: about 25 tiles of detour at MOVE_SPEED, plus the stuck wait.
      const budget = Math.ceil((28 * 32) / MOVE_SPEED);
      for (let t = 0; t < budget && mover.order.kind !== 'hold'; t++) {
        step(state, []);
        farthestX = Math.max(farthestX, mover.x);
        expect(holder.x).toBe(hx);
        expect(holder.y).toBe(hy);
        expect(dist(mover, holder)).toBeGreaterThanOrEqual(2 * SOLDIER_RADIUS - 0.01);
        expect(circleOverlapsCover(map, mover.x, mover.y, SOLDIER_RADIUS)).toBe(false);
      }
      expect(mover.order).toEqual({ kind: 'hold' });
      expect(Math.sqrt(dist2(mover.x, mover.y, dest.x, dest.y))).toBeLessThanOrEqual(2);
      // It went through the other corridor, at column 13.
      expect(farthestX).toBeGreaterThan(tileCenter(12, 0).x);
    });

    it('still splits the push between two movers', () => {
      const { state, mover, holder } = moverAndHolder(openMap(), [4, 1], [4, 5]);
      const other = holder;
      // Send them straight at each other; both move, so both give way.
      applyCommand(state, { tick: 0, side: 'blue', type: 'move', soldierIds: [0], x: other.x, y: other.y });
      applyCommand(state, { tick: 0, side: 'blue', type: 'move', soldierIds: [1], x: mover.x, y: mover.y });
      const startY = mover.y;
      const otherStartY = other.y;
      for (let t = 0; t < 30; t++) {
        step(state, []);
      }
      expect(mover.y).toBeGreaterThan(startY);
      expect(other.y).toBeLessThan(otherStartY);
      expect(dist(mover, other)).toBeGreaterThanOrEqual(2 * SOLDIER_RADIUS - 0.01);
    });
  });
});

describe('FIRING_MOVE_FRACTION', () => {
  /**
   * Blue scorcher 3 on open ground at (64, 64) with a one-waypoint path 100
   * units east; red 9 stands muzzled far away so the battle has no winner.
   */
  function walker(): { state: BattleState; s: Soldier } {
    const state = createBattle({ seed: 1, map: openMap() });
    isolate(state, [3, 9]);
    const far = state.soldiers[9];
    far.x = 480;
    far.y = 230;
    far.prevX = 480;
    far.prevY = 230;
    far.cooldown = NEVER_FIRES;
    const s = state.soldiers[3];
    s.x = 64;
    s.y = 64;
    s.prevX = 64;
    s.prevY = 64;
    s.order = { kind: 'move', x: 164, y: 64 };
    s.path = [{ x: 164, y: 64 }];
    s.lastRepathTick = 0;
    return { state, s };
  }

  it('slows a soldier whose weapon discharged last tick to the fraction of MOVE_SPEED', () => {
    const before = FIRING_MOVE_FRACTION;
    overrideTuning({ FIRING_MOVE_FRACTION: 0.5 });
    try {
      const firing = walker();
      firing.s.firing = true;
      moveSoldiers(firing.state, never);
      expect(firing.s.x).toBeCloseTo(64 + MOVE_SPEED * 0.5, 9);
      const idle = walker();
      idle.s.firing = false;
      moveSoldiers(idle.state, never);
      expect(idle.s.x).toBeCloseTo(64 + MOVE_SPEED, 9);
    } finally {
      overrideTuning({ FIRING_MOVE_FRACTION: before });
    }
  });

  it('is back to full speed the tick after the weapon finds no target', () => {
    const before = FIRING_MOVE_FRACTION;
    overrideTuning({ FIRING_MOVE_FRACTION: 0.5 });
    try {
      const { state, s } = walker();
      s.firing = true;              // as if it burned last tick; nothing is in range now
      step(state, []);
      expect(s.x).toBeCloseTo(64 + MOVE_SPEED * 0.5, 9);
      expect(s.firing).toBe(false); // fireWeapons found no target
      const x1 = s.x;
      step(state, []);
      expect(s.x - x1).toBeCloseTo(MOVE_SPEED, 9);
    } finally {
      overrideTuning({ FIRING_MOVE_FRACTION: before });
    }
  });
});

describe('stand-fast attack order', () => {
  /**
   * Open map, blue 0 (Gunner, range 224) at its spawn, red 9 its ordered
   * target at the far spawn well out of range, every other soldier downed.
   * Red never fires, so nobody goes down unless a test says so.
   */
  function standoff(keep: readonly number[] = [0, 9]): { state: BattleState; s: Soldier } {
    const state = createBattle({ seed: 1, map: openMap() });
    isolate(state, keep);
    for (const id of keep) {
      if (state.soldiers[id].side === 'red') {
        state.soldiers[id].cooldown = NEVER_FIRES;
      }
    }
    return { state, s: state.soldiers[0] };
  }

  it('never moves toward an out-of-range target and fires at an enemy it can reach', () => {
    const { state, s } = standoff([0, 5, 9]);
    const near = state.soldiers[5];
    near.x = s.x + 100;
    near.y = s.y;
    applyCommand(state, { tick: 0, side: 'blue', type: 'attack', soldierIds: [0], targetId: 9, stand: true });
    const x = s.x;
    const y = s.y;
    const firedAt = new Set<number>();
    for (let t = 0; t < 200; t++) {
      step(state, []);
      expect(s.x).toBe(x);
      expect(s.y).toBe(y);
      expect(s.path).toEqual([]);
      if (s.targetId !== null) {
        firedAt.add(s.targetId);
      }
    }
    expect(firedAt).toEqual(new Set([5]));
    expect(s.order).toEqual({ kind: 'attack', targetId: 9, stand: true });
  });

  it('clears a path it already had', () => {
    const { state, s } = standoff();
    applyCommand(state, { tick: 0, side: 'blue', type: 'move', soldierIds: [0], x: s.x + 200, y: s.y });
    step(state, []);
    expect(s.path.length).toBeGreaterThan(0);
    applyCommand(state, { tick: 1, side: 'blue', type: 'attack', soldierIds: [0], targetId: 9, stand: true });
    expect(s.path).toEqual([]);
    const x = s.x;
    step(state, []);
    expect(s.x).toBe(x);
  });

  it('shoots the ordered target once it walks into range', () => {
    const { state, s } = standoff();
    applyCommand(state, { tick: 0, side: 'blue', type: 'attack', soldierIds: [0], targetId: 9, stand: true });
    applyCommand(state, { tick: 0, side: 'red', type: 'move', soldierIds: [9], x: s.x + 120, y: s.y });
    const x = s.x;
    let shotAt9 = false;
    for (let t = 0; t < 400 && !shotAt9; t++) {
      step(state, []);
      expect(s.x).toBe(x);
      shotAt9 = s.targetId === 9;
    }
    expect(shotAt9).toBe(true);
  });

  it('turns into hold when the target goes down', () => {
    const { state, s } = standoff();
    applyCommand(state, { tick: 0, side: 'blue', type: 'attack', soldierIds: [0], targetId: 9, stand: true });
    step(state, []);
    state.soldiers[9].status = 'downed';
    step(state, []);
    expect(s.order).toEqual({ kind: 'hold' });
    expect(s.path).toEqual([]);
  });

  it('leaves the ordinary attack order walking in', () => {
    const { state, s } = standoff();
    applyCommand(state, { tick: 0, side: 'blue', type: 'attack', soldierIds: [0], targetId: 9 });
    const x = s.x;
    for (let t = 0; t < 20; t++) {
      step(state, []);
    }
    expect(s.x).toBeGreaterThan(x);
    expect(s.order).toEqual({ kind: 'attack', targetId: 9 });
  });
});
