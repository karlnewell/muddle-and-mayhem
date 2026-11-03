/**
 * Text for the debug overlay (issue #7): pure functions from simulation
 * state to lines, so the layout is unit-tested and the drawing code only
 * places strings. Fixed-width columns, meant for a monospace font.
 */
import { formatSpeed } from '../game/speed';
import type { SpeedStatus } from '../game/speed';
import type { TuneStatus } from '../game/tuning';
import { soldierById, worldToTile } from '../sim';
import type { BattleState, Soldier } from '../sim';
import { formatClock } from './text';

export interface DebugHeaderInfo {
  seed: number;
  paused: boolean;
  /** `hashState(state)`, computed by the caller once per frame. */
  hash: number;
  /** The `?tune=` status; absent or inactive with no error adds nothing. */
  tuning?: TuneStatus;
  /** The speed status: always a `speed` line, and the `?speed=` error when there is one. */
  speed?: SpeedStatus;
}

/** Widest line of the overlay; a longer override JSON wraps to this. */
const TUNE_LINE_WIDTH = 72;
const TUNE_PREFIX = 'tune ';
const TUNE_INDENT = ' '.repeat(TUNE_PREFIX.length);

/** `tune <json>` wrapped at TUNE_LINE_WIDTH with indented continuation lines, or `tune error <message>`. */
export function formatTuneLines(tuning: TuneStatus): string[] {
  if (tuning.error !== null) {
    return [`${TUNE_PREFIX}error ${tuning.error}`];
  }
  if (!tuning.active) {
    return [];
  }
  const json = JSON.stringify(tuning.overrides);
  const width = TUNE_LINE_WIDTH - TUNE_PREFIX.length;
  const lines: string[] = [];
  for (let i = 0; i < json.length; i += width) {
    lines.push((i === 0 ? TUNE_PREFIX : TUNE_INDENT) + json.slice(i, i + width));
  }
  return lines;
}

/** Column widths, in characters, shared by the header row and the soldier rows. */
const COL = { id: 2, name: 4, side: 4, cls: 8, hp: 3, status: 8, cooldown: 3, medic: 3 } as const;

function cells(id: string, name: string, side: string, cls: string, hp: string, status: string, cooldown: string, medic: string, order: string): string {
  return [
    id.padStart(COL.id),
    name.padEnd(COL.name),
    side.padEnd(COL.side),
    cls.padEnd(COL.cls),
    hp.padStart(COL.hp),
    status.padEnd(COL.status),
    cooldown.padStart(COL.cooldown),
    medic.padEnd(COL.medic),
    order,
  ].join(' ');
}

export const DEBUG_COLUMNS = cells('ID', 'NAME', 'SIDE', 'CLASS', 'HP', 'STATUS', 'CD', 'MED', 'ORDER');

/** A 32-bit hash as eight lower-case hex digits. */
export function formatHash(hash: number): string {
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/** `hold`, `move to (tx, ty)` or `attack <name>` (`attack #id` when the target is missing). */
export function formatOrder(state: BattleState, s: Soldier): string {
  const order = s.order;
  if (order.kind === 'move') {
    const t = worldToTile(order.x, order.y);
    return `move to (${t.tx}, ${t.ty})`;
  }
  if (order.kind === 'attack') {
    const target = soldierById(state, order.targetId);
    return target === undefined ? `attack #${order.targetId}` : `attack ${target.name}`;
  }
  return 'hold';
}

/** One soldier as a fixed-column row; `+` in the MED column when a medic run is heading for it. */
export function formatSoldierRow(state: BattleState, s: Soldier): string {
  const medic = state.medics.some((m) => m.targetId === s.id) ? '+' : '';
  return cells(
    String(s.id),
    s.name,
    s.side,
    s.cls,
    String(Math.round(s.hp)),
    s.status,
    String(s.cooldown),
    medic,
    formatOrder(state, s),
  );
}

/** `speed 0.5x`, followed by `speed error <message>` when `?speed=` was rejected. */
export function formatSpeedLines(speed: SpeedStatus): string[] {
  const lines = [`speed ${formatSpeed(speed.speed)}`];
  if (speed.error !== null) {
    lines.push(`speed error ${speed.error}`);
  }
  return lines;
}

/** Seed, tick and clock, pause flag, medic calls per side, hash, the tune lines when any, the speed lines, and the winner once set. */
export function formatDebugHeader(state: BattleState, info: DebugHeaderInfo): string[] {
  const lines = [
    `seed ${info.seed}   tick ${state.tick}   ${formatClock(state.tick)}   ${info.paused ? 'PAUSED' : 'RUNNING'}`,
    `medic calls   blue ${state.sides.blue.medicCalls}   red ${state.sides.red.medicCalls}`,
    `hash ${formatHash(info.hash)}`,
  ];
  if (info.tuning !== undefined) {
    lines.push(...formatTuneLines(info.tuning));
  }
  if (info.speed !== undefined) {
    lines.push(...formatSpeedLines(info.speed));
  }
  if (state.winner !== null) {
    lines.push(`winner ${state.winner}`);
  }
  return lines;
}

/** The column header followed by one row per soldier, in id order. */
export function formatDebugRows(state: BattleState): string[] {
  return [DEBUG_COLUMNS, ...state.soldiers.map((s) => formatSoldierRow(state, s))];
}
