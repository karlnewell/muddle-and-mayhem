/**
 * Text for the battle report: fixed-width rows for the result screen and a
 * Markdown block for the clipboard. Pure functions over `BattleStats`, so
 * the layout is unit-tested and the drawing code only places strings.
 * Depends on `src/sim` types and `./battleStats` only; class labels are
 * local so this file never imports the renderer.
 */
import { CLASS_ORDER, SIDES, TICK_RATE } from '../sim';
import type { Command, Side, SoldierClass } from '../sim';
import { hitRate, sideTotals } from './battleStats';
import type { BattleStats, ClassStats } from './battleStats';

const CLASS_LABEL: Readonly<Record<SoldierClass, string>> = {
  gunner: 'Gunner',
  launcher: 'Launcher',
  chucker: 'Chucker',
  scorcher: 'Scorcher',
  blaster: 'Blaster',
};

/** Column widths in characters, shared by the header and every row. */
const COL = { side: 4, cls: 8, shots: 5, hits: 4, rate: 4, dealt: 5, taken: 5, downs: 5, downed: 6, kills: 5, downS: 6, medic: 5 } as const;

const HEADERS = ['side', 'class', 'shots', 'hits', 'hit%', 'dealt', 'taken', 'downs', 'downed', 'kills', 'down s', 'medic'];

function cells(values: readonly string[]): string {
  const widths = Object.values(COL);
  return values.map((v, i) => (i < 2 ? v.padEnd(widths[i]) : v.padStart(widths[i]))).join(' ');
}

export const REPORT_COLUMNS = cells(HEADERS);

function percent(c: ClassStats): string {
  const rate = hitRate(c);
  return rate === null ? '-' : `${Math.round(rate * 100)}%`;
}

function seconds(ticks: number): string {
  return (ticks / TICK_RATE).toFixed(1);
}

/** One class or total as the twelve column values, as strings. */
function values(side: Side, label: string, c: ClassStats): string[] {
  return [
    side,
    label,
    String(c.shots),
    String(c.hits),
    percent(c),
    String(Math.round(c.damageDealt)),
    String(Math.round(c.damageTaken)),
    String(c.downsInflicted),
    String(c.timesDowned),
    String(c.instantKills),
    seconds(c.downedTicks),
    String(c.medicCalls),
  ];
}

function eachRow(stats: BattleStats, emit: (v: string[]) => void): void {
  for (const side of SIDES) {
    for (const cls of CLASS_ORDER) {
      emit(values(side, CLASS_LABEL[cls], stats.sides[side][cls]));
    }
    emit(values(side, 'total', sideTotals(stats, side)));
  }
}

/** The header, then per side five class rows and a `total` row, all the same width. */
export function formatReportRows(stats: BattleStats): string[] {
  const rows = [REPORT_COLUMNS];
  eachRow(stats, (v) => rows.push(cells(v)));
  return rows;
}

/**
 * A Markdown block for an issue: a summary list (with the build, so a
 * playtest result is tied to the commit it ran on, and the `?speed=` factor,
 * so a slowed battle is never mistaken for full speed), the per-class table, and
 * the command log in a collapsed section so anyone can replay the battle
 * with `replayBattle(seed, log, ticks)` after applying the same overrides.
 */
export function formatReportMarkdown(stats: BattleStats, log: readonly Command[], speed = 1, build = 'dev'): string {
  const overrides = Object.keys(stats.overrides).length === 0 ? 'none' : `\`${JSON.stringify(stats.overrides)}\``;
  const contact = stats.firstContactTick === null ? 'never' : `${seconds(stats.firstContactTick)} s (tick ${stats.firstContactTick})`;
  const lines = [
    '## Battle report',
    '',
    `- Seed: ${stats.seed}`,
    `- Build: ${build}`,
    `- Winner: ${stats.winner ?? 'none yet'}`,
    `- Time: ${seconds(stats.ticks)} s (${stats.ticks} ticks)`,
    `- First contact: ${contact}`,
    `- Overrides: ${overrides}`,
    `- Speed: ${speed}x`,
    '',
    `| ${HEADERS.join(' | ')} |`,
    `|${HEADERS.map(() => '---').join('|')}|`,
  ];
  eachRow(stats, (v) => lines.push(`| ${v.join(' | ')} |`));
  lines.push(
    '',
    '<details>',
    `<summary>Command log (${log.length} commands)</summary>`,
    '',
    `Replay with \`overrideTuning(overrides)\` (when any) then \`replayBattle(${stats.seed}, log, ${stats.ticks})\`.`,
    '',
    '```json',
    JSON.stringify(log),
    '```',
    '',
    '</details>',
    '',
  );
  return lines.join('\n');
}
