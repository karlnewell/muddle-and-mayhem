import { describe, expect, it } from 'vitest';
import { HOLD_POSTS, createHoldLine, focusTarget, holdTiles } from '../../scripts/holdline.mts';
import {
  AI_THINK_TICKS, CLASS_ORDER, CROSSROADS, MAPS, MAP_IDS, parseMap, createAi, createBattle, hashState, isBlocked, replayBattle, runBattle, step, tileCenter,
} from '../../src/sim';
import type { BattleState, Command, Soldier } from '../../src/sim';

function down(state: BattleState, id: number): void {
  const s = state.soldiers[id];
  s.status = 'downed';
  s.hp = 0;
  s.downedTick = state.tick;
}

function place(s: Soldier, x: number, y: number): void {
  s.x = x;
  s.y = y;
  s.prevX = x;
  s.prevY = y;
}

/** Every blue soldier standing on its post. */
function atPosts(state: BattleState): void {
  for (const s of state.soldiers) {
    if (s.side === 'blue') {
      const c = tileCenter(HOLD_TILES[s.cls].tx, HOLD_TILES[s.cls].ty);
      place(s, c.x, c.y);
    }
  }
}

/** The Crossroads posts, which every test below that does not name a map uses. */
const HOLD_TILES = HOLD_POSTS.crossroads;

const blueOf = (log: readonly Command[]): Command[] => log.filter((c) => c.side === 'blue');

describe('HOLD_POSTS', () => {
  it('are five distinct open tiles on every map', () => {
    for (const id of MAP_IDS) {
      const seen = new Set<string>();
      for (const cls of CLASS_ORDER) {
        const t = HOLD_POSTS[id][cls];
        expect(isBlocked(MAPS[id], t.tx, t.ty)).toBe(false);
        seen.add(`${t.tx},${t.ty}`);
      }
      expect(seen.size).toBe(CLASS_ORDER.length);
    }
  });

  it('sit west of the left wall arms on Crossroads', () => {
    for (const cls of CLASS_ORDER) {
      expect(HOLD_POSTS.crossroads[cls].tx).toBeLessThanOrEqual(11);
    }
  });

  it('sit at the left road mouth on Compact Crossroads, no further east than the wall arms begin', () => {
    for (const cls of CLASS_ORDER) {
      const t = HOLD_POSTS.compact[cls];
      expect(t.tx).toBeLessThanOrEqual(7);
      expect(t.ty).toBeGreaterThanOrEqual(3);
      expect(t.ty).toBeLessThanOrEqual(11);
    }
  });

  it('are looked up by map, and a map without posts throws', () => {
    expect(holdTiles(MAPS.compact)).toBe(HOLD_POSTS.compact);
    expect(holdTiles(CROSSROADS)).toBe(HOLD_POSTS.crossroads);
    const other = parseMap('Other', ['b.r', 'b.r', 'b.r', 'b.r', 'b.r']);
    expect(() => holdTiles(other)).toThrow(/no hold-line posts/);
  });
});

describe('createHoldLine on Compact Crossroads', () => {
  it('opens by sending every soldier to its compact post', () => {
    const state = createBattle({ seed: 1, map: MAPS.compact });
    const commands = createHoldLine('blue').think(state);
    expect(commands).toHaveLength(5);
    for (const s of state.soldiers.filter((x) => x.side === 'blue')) {
      const c = tileCenter(HOLD_POSTS.compact[s.cls].tx, HOLD_POSTS.compact[s.cls].ty);
      expect(commands).toContainEqual({ tick: 0, side: 'blue', type: 'move', soldierIds: [s.id], x: c.x, y: c.y });
    }
  });

  it('replays bit for bit with the map given', () => {
    const run = runBattle({ seed: 7, maxTicks: 18000, map: MAPS.compact, controllers: [createHoldLine('blue'), createAi('red', 7)] });
    expect(run.state.winner).not.toBeNull();
    expect(hashState(replayBattle(7, run.log, run.ticks, MAPS.compact))).toBe(hashState(run.state));
  });
});

describe('createHoldLine', () => {
  it('opens by sending every soldier to its post', () => {
    const state = createBattle({ seed: 1, map: CROSSROADS });
    const commands = createHoldLine('blue').think(state);
    expect(commands).toHaveLength(5);
    for (const s of state.soldiers.filter((x) => x.side === 'blue')) {
      const c = tileCenter(HOLD_TILES[s.cls].tx, HOLD_TILES[s.cls].ty);
      expect(commands).toContainEqual({ tick: 0, side: 'blue', type: 'move', soldierIds: [s.id], x: c.x, y: c.y });
    }
  });

  it('is deterministic and replays bit for bit', () => {
    const run = (): ReturnType<typeof runBattle> =>
      runBattle({ seed: 7, maxTicks: 18000, map: CROSSROADS, controllers: [createHoldLine('blue'), createAi('red', 7)] });
    const a = run();
    const b = run();
    expect(a.state.winner).not.toBeNull();
    expect(hashState(a.state)).toBe(hashState(b.state));
    expect(a.log).toEqual(b.log);
    expect(hashState(replayBattle(7, a.log, a.ticks, CROSSROADS))).toBe(hashState(a.state));
    expect(blueOf(a.log).length).toBeLessThan(a.ticks / AI_THINK_TICKS);
  });

  it('issues nothing after the opening moves while the enemy stays out of reach', () => {
    // Red stands at its spawns and gets no orders: too far for anyone to fire, so blue walks to its posts and waits.
    const state = createBattle({ seed: 1, map: CROSSROADS });
    const blue = createHoldLine('blue');
    const log: Command[] = [];
    for (let i = 0; i < 600; i++) {
      const commands = blue.think(state);
      log.push(...commands);
      step(state, commands);
    }
    expect(log).toHaveLength(5);
    expect(log.every((c) => c.type === 'move' && c.tick === 0)).toBe(true);
  });

  it('calls the medic for a body no enemy has in range, by revive priority', () => {
    const state = createBattle({ seed: 1, map: CROSSROADS });
    down(state, 0);
    down(state, 1);
    const commands = createHoldLine('blue').think(state);
    const medics = commands.filter((c) => c.type === 'medic');
    expect(medics).toEqual([{ tick: 0, side: 'blue', type: 'medic', targetId: 1 }]);
  });

  it('leaves a body alone while an enemy has it in range, unless only one soldier stands', () => {
    const state = createBattle({ seed: 1, map: CROSSROADS });
    down(state, 1);
    const body = state.soldiers[1];
    place(state.soldiers[5], body.x + 100, body.y);
    expect(createHoldLine('blue').think(state).some((c) => c.type === 'medic')).toBe(false);
    down(state, 0);
    down(state, 2);
    down(state, 3);
    const desperate = createHoldLine('blue').think(state).filter((c) => c.type === 'medic');
    expect(desperate).toHaveLength(1);
  });

  it('focuses fire on the enemy a majority can fire at and leaves the rest holding', () => {
    const state = createBattle({ seed: 1, map: CROSSROADS });
    atPosts(state);
    // One red soldier just inside the road mouth; the other four stay at their spawns, out of everyone's range,
    // so blue does not outnumber red and the hold rules apply. From the posts, the Launcher sees it down the
    // road, the Chucker lobs over the arm and the Scorcher has it in flame range; the Gunner's line of sight
    // clips the arm's corner and the Blaster is out of range, so three of five fire: a majority.
    const enemy = state.soldiers[5];
    const c = tileCenter(13, 10);
    place(enemy, c.x, c.y);
    const own = state.soldiers.filter((s) => s.side === 'blue');
    const enemies = state.soldiers.filter((s) => s.side === 'red');
    expect(focusTarget(state, own, enemies)).toBe(enemy);
    const commands = createHoldLine('blue').think(state);
    const attacks = commands.filter((x) => x.type === 'attack');
    expect(attacks.map((x) => (x.type === 'attack' ? x.soldierIds[0] : -1)).sort()).toEqual([1, 2, 3]);
    expect(attacks.every((x) => x.type === 'attack' && x.targetId === 5)).toBe(true);
    for (const id of [0, 4]) {
      expect(commands.some((x) => 'soldierIds' in x && x.soldierIds.includes(id) && x.type !== 'hold')).toBe(false);
    }
  });

  it('has no focus when fewer than a majority can fire', () => {
    const state = createBattle({ seed: 1, map: CROSSROADS });
    atPosts(state);
    const enemy = state.soldiers[5]; // at its spawn, far to the east
    const own = state.soldiers.filter((s) => s.side === 'blue');
    expect(focusTarget(state, own, [enemy])).toBeNull();
  });

  it('advances on the nearest enemy with every soldier once it outnumbers the enemy', () => {
    const state = createBattle({ seed: 1, map: CROSSROADS });
    atPosts(state);
    for (let id = 7; id < 10; id++) down(state, id);
    const commands = createHoldLine('blue').think(state);
    const attacks = commands.filter((x) => x.type === 'attack');
    expect(attacks).toHaveLength(5);
    expect(new Set(attacks.map((x) => (x.type === 'attack' ? x.targetId : -1))).size).toBe(1);
  });

  it('does not repeat an order a soldier already holds', () => {
    const state = createBattle({ seed: 1, map: CROSSROADS });
    atPosts(state);
    for (let id = 7; id < 10; id++) down(state, id);
    const blue = createHoldLine('blue');
    const first = blue.think(state);
    step(state, first);
    state.tick = AI_THINK_TICKS;
    expect(blue.think(state)).toEqual([]);
  });
});
