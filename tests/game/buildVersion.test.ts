import { describe, expect, it } from 'vitest';
import { BUILD_VERSION, formatBuildVersion } from '../../src/game/buildVersion';

const NOV_3 = new Date('2026-11-03T23:59:00Z');

describe('formatBuildVersion', () => {
  it('joins the package version, the short commit and the UTC build date', () => {
    expect(formatBuildVersion('0.1.0', () => 'b11b13d\n', NOV_3)).toBe('0.1.0+b11b13d 2026-11-03');
  });
  it('dates the build in UTC, whatever the local time zone', () => {
    expect(formatBuildVersion('0.1.0', () => 'b11b13d', new Date('2026-11-04T00:30:00+02:00'))).toBe('0.1.0+b11b13d 2026-11-03');
  });
  it('says dev for the commit when git is unavailable or answers nonsense', () => {
    const noGit = () => {
      throw new Error('spawnSync git ENOENT');
    };
    expect(formatBuildVersion('0.1.0', noGit, NOV_3)).toBe('0.1.0+dev 2026-11-03');
    expect(formatBuildVersion('0.1.0', () => '', NOV_3)).toBe('0.1.0+dev 2026-11-03');
    expect(formatBuildVersion('0.1.0', () => 'fatal: not a git repository', NOV_3)).toBe('0.1.0+dev 2026-11-03');
  });
});

describe('BUILD_VERSION', () => {
  it('is dev when nothing was injected (unit tests run without the Vite define)', () => {
    expect(BUILD_VERSION).toBe('dev');
  });
});
