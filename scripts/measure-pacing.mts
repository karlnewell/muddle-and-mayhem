/**
 * Pacing measurement: runs the real simulation (src/sim) AI versus AI over
 * many seeds and prints the numbers the tuning pass is judged by: battle
 * length, tick of first damage, downs and medic calls per side, winner split,
 * and the share of battles that hit the tick cap or ended in a draw.
 *
 * Usage:
 *   npm run measure                                  defaults: 60 seeds, AI versus AI
 *   npm run measure -- '{"MOVE_SPEED":2}'           override tunables for this run
 *   MM_OVERRIDES='{"WEAPONS":{"gunner":{"cooldown":10}}}' npm run measure
 *   npm run measure -- --seeds=100 --blue=passive    a blue squad that never moves
 *   npm run measure -- --cap=300                     tick cap in seconds (default 600)
 *
 * Overrides are applied through `overrideTuning` in src/sim/constants.ts, so
 * every battle here runs the shipped code with the candidate values.
 */
import type { BattleEvent, BattleState, Controller, Side, TuningOverrides } from '../src/sim/index.ts';
import { MEDIC_CALLS, TICK_RATE, createAi, overrideTuning, runBattle } from '../src/sim/index.ts';

interface Options {
  seeds: number;
  firstSeed: number;
  capSeconds: number;
  blue: 'ai' | 'passive';
  overrides: TuningOverrides;
}

interface BattleStats {
  seed: number;
  ticks: number;
  winner: Side | 'draw' | 'cap';
  firstDamageTick: number | null;
  downs: Record<Side, number>;
  medicCalls: Record<Side, number>;
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
    } else if (arg === '--blue=passive') {
      options.blue = 'passive';
    } else if (arg === '--blue=ai') {
      options.blue = 'ai';
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

function sideOf(state: BattleState, soldierId: number): Side {
  return state.soldiers[soldierId].side;
}

function measureBattle(seed: number, options: Options): BattleStats {
  const stats: BattleStats = {
    seed,
    ticks: 0,
    winner: 'cap',
    firstDamageTick: null,
    downs: { blue: 0, red: 0 },
    medicCalls: { blue: 0, red: 0 },
  };
  const blue = options.blue === 'ai' ? createAi('blue', seed) : passive('blue');
  const run = runBattle({
    seed,
    maxTicks: options.capSeconds * TICK_RATE,
    controllers: [blue, createAi('red', seed)],
    onStep(state: BattleState) {
      for (const e of state.events as readonly BattleEvent[]) {
        if (e.kind === 'damage' && stats.firstDamageTick === null) {
          stats.firstDamageTick = state.tick - 1;
        } else if (e.kind === 'downed' || e.kind === 'killed') {
          stats.downs[sideOf(state, e.soldierId)]++;
        }
      }
    },
  });
  stats.ticks = run.ticks;
  stats.winner = run.state.winner ?? 'cap';
  stats.medicCalls.blue = MEDIC_CALLS - run.state.sides.blue.medicCalls;
  stats.medicCalls.red = MEDIC_CALLS - run.state.sides.red.medicCalls;
  return stats;
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

function report(all: readonly BattleStats[], options: Options): void {
  const lengths = all.map((s) => s.ticks);
  const firstDamage = all.filter((s) => s.firstDamageTick !== null).map((s) => s.firstDamageTick as number);
  const afterContact = all
    .filter((s) => s.firstDamageTick !== null)
    .map((s) => s.ticks - (s.firstDamageTick as number));
  const count = (winner: BattleStats['winner']): number => all.filter((s) => s.winner === winner).length;
  const share = (n: number): string => `${((100 * n) / all.length).toFixed(0)}%`;
  const perSide = (pick: (s: BattleStats) => Record<Side, number>): string =>
    `blue ${median(all.map((s) => pick(s).blue)).toFixed(1)}  red ${median(all.map((s) => pick(s).red)).toFixed(1)}`;

  console.log(`seeds ${options.firstSeed}..${options.firstSeed + options.seeds - 1}, blue ${options.blue}, cap ${options.capSeconds}s`);
  console.log(`overrides ${JSON.stringify(options.overrides)}`);
  console.log('');
  row('battle length (s) median', seconds(median(lengths)));
  row('battle length (s) range', `${seconds(Math.min(...lengths))} to ${seconds(Math.max(...lengths))}`);
  row('first damage (s) median', firstDamage.length > 0 ? seconds(median(firstDamage)) : 'never');
  row('first damage (s) range', firstDamage.length > 0 ? `${seconds(Math.min(...firstDamage))} to ${seconds(Math.max(...firstDamage))}` : 'never');
  row('contact to end (s) median', afterContact.length > 0 ? seconds(median(afterContact)) : 'never');
  row('downs per battle median', perSide((s) => s.downs));
  row('medic calls used median', perSide((s) => s.medicCalls));
  row('medic calls used total', `blue ${all.reduce((n, s) => n + s.medicCalls.blue, 0)}  red ${all.reduce((n, s) => n + s.medicCalls.red, 0)}`);
  row('winner split', `blue ${count('blue')} (${share(count('blue'))})  red ${count('red')} (${share(count('red'))})`);
  row('draws', `${count('draw')} (${share(count('draw'))})`);
  row('hit the tick cap', `${count('cap')} (${share(count('cap'))})`);
}

function main(): void {
  const options = parseArgs(process.argv.slice(2));
  overrideTuning(options.overrides);
  const all: BattleStats[] = [];
  for (let i = 0; i < options.seeds; i++) {
    all.push(measureBattle(options.firstSeed + i, options));
  }
  report(all, options);
  if (process.env.MM_VERBOSE !== undefined) {
    console.log('');
    for (const s of all) {
      console.log(`seed ${String(s.seed).padStart(4)}  ${seconds(s.ticks).padStart(6)}s  first ${s.firstDamageTick === null ? '  n/a' : seconds(s.firstDamageTick).padStart(5)}s  downs b${s.downs.blue} r${s.downs.red}  medics b${s.medicCalls.blue} r${s.medicCalls.red}  ${s.winner}`);
    }
  }
}

main();
