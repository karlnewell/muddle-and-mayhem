import { describe, expect, it } from 'vitest';
import { createAi } from '../../src/sim/ai';
import { besideCover, isCover } from '../../src/sim/aiPositions';
import { createBattle, step } from '../../src/sim/battle';
import {
  AI_LOBBER_WAIT, AI_MEDIC_DESPERATE_STANDING, AI_MEDIC_PATIENCE_TICKS, AI_SCORCHER_WAIT, AI_SEED_SALT, AI_THINK_TICKS, MEDIC_CALLS,
  overrideTuning,
} from '../../src/sim/constants';
import { runBattle } from '../../src/sim/headless';
import { parseMap, worldToTile } from '../../src/sim/map';
import { createRng } from '../../src/sim/rng';
import type { BattleState, Command, Soldier, TileMap } from '../../src/sim/types';
import { dist2 } from '../../src/sim/vec';

const RED_IDS = [5, 6, 7, 8, 9];
const CLASS_COUNT = 5;

/**
 * A 30 by 10 arena: a wall down column 15 from row 0 to row 6 (x in [480, 512),
 * y below 224), open lanes on rows 7 and 8, spawns on row 9.
 */
function arena(): TileMap {
  const rows: string[] = [];
  for (let ty = 0; ty < 7; ty++) {
    rows.push('...............#..............');
  }
  rows.push('..............................');
  rows.push('..............................');
  rows.push('bbbbb...............rrrrr.....');
  return parseMap('Arena', rows);
}

/** Every soldier except `keep` is downed so it plays no part. */
function isolate(state: BattleState, keep: readonly number[]): void {
  for (const s of state.soldiers) {
    if (!keep.includes(s.id)) {
      s.status = 'downed';
      s.hp = 0;
    }
  }
}

/**
 * A 30 by 10 open field with one crate at tile (12, 4) and spawns on row 9.
 * From a target at tile (5, 4) the crate's west neighbour (11, 4) is the only
 * tile beside cover within a gunner's reach, so it wins the position search
 * regardless of jitter.
 */
function field(): TileMap {
  const rows: string[] = [];
  for (let ty = 0; ty < 9; ty++) {
    rows.push(ty === 4 ? '............c.................' : '..............................');
  }
  rows.push('bbbbb...............rrrrr.....');
  return parseMap('Field', rows);
}

/** Down soldier `id` as the sim would at the current tick. */
function down(state: BattleState, id: number): Soldier {
  const s = state.soldiers[id];
  s.status = 'downed';
  s.hp = 0;
  s.downedTick = state.tick;
  return s;
}

function place(s: Soldier, x: number, y: number): void {
  s.x = x;
  s.y = y;
  s.prevX = x;
  s.prevY = y;
}

/** Commands that name soldier `id` in their soldierIds. */
function forSoldier(commands: readonly Command[], id: number): Command[] {
  return commands.filter((c) => c.type !== 'medic' && c.soldierIds.includes(id));
}

/** Step `ticks` times, feeding `first` on the first tick only. */
function advance(state: BattleState, first: readonly Command[], ticks: number): void {
  step(state, first);
  for (let i = 1; i < ticks; i++) {
    step(state, []);
  }
}

describe('createAi', () => {
  it('exposes its side', () => {
    expect(createAi('red', 1).side).toBe('red');
    expect(createAi('blue', 1).side).toBe('blue');
  });

  it('returns no commands on a tick that is not a think tick', () => {
    const state = createBattle({ seed: 1 });
    const ai = createAi('red', 1);
    for (let tick = 1; tick < AI_THINK_TICKS; tick++) {
      state.tick = tick;
      expect(ai.think(state)).toEqual([]);
    }
  });

  it('returns no commands once the battle is decided', () => {
    const state = createBattle({ seed: 1 });
    state.winner = 'blue';
    expect(createAi('red', 1).think(state)).toEqual([]);
  });

  it('orders every standing red soldier on tick 0 of a fresh battle, except the lobbers while they wait for contact', () => {
    const state = createBattle({ seed: 1 });
    const commands = createAi('red', 1).think(state);
    for (const id of RED_IDS) {
      const waits = (id === 7 || id === 9) && AI_LOBBER_WAIT !== 0;
      expect(forSoldier(commands, id).length).toBe(waits ? 0 : 1);
    }
    for (const c of commands) {
      expect(c.side).toBe('red');
      expect(c.tick).toBe(0);
      if (c.type === 'medic') {
        expect(RED_IDS).toContain(c.targetId);
      } else {
        for (const id of c.soldierIds) {
          expect(RED_IDS).toContain(id);
        }
      }
    }
  });

  it('is a pure function of seed and state', () => {
    const a = createAi('red', 9).think(createBattle({ seed: 3 }));
    const b = createAi('red', 9).think(createBattle({ seed: 3 }));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.length).toBeGreaterThan(0);
  });

  it('does not repeat an attack order the soldier already holds', () => {
    const state = createBattle({ seed: 1 });
    isolate(state, [0, 8]); // blue gunner, red scorcher
    state.sides.red.medicCalls = 0;
    const ai = createAi('red', 1);
    const first = ai.think(state);
    const scorcher = forSoldier(first, 8);
    expect(scorcher).toHaveLength(1);
    expect(scorcher[0].type).toBe('attack');
    advance(state, first, AI_THINK_TICKS);
    expect(state.tick).toBe(AI_THINK_TICKS);
    expect(state.soldiers[8].order).toEqual({ kind: 'attack', targetId: 0 });
    expect(forSoldier(ai.think(state), 8)).toEqual([]);
  });

  it('calls the medic at once for a downed friendly whose body is safe', () => {
    const state = createBattle({ seed: 1 });
    down(state, 5);
    const commands = createAi('red', 1).think(state);
    const medic = commands.filter((c) => c.type === 'medic');
    expect(medic).toHaveLength(1);
    expect(medic[0]).toEqual({ tick: 0, side: 'red', type: 'medic', targetId: 5 });
  });

  it('waits while an enemy covers a fresh body and the squad is still strong', () => {
    const state = createBattle({ seed: 1 });
    const gunner = down(state, 5);
    place(state.soldiers[0], gunner.x - 50, gunner.y); // blue gunner, range 224
    const commands = createAi('red', 1).think(state);
    expect(commands.filter((c) => c.type === 'medic')).toEqual([]);
  });

  it('calls for a covered body once it has lain there for AI_MEDIC_PATIENCE_TICKS', () => {
    const state = createBattle({ seed: 1 });
    const gunner = down(state, 5);
    place(state.soldiers[0], gunner.x - 50, gunner.y);
    const ai = createAi('red', 1);
    let calledAt: number | null = null;
    for (let tick = 0; tick <= AI_MEDIC_PATIENCE_TICKS + AI_THINK_TICKS && calledAt === null; tick += AI_THINK_TICKS) {
      state.tick = tick;
      if (ai.think(state).some((c) => c.type === 'medic' && c.targetId === 5)) {
        calledAt = tick;
      }
    }
    expect(calledAt).not.toBeNull();
    expect(calledAt as number).toBeGreaterThanOrEqual(AI_MEDIC_PATIENCE_TICKS);
    expect(calledAt as number).toBeLessThan(AI_MEDIC_PATIENCE_TICKS + AI_THINK_TICKS);
  });

  it('calls at once for a covered body when fewer than AI_MEDIC_DESPERATE_STANDING are standing', () => {
    const state = createBattle({ seed: 1 });
    const gunner = down(state, 5);
    place(state.soldiers[0], gunner.x - 50, gunner.y);
    for (let id = 6; id < 5 + CLASS_COUNT - AI_MEDIC_DESPERATE_STANDING + 2; id++) {
      down(state, id);
    }
    const standing = state.soldiers.filter((s) => s.side === 'red' && s.status === 'standing').length;
    expect(standing).toBeLessThan(AI_MEDIC_DESPERATE_STANDING);
    const medic = createAi('red', 1).think(state).filter((c) => c.type === 'medic');
    expect(medic).toHaveLength(1);
    expect(medic[0]).toMatchObject({ type: 'medic', targetId: 6 }); // launcher first by revive priority
  });

  it('does not call the medic for a body a run is already heading for', () => {
    const state = createBattle({ seed: 1 });
    const gunner = down(state, 5);
    state.medics.push({ side: 'red', targetId: 5, x: 1280, y: gunner.y, prevX: 1280, prevY: gunner.y });
    const commands = createAi('red', 1).think(state);
    expect(commands.filter((c) => c.type === 'medic')).toEqual([]);
  });

  it('spends medic calls in an ordinary battle against itself', () => {
    for (const seed of [1, 7, 42]) {
      const run = runBattle({ seed, maxTicks: 30 * 600, controllers: [createAi('blue', seed), createAi('red', seed)] });
      expect(run.state.winner).not.toBeNull();
      const loser = run.state.winner === 'blue' ? 'red' : 'blue';
      expect(run.state.sides[loser].medicCalls).toBeLessThan(MEDIC_CALLS);
    }
  });

  it('does not call the medic without calls left', () => {
    const state = createBattle({ seed: 1 });
    state.soldiers[5].status = 'downed';
    state.sides.red.medicCalls = 0;
    const commands = createAi('red', 1).think(state);
    expect(commands.filter((c) => c.type === 'medic')).toEqual([]);
  });

  it('charges with a scorcher that is far from every enemy', () => {
    const state = createBattle({ seed: 1 });
    const commands = forSoldier(createAi('red', 1).think(state), 8);
    expect(commands).toHaveLength(1);
    const c = commands[0];
    expect(c.type).toBe('attack');
    if (c.type === 'attack') {
      expect([0, 1, 2, 3, 4]).toContain(c.targetId);
    }
  });

  it('backs a launcher away from an enemy it cannot fire at', () => {
    const state = createBattle({ seed: 1, map: arena() });
    isolate(state, [0, 6]); // blue gunner, red launcher
    const enemy = state.soldiers[0];
    const launcher = state.soldiers[6];
    place(enemy, 470, 100); // tile (14, 3), left of the wall
    place(launcher, 520, 100); // tile (16, 3), right of the wall, 50 units away
    const commands = forSoldier(createAi('red', 1).think(state), 6);
    expect(commands).toHaveLength(1);
    const c = commands[0];
    expect(['move', 'attack']).toContain(c.type);
    if (c.type === 'move') {
      const now = dist2(launcher.x, launcher.y, enemy.x, enemy.y);
      expect(dist2(c.x, c.y, enemy.x, enemy.y)).toBeGreaterThan(now);
    }
  });

  it('lobbers prefer a target sheltering behind cover over a nearer visible one', () => {
    const state = createBattle({ seed: 1, map: arena() });
    isolate(state, [0, 1, 7]); // blue gunner, blue launcher, red chucker
    place(state.soldiers[7], 560, 100); // tile (17, 3), right of the wall
    place(state.soldiers[0], 600, 100); // 40 units away, in plain sight
    place(state.soldiers[1], 440, 100); // 120 units away, behind the wall
    const commands = forSoldier(createAi('red', 1).think(state), 7);
    expect(commands).toHaveLength(1);
    expect(commands[0]).toEqual({ tick: 0, side: 'red', type: 'attack', soldierIds: [7], targetId: 1 });
  });

  it('does not repeat a move order to the tile the soldier is already heading for', () => {
    const state = createBattle({ seed: 1, map: field() });
    isolate(state, [0, 5]); // blue gunner, red gunner
    place(state.soldiers[0], 176, 144); // tile (5, 4)
    place(state.soldiers[5], 900, 144); // tile (28, 4), far out of range
    const ai = createAi('red', 1);
    const first = ai.think(state);
    const gunner = forSoldier(first, 5);
    expect(gunner).toHaveLength(1);
    expect(gunner[0]).toEqual({ tick: 0, side: 'red', type: 'move', soldierIds: [5], x: 368, y: 144 });
    advance(state, first, AI_THINK_TICKS);
    expect(state.soldiers[5].order).toEqual({ kind: 'move', x: 368, y: 144 });
    expect(forSoldier(ai.think(state), 5)).toEqual([]);
  });

  it('keeps clear of a friendly when choosing a firing tile', () => {
    const state = createBattle({ seed: 1, map: field() });
    isolate(state, [0, 5, 6]); // blue gunner, red gunner, red launcher
    place(state.soldiers[0], 176, 144); // tile (5, 4)
    place(state.soldiers[5], 900, 144); // tile (28, 4), far out of range
    place(state.soldiers[6], 368, 112); // tile (11, 3), beside the crate's best tile (11, 4)
    state.soldiers[6].cooldown = 1_000_000_000;
    const gunner = forSoldier(createAi('red', 1).think(state), 5);
    expect(gunner).toHaveLength(1);
    const c = gunner[0];
    expect(c.type).toBe('move');
    if (c.type === 'move') {
      const chosen = worldToTile(c.x, c.y);
      expect(Math.max(Math.abs(chosen.tx - 11), Math.abs(chosen.ty - 3))).toBeGreaterThan(1);
    }
  });

  it('counts only real cover tiles as cover, never the map border', () => {
    const map = arena();
    expect(isCover(map, 15, 3)).toBe(true);
    expect(isCover(map, 14, 3)).toBe(false);
    expect(isCover(map, -1, 3)).toBe(false);
    expect(isCover(map, 0, -1)).toBe(false);
    expect(isCover(map, map.width, 0)).toBe(false);
    expect(besideCover(map, 14, 3)).toBe(true); // wall to the east
    expect(besideCover(map, 15, 7)).toBe(true); // wall to the north
    expect(besideCover(map, 0, 0)).toBe(false); // corner, no cover beside it
    expect(besideCover(map, 29, 9)).toBe(false);
    expect(besideCover(map, 5, 5)).toBe(false);
  });

  it('salts the seed per side so the two sides draw different streams', () => {
    for (const seed of [0, 1, 42, 2026]) {
      const blueSeed = (seed ^ AI_SEED_SALT.blue) >>> 0;
      const redSeed = (seed ^ AI_SEED_SALT.red) >>> 0;
      expect(blueSeed).not.toBe(redSeed);
      expect(createRng(blueSeed).next()).not.toBe(createRng(redSeed).next());
    }
  });
});

describe('waiting for contact', () => {
  /** Run `fn` with the two wait flags set, then restore the shipped values. */
  function withWait(lobber: number, scorcher: number, fn: () => void): void {
    overrideTuning({ AI_LOBBER_WAIT: lobber, AI_SCORCHER_WAIT: scorcher });
    try {
      fn();
    } finally {
      overrideTuning({ AI_LOBBER_WAIT, AI_SCORCHER_WAIT });
    }
  }

  it('with both flags off, every red soldier gets an order at tick 0', () => {
    withWait(0, 0, () => {
      const commands = createAi('red', 1).think(createBattle({ seed: 1 }));
      for (const id of RED_IDS) {
        expect(forSoldier(commands, id)).toHaveLength(1);
      }
    });
  });

  it('with AI_LOBBER_WAIT on, the lobbers get no order while no friendly direct weapon has an enemy in range', () => {
    withWait(1, 0, () => {
      const commands = createAi('red', 1).think(createBattle({ seed: 1 }));
      expect(forSoldier(commands, 7)).toEqual([]);   // chucker
      expect(forSoldier(commands, 9)).toEqual([]);   // blaster
      expect(forSoldier(commands, 5)).toHaveLength(1); // gunner advances
      expect(forSoldier(commands, 6)).toHaveLength(1); // launcher advances
      expect(forSoldier(commands, 8)).toHaveLength(1); // scorcher charges
    });
  });

  it('with AI_SCORCHER_WAIT on as well, the scorcher waits too', () => {
    withWait(1, 1, () => {
      const commands = createAi('red', 1).think(createBattle({ seed: 1 }));
      expect(forSoldier(commands, 8)).toEqual([]);
      expect(forSoldier(commands, 5)).toHaveLength(1);
    });
  });

  it('releases the waiters once a friendly gunner has an enemy within its weapon range', () => {
    withWait(1, 1, () => {
      const state = createBattle({ seed: 1 });
      const gunner = state.soldiers[5];
      place(state.soldiers[0], gunner.x - 200, gunner.y);   // inside the gunner's 224 range
      const commands = createAi('red', 1).think(state);
      for (const id of [7, 8, 9]) {
        expect(forSoldier(commands, id)).toHaveLength(1);
      }
    });
  });

  it('releases the waiters when no direct-fire friendly is standing', () => {
    withWait(1, 1, () => {
      const state = createBattle({ seed: 1 });
      down(state, 5);
      down(state, 6);
      const commands = createAi('red', 1).think(state);
      for (const id of [7, 8, 9]) {
        expect(forSoldier(commands, id)).toHaveLength(1);
      }
    });
  });

  it('orders a waiting lobber that still carries an attack order to hold', () => {
    withWait(1, 0, () => {
      const state = createBattle({ seed: 1 });
      state.soldiers[7].order = { kind: 'attack', targetId: 0 };
      const commands = createAi('red', 1).think(state);
      expect(forSoldier(commands, 7)).toEqual([{ tick: 0, side: 'red', type: 'hold', soldierIds: [7] }]);
    });
  });

  it('stays deterministic with the flags on', () => {
    withWait(1, 1, () => {
      const run = (): ReturnType<typeof runBattle> =>
        runBattle({ seed: 11, maxTicks: 18000, controllers: [createAi('blue', 11), createAi('red', 11)] });
      const a = run();
      const b = run();
      expect(a.state.winner).not.toBeNull();
      expect(a.log).toEqual(b.log);
    });
  });
});
