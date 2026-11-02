import { describe, expect, it } from 'vitest';
import type { Command } from '../../src/sim';
import { createStatsCollector } from '../../src/stats/battleStats';
import type { BattleStats } from '../../src/stats/battleStats';
import { REPORT_COLUMNS, formatReportMarkdown, formatReportRows } from '../../src/stats/reportText';

/** A battle report built by hand: seed 7, 1860 ticks, blue won, first contact at tick 288. */
function sample(): BattleStats {
  const stats = createStatsCollector(7, { WEAPONS: { launcher: { cooldown: 180 } } }).stats();
  stats.ticks = 1860;
  stats.winner = 'blue';
  stats.firstContactTick = 288;
  Object.assign(stats.sides.blue.gunner, { shots: 40, hits: 10, damageDealt: 50 });
  Object.assign(stats.sides.red.launcher, { downsInflicted: 2, instantKills: 1, downedTicks: 90, medicCalls: 1, damageTaken: 33.4 });
  return stats;
}

const log: Command[] = [
  { tick: 0, side: 'blue', type: 'move', soldierIds: [0], x: 100, y: 200 },
  { tick: 15, side: 'red', type: 'attack', soldierIds: [5], targetId: 0 },
];

describe('formatReportRows', () => {
  it('has a header, five class rows and a total row per side', () => {
    const rows = formatReportRows(sample());
    expect(rows).toHaveLength(13);
    expect(rows[0]).toBe(REPORT_COLUMNS);
    expect(rows[1]).toMatch(/^blue Gunner/);
    expect(rows[5]).toMatch(/^blue Blaster/);
    expect(rows[6]).toMatch(/^blue total/);
    expect(rows[7]).toMatch(/^red  Gunner/);
    expect(rows[12]).toMatch(/^red  total/);
  });
  it('prints shots, hits and the hit rate as a percentage', () => {
    const rows = formatReportRows(sample());
    expect(rows[1]).toMatch(/\b40\b/);
    expect(rows[1]).toMatch(/\b10\b/);
    expect(rows[1]).toContain('25%');
  });
  it('prints a dash for the hit rate of a class that never fired', () => {
    expect(formatReportRows(sample())[2]).toMatch(/ - /);
  });
  it('prints seconds downed with one decimal and rounds damage to integers', () => {
    const red = formatReportRows(sample())[8];
    expect(red).toContain('3.0');
    expect(red).toContain(' 33 ');
    expect(red).not.toContain('33.4');
  });
  it('keeps every row the width of the header', () => {
    const rows = formatReportRows(sample());
    for (const row of rows) {
      expect(row.length).toBe(REPORT_COLUMNS.length);
    }
  });
});

describe('formatReportMarkdown', () => {
  it('carries the summary, the table, the overrides and the log', () => {
    const md = formatReportMarkdown(sample(), log);
    expect(md).toContain('Seed: 7');
    expect(md).toContain('Winner: blue');
    expect(md).toContain('Time: 62.0 s (1860 ticks)');
    expect(md).toContain('First contact: 9.6 s (tick 288)');
    expect(md).toContain('Overrides: `{"WEAPONS":{"launcher":{"cooldown":180}}}`');
    expect(md).toContain('| blue | Gunner | 40 | 10 | 25% |');
    expect(md).toContain('| red | total |');
    expect(md).toContain('<details>');
    expect(md).toContain(JSON.stringify(log));
    expect(md).toContain('replayBattle');
  });
  it('says none for no overrides and never for no contact', () => {
    const stats = createStatsCollector(3, {}).stats();
    const md = formatReportMarkdown(stats, []);
    expect(md).toContain('Overrides: none');
    expect(md).toContain('First contact: never');
    expect(md).toContain('Winner: none yet');
  });
});
