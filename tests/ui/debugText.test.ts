import { describe, expect, it } from 'vitest';
import { createBattle, hashState, tileCenter } from '../../src/sim';
import type { BattleState } from '../../src/sim';
import { DEBUG_COLUMNS, formatDebugHeader, formatDebugRows, formatHash, formatOrder, formatSoldierRow } from '../../src/ui/debugText';

function battle(): BattleState {
  const state = createBattle({ seed: 7 });
  state.tick = 95; // 3.17 s
  return state;
}

describe('formatHash', () => {
  it('prints eight lower-case hex digits, zero padded', () => {
    expect(formatHash(0)).toBe('00000000');
    expect(formatHash(0x1a2b3c4d)).toBe('1a2b3c4d');
    expect(formatHash(0xffffffff)).toBe('ffffffff');
  });
});

describe('formatDebugHeader', () => {
  it('shows seed, tick and clock, the pause flag, medic calls per side and the hash', () => {
    const state = battle();
    state.sides.red.medicCalls = 1;
    const lines = formatDebugHeader(state, { seed: 7, paused: true, hash: 0x0badf00d });
    expect(lines).toEqual([
      'seed 7   tick 95   00:03   PAUSED',
      'medic calls   blue 3   red 1',
      'hash 0badf00d',
    ]);
  });
  it('says RUNNING when not paused and adds the winner once set', () => {
    const state = battle();
    state.winner = 'red';
    const lines = formatDebugHeader(state, { seed: 7, paused: false, hash: 1 });
    expect(lines[0]).toBe('seed 7   tick 95   00:03   RUNNING');
    expect(lines[lines.length - 1]).toBe('winner red');
  });
  it('takes the hash the caller computed, so it matches the state hash', () => {
    const state = battle();
    const hash = hashState(state);
    expect(formatDebugHeader(state, { seed: 7, paused: true, hash })[2]).toBe(`hash ${formatHash(hash)}`);
  });
  it('adds the active overrides as JSON after the hash line', () => {
    const state = battle();
    const lines = formatDebugHeader(state, { seed: 7, paused: true, hash: 1, tuning: { overrides: { MOVE_SPEED: 2 }, active: true, error: null } });
    expect(lines).toHaveLength(4);
    expect(lines[3]).toBe('tune {"MOVE_SPEED":2}');
  });
  it('adds the tune error when the parameter was rejected', () => {
    const state = battle();
    const lines = formatDebugHeader(state, { seed: 7, paused: true, hash: 1, tuning: { overrides: {}, active: false, error: 'tune: unknown tunable BOGUS' } });
    expect(lines[3]).toBe('tune error tune: unknown tunable BOGUS');
  });
  it('leaves the header alone with no tuning', () => {
    const state = battle();
    expect(formatDebugHeader(state, { seed: 7, paused: true, hash: 1, tuning: { overrides: {}, active: false, error: null } })).toHaveLength(3);
  });
  it('wraps a long override JSON into lines of at most 72 characters', () => {
    const state = battle();
    const overrides = { WEAPONS: { launcher: { cooldown: 180, damage: 30, spread: 20 }, gunner: { cooldown: 12, damage: 6 }, blaster: { cooldown: 240 } } };
    const lines = formatDebugHeader(state, { seed: 7, paused: true, hash: 1, tuning: { overrides, active: true, error: null } });
    const tune = lines.slice(3);
    expect(tune.length).toBeGreaterThan(1);
    for (const line of tune) {
      expect(line.length).toBeLessThanOrEqual(72);
    }
    expect(tune[0].startsWith('tune ')).toBe(true);
    expect(tune[1].startsWith('     ')).toBe(true);
    expect(tune.map((l, i) => (i === 0 ? l.slice('tune '.length) : l.slice(5))).join('')).toBe(JSON.stringify(overrides));
  });
});

describe('formatOrder', () => {
  it('names hold, move with the destination tile, and attack with the target name', () => {
    const state = battle();
    const s = state.soldiers[0];
    expect(formatOrder(state, s)).toBe('hold');
    const dest = tileCenter(12, 5);
    s.order = { kind: 'move', x: dest.x, y: dest.y };
    expect(formatOrder(state, s)).toBe('move to (12, 5)');
    s.order = { kind: 'attack', targetId: 6 };
    expect(formatOrder(state, s)).toBe(`attack ${state.soldiers[6].name}`);
  });
  it('falls back to the id when the attack target is unknown', () => {
    const state = battle();
    const s = state.soldiers[0];
    s.order = { kind: 'attack', targetId: 42 };
    expect(formatOrder(state, s)).toBe('attack #42');
  });
});

describe('formatSoldierRow', () => {
  it('lists id, name, side, class, rounded HP, status, cooldown, medic mark and order in fixed columns', () => {
    const state = battle();
    const s = state.soldiers[7];
    s.hp = 99.6;
    s.cooldown = 42;
    s.order = { kind: 'attack', targetId: 0 };
    state.medics.push({ side: 'red', targetId: 7, x: 0, y: 0, prevX: 0, prevY: 0 });
    expect(formatSoldierRow(state, s)).toBe(' 7 Otto red  chucker  100 standing  42 +   attack Pip');
  });
  it('shows a downed soldier with zero HP, no medic mark and its order', () => {
    const state = battle();
    const s = state.soldiers[2];
    s.hp = 0;
    s.status = 'downed';
    expect(formatSoldierRow(state, s)).toBe(' 2 Maud blue chucker    0 downed     0     hold');
  });
});

describe('formatDebugRows', () => {
  it('starts with the column header and has one row per soldier in id order', () => {
    const state = battle();
    const rows = formatDebugRows(state);
    expect(rows[0]).toBe(DEBUG_COLUMNS);
    expect(rows).toHaveLength(1 + state.soldiers.length);
    rows.slice(1).forEach((row, i) => {
      expect(row.startsWith(String(i).padStart(2))).toBe(true);
      expect(row).toContain(state.soldiers[i].name);
    });
  });
});

describe('formatDebugHeader, speed', () => {
  it('always shows the speed, and the speed error after it when the parameter was rejected', () => {
    const state = createBattle({ seed: 7 });
    expect(formatDebugHeader(state, { seed: 7, paused: true, hash: 1, speed: { speed: 0.5, error: null } }).slice(3)).toEqual(['speed 0.5x']);
    expect(formatDebugHeader(state, { seed: 7, paused: true, hash: 1, speed: { speed: 1, error: null } }).slice(3)).toEqual(['speed 1x']);
    expect(formatDebugHeader(state, { seed: 7, paused: true, hash: 1, speed: { speed: 0.5, error: 'speed: "2" is not one of 0.5, 0.75, 1' } }).slice(3)).toEqual([
      'speed 0.5x',
      'speed error speed: "2" is not one of 0.5, 0.75, 1',
    ]);
  });
});
