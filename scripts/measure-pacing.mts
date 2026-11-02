/**
 * Pacing measurement: runs the real simulation (src/sim) over many seeds and
 * prints the numbers a tuning change is judged by: battle length, tick of
 * first damage, downs and medic calls per side, red move commands per
 * battle (how often the red AI re-sites) and how many of those land more
 * than eight tiles from the soldier's previous move, winner split, the share of
 * battles that hit the tick cap or ended in a draw, and per side and class
 * the shots, hits, hit rate, damage dealt and downs inflicted, as totals
 * over every seed and as per-battle medians. The per-class numbers come
 * from the same collector (src/stats/battleStats.ts) the browser's result
 * screen uses, so the two agree.
 *
 * Usage:
 *   npm run measure                                  defaults: 60 seeds, AI versus AI
 *   npm run measure -- '{"MOVE_SPEED":2}'           override tunables for this run
 *   MM_OVERRIDES='{"WEAPONS":{"gunner":{"cooldown":10}}}' npm run measure
 *   npm run measure -- --seeds=100 --blue=passive    a blue squad that never moves
 *   npm run measure -- --blue=holdline               a scripted blue squad that holds the left wall gap
 *   npm run measure -- --cap=300                     tick cap in seconds (default 600)
 *
 * Overrides are applied through `overrideTuning` in src/sim/constants.ts, so
 * every battle here runs the shipped code with the candidate values; the
 * same JSON in the game's `?tune=` parameter gives the same battle.
 */
import type { BattleState, Command, Controller, Side, TuningOverrides } from '../src/sim/index.ts';
import { CLASS_ORDER, SIDES, TICK_RATE, TILE_SIZE, createAi, overrideTuning, runBattle } from '../src/sim/index.ts';
import { createStatsCollector, sideTotals } from '../src/stats/battleStats.ts';
import type { BattleStats, ClassStats } from '../src/stats/battleStats.ts';
import { createHoldLine } from './holdline.mts';

type BlueKind = 'ai' | 'passive' | 'holdline';

interface Options {
  seeds: number;
  firstSeed: number;
  capSeconds: number;
  blue: BlueKind;
  overrides: TuningOverrides;
}

/** One battle's statistics plus the outcome as the report counts it. */
interface Measured {
  stats: BattleStats;
  winner: Side | 'draw' | 'cap';
  /** Move commands the red AI issued over the battle: how often it re-sited its soldiers. */
  redMoves: number;
  /** Red move commands more than `SWING_TILES` tiles from that soldier's previous move command: cross-map swings. */
  redSwings: number;
}

const SWING_TILES = 8;

/** Red move commands that land more than `SWING_TILES` tiles from the same soldier's previous move command. */
function countSwings(log: readonly Command[]): number {
  const last = new Map<number, { x: number; y: number }>();
  const limit = SWING_TILES * TILE_SIZE;
  let swings = 0;
  for (const c of log) {
    if (c.side !== 'red' || c.type !== 'move') {
      continue;
    }
    for (const id of c.soldierIds) {
      const prev = last.get(id);
      if (prev !== undefined && (c.x - prev.x) * (c.x - prev.x) + (c.y - prev.y) * (c.y - prev.y) > limit * limit) {
        swings++;
      }
      last.set(id, { x: c.x, y: c.y });
    }
  }
  return swings;
}

function parseArgs(argv: readonly string[]): Options {
  const options: Options = { seeds: 60, firstSeed: 1, capSeconds: 600, blue: 'ai', overrides: {} };
  const env = process.env.MM_OVERRIDES;
  if (env !== undefined && env !== '') {
    options.overrides = JSON.parse(env) as TuningOverrides;
  }
  for (const arg of argv) {
    if (arg.startsWith('--seeds=')) {
      options.seeds = Number(arg.slice('--seeds='.length));
    } else if (arg.startsWith('--first-seed=')) {
      options.firstSeed = Number(arg.slice('--first-seed='.length));
    } else if (arg.startsWith('--cap=')) {
      options.capSeconds = Number(arg.slice('--cap='.length));
    } else if (arg === '--blue=passive' || arg === '--blue=ai' || arg === '--blue=holdline') {
      options.blue = arg.slice('--blue='.length) as BlueKind;
    } else if (arg.startsWith('{')) {
      options.overrides = { ...options.overrides, ...(JSON.parse(arg) as TuningOverrides) };
    } else {
      throw new Error(`unknown argument ${arg}`);
    }
  }
  return options;
}

/** A controller that never issues a command: the squad holds its spawn and fires at what comes in range. */
function passive(side: Side): Controller {
  return { side, think: () => [] };
}

function blueController(kind: BlueKind, seed: number): Controller {
  if (kind === 'ai') {
    return createAi('blue', seed);
  }
  return kind === 'holdline' ? createHoldLine('blue') : passive('blue');
}

function measureBattle(seed: number, options: Options): Measured {
  const collector = createStatsCollector(seed, options.overrides);
  const run = runBattle({
    seed,
    maxTicks: options.capSeconds * TICK_RATE,
    controllers: [blueController(options.blue, seed), createAi('red', seed)],
    onStep(state: BattleState) {
      collector.observe(state);
    },
  });
  const redMoves = run.log.filter((c) => c.side === 'red' && c.type === 'move').length;
  return { stats: collector.stats(), winner: run.state.winner ?? 'cap', redMoves, redSwings: countSwings(run.log) };
}

function median(values: readonly number[]): number {
  if (values.length === 0) {
    return NaN;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function seconds(ticks: number): string {
  return (ticks / TICK_RATE).toFixed(1);
}

function row(label: string, value: string): void {
  console.log(`${label.padEnd(30)} ${value}`);
}

/** `total (median)` for one class field over every battle. */
function totalAndMedian(all: readonly Measured[], pick: (s: BattleStats) => number): string {
  const values = all.map((m) => pick(m.stats));
  const total = values.reduce((n, v) => n + v, 0);
  return `${Math.round(total)} (${median(values).toFixed(1)})`;
}

/** Per side, one row per class: shots, hits, hit rate, damage dealt and downs inflicted, totals with per-battle medians in brackets. */
function reportClasses(all: readonly Measured[]): void {
  console.log('');
  console.log('per class: total over all battles (median per battle)');
  console.log(`${'side class'.padEnd(16)} ${'shots'.padEnd(14)} ${'hits'.padEnd(14)} ${'hit%'.padEnd(5)} ${'dealt'.padEnd(14)} downs`);
  for (const side of SIDES) {
    for (const cls of CLASS_ORDER) {
      const pick = (s: BattleStats): ClassStats => s.sides[side][cls];
      const shots = all.reduce((n, m) => n + pick(m.stats).shots, 0);
      const hits = all.reduce((n, m) => n + pick(m.stats).hits, 0);
      const rate = shots === 0 ? '-' : `${Math.round((100 * hits) / shots)}%`;
      console.log(
        `${`${side} ${cls}`.padEnd(16)} ${totalAndMedian(all, (s) => pick(s).shots).padEnd(14)} ` +
          `${totalAndMedian(all, (s) => pick(s).hits).padEnd(14)} ${rate.padEnd(5)} ` +
          `${totalAndMedian(all, (s) => pick(s).damageDealt).padEnd(14)} ${totalAndMedian(all, (s) => pick(s).downsInflicted)}`,
      );
    }
  }
}

function report(all: readonly Measured[], options: Options): void {
  const lengths = all.map((m) => m.stats.ticks);
  const contact = all.map((m) => m.stats.firstContactTick).filter((t): t is number => t !== null);
  const afterContact = all
    .filter((m) => m.stats.firstContactTick !== null)
    .map((m) => m.stats.ticks - (m.stats.firstContactTick as number));
  const count = (winner: Measured['winner']): number => all.filter((m) => m.winner === winner).length;
  const share = (n: number): string => `${((100 * n) / all.length).toFixed(0)}%`;
  const perSide = (pick: (s: BattleStats, side: Side) => number): string =>
    `blue ${median(all.map((m) => pick(m.stats, 'blue'))).toFixed(1)}  red ${median(all.map((m) => pick(m.stats, 'red'))).toFixed(1)}`;
  const sum = (pick: (s: BattleStats, side: Side) => number, side: Side): number => all.reduce((n, m) => n + pick(m.stats, side), 0);
  const downs = (s: BattleStats, side: Side): number => sideTotals(s, side).timesDowned;
  const medics = (s: BattleStats, side: Side): number => sideTotals(s, side).medicCalls;

  console.log(`seeds ${options.firstSeed}..${options.firstSeed + options.seeds - 1}, blue ${options.blue}, cap ${options.capSeconds}s`);
  console.log(`overrides ${JSON.stringify(options.overrides)}`);
  console.log('');
  row('battle length (s) median', seconds(median(lengths)));
  row('battle length (s) range', `${seconds(Math.min(...lengths))} to ${seconds(Math.max(...lengths))}`);
  row('first damage (s) median', contact.length > 0 ? seconds(median(contact)) : 'never');
  row('first damage (s) range', contact.length > 0 ? `${seconds(Math.min(...contact))} to ${seconds(Math.max(...contact))}` : 'never');
  row('contact to end (s) median', afterContact.length > 0 ? seconds(median(afterContact)) : 'never');
  row('downs per battle median', perSide(downs));
  row('medic calls used median', perSide(medics));
  row('red move commands median', `${median(all.map((m) => m.redMoves)).toFixed(1)}  total ${all.reduce((n, m) => n + m.redMoves, 0)}`);
  row(`red swings >${SWING_TILES} tiles total`, `${all.reduce((n, m) => n + m.redSwings, 0)}`);
  row('medic calls used total', `blue ${sum(medics, 'blue')}  red ${sum(medics, 'red')}`);
  const byWeapon = CLASS_ORDER.map((cls) => `${cls} ${sum((s, side) => s.sides[side][cls].downsInflicted, 'blue') + sum((s, side) => s.sides[side][cls].downsInflicted, 'red')}`).join('  ');
  row('downs by weapon total', byWeapon);
  row('winner split', `blue ${count('blue')} (${share(count('blue'))})  red ${count('red')} (${share(count('red'))})`);
  row('draws', `${count('draw')} (${share(count('draw'))})`);
  row('hit the tick cap', `${count('cap')} (${share(count('cap'))})`);
  reportClasses(all);
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  overrideTuning(options.overrides);
  const all: Measured[] = [];
  for (let i = 0; i < options.seeds; i++) {
    all.push(measureBattle(options.firstSeed + i, options));
  }
  report(all, options);
  if (process.env.MM_VERBOSE !== undefined) {
    console.log('');
    for (const m of all) {
      const s = m.stats;
      const b = sideTotals(s, 'blue');
      const r = sideTotals(s, 'red');
      console.log(`seed ${String(s.seed).padStart(4)}  ${seconds(s.ticks).padStart(6)}s  first ${s.firstContactTick === null ? '  n/a' : seconds(s.firstContactTick).padStart(5)}s  downs b${b.timesDowned} r${r.timesDowned}  medics b${b.medicCalls} r${r.medicCalls}  ${m.winner}`);
    }
  }
}

main();
