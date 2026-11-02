import { describe, expect, it } from 'vitest';
import { findViolations } from '../../scripts/check-sim-math.mjs';

describe('findViolations', () => {
  it('flags banned Math calls with line numbers', () => {
    const src = 'const a = 1;\nconst b = Math.sin(a);\nconst c = Math.atan2(1, 2);';
    expect(findViolations(src, 'x.ts')).toEqual([
      { file: 'x.ts', line: 2, token: 'Math.sin' },
      { file: 'x.ts', line: 3, token: 'Math.atan2' },
    ]);
  });
  it('flags the ** operator, Math.random, Date, and performance', () => {
    const src = 'a ** 2;\nMath.random();\nDate.now();\nperformance.now();';
    expect(findViolations(src, 'x.ts').map((v) => v.token)).toEqual(['**', 'Math.random', 'Date', 'performance']);
  });
  it('ignores banned names inside comments', () => {
    const src = '// Math.sin is banned here\n/* Math.pow\n too */\nconst ok = Math.sqrt(4);';
    expect(findViolations(src, 'x.ts')).toEqual([]);
  });
  it('allows the permitted operations', () => {
    const src = 'Math.sqrt(1); Math.floor(1); Math.abs(1); Math.min(1,2); Math.max(1,2); Math.imul(1,2); 1 >>> 0;';
    expect(findViolations(src, 'x.ts')).toEqual([]);
  });
});
