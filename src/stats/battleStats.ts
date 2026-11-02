/**
 * Battle statistics: per side and class, built by watching the state after
 * every stepped tick. The collector reads `state.events` and
 * `state.soldiers` and writes only to its own object; it never touches the
 * simulation. The session feeds it in play and `npm run measure` feeds it
 * headless, so the browser report and the script print the same numbers
 * from the same code. Depends on `src/sim` types and constants only.
 *
 * Definitions (see docs/decisions.md): a shot is a `shot` event, or for the
 * Scorcher a tick with the cone active; a hit is a tick on which a soldier's
 * weapon damaged at least one enemy, so splash catching two is one hit;
 * damage is the amount the event asked for, overkill included; downs
 * inflicted count enemies only; seconds downed count ticks with status
 * `downed`, so the dead add nothing; medic calls are counted against the
 * class they were spent on.
 */
import { CLASS_ORDER, soldierById } from '../sim';
import type { BattleState, Side, Soldier, SoldierClass, TuningOverrides } from '../sim';

export interface ClassStats {
  shots: number;
  hits: number;
  damageDealt: number;
  damageTaken: number;
  downsInflicted: number;
  timesDowned: number;
  instantKills: number;
  downedTicks: number;
  medicCalls: number;
}

export interface BattleStats {
  seed: number;
  overrides: TuningOverrides;
  ticks: number;
  winner: Side | 'draw' | null;
  /** The tick of the first damage event, or null before any. */
  firstContactTick: number | null;
  sides: Record<Side, Record<SoldierClass, ClassStats>>;
}

export interface StatsCollector {
  /** Call after every `step`, with that tick's events still on the state. */
  observe(state: BattleState): void;
  /** The statistics so far; the same object every call, so read it, do not keep it. */
  stats(): BattleStats;
}

export function emptyClassStats(): ClassStats {
  return { shots: 0, hits: 0, damageDealt: 0, damageTaken: 0, downsInflicted: 0, timesDowned: 0, instantKills: 0, downedTicks: 0, medicCalls: 0 };
}

function emptySide(): Record<SoldierClass, ClassStats> {
  const out = {} as Record<SoldierClass, ClassStats>;
  for (const cls of CLASS_ORDER) {
    out[cls] = emptyClassStats();
  }
  return out;
}

export function addClassStats(into: ClassStats, from: ClassStats): void {
  into.shots += from.shots;
  into.hits += from.hits;
  into.damageDealt += from.damageDealt;
  into.damageTaken += from.damageTaken;
  into.downsInflicted += from.downsInflicted;
  into.timesDowned += from.timesDowned;
  into.instantKills += from.instantKills;
  into.downedTicks += from.downedTicks;
  into.medicCalls += from.medicCalls;
}

/** The five classes of one side summed. */
export function sideTotals(stats: BattleStats, side: Side): ClassStats {
  const total = emptyClassStats();
  for (const cls of CLASS_ORDER) {
    addClassStats(total, stats.sides[side][cls]);
  }
  return total;
}

/** Hits over shots, or null when nothing was fired. */
export function hitRate(c: ClassStats): number | null {
  return c.shots === 0 ? null : c.hits / c.shots;
}

export function createStatsCollector(seed: number, overrides: TuningOverrides): StatsCollector {
  const stats: BattleStats = {
    seed,
    overrides,
    ticks: 0,
    winner: null,
    firstContactTick: null,
    sides: { blue: emptySide(), red: emptySide() },
  };

  const cell = (s: Soldier): ClassStats => stats.sides[s.side][s.cls];

  function observe(state: BattleState): void {
    const tick = state.tick - 1;
    stats.ticks = state.tick;
    stats.winner = state.winner;
    // Scorchers whose cone was active this tick, counted as shots. One downed by another flame on the
    // same tick has firing cleared already, so it is counted below when its damage shows up instead.
    const burning = new Set<number>();
    for (const s of state.soldiers) {
      if (s.status === 'downed') {
        cell(s).downedTicks++;
      } else if (s.cls === 'scorcher' && s.status === 'standing' && s.firing) {
        cell(s).shots++;
        burning.add(s.id);
      }
    }
    // The source of the last damage each victim took this tick, so a down that follows is credited to it.
    const lastSource = new Map<number, Soldier>();
    const hitEnemy = new Set<number>();
    for (const e of state.events) {
      if (e.kind === 'shot') {
        const shooter = soldierById(state, e.soldierId);
        if (shooter !== undefined) {
          cell(shooter).shots++;
        }
      } else if (e.kind === 'damage') {
        if (stats.firstContactTick === null) {
          stats.firstContactTick = tick;
        }
        const source = soldierById(state, e.sourceId);
        const victim = soldierById(state, e.soldierId);
        if (victim !== undefined) {
          cell(victim).damageTaken += e.amount;
        }
        if (source !== undefined) {
          if (source.cls === 'scorcher' && !burning.has(source.id)) {
            cell(source).shots++;
            burning.add(source.id);
          }
          cell(source).damageDealt += e.amount;
          if (victim !== undefined) {
            lastSource.set(victim.id, source);
            if (victim.side !== source.side) {
              hitEnemy.add(source.id);
            }
          }
        }
      } else if (e.kind === 'downed' || e.kind === 'killed') {
        const victim = soldierById(state, e.soldierId);
        if (victim === undefined) {
          continue;
        }
        cell(victim).timesDowned++;
        const source = lastSource.get(victim.id);
        if (source !== undefined && source.side !== victim.side) {
          cell(source).downsInflicted++;
          if (e.kind === 'killed') {
            cell(source).instantKills++;
          }
        }
      } else if (e.kind === 'medic') {
        const target = soldierById(state, e.targetId);
        if (target !== undefined) {
          cell(target).medicCalls++;
        }
      }
    }
    for (const id of hitEnemy) {
      const shooter = soldierById(state, id);
      if (shooter !== undefined) {
        cell(shooter).hits++;
      }
    }
  }

  return { observe, stats: () => stats };
}
