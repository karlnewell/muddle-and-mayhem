import { describe, expect, it } from 'vitest';
import { formatClock } from '../../src/ui/text';
import { TICK_RATE } from '../../src/sim';

describe('formatClock', () => {
  it('formats ticks as mm:ss', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(TICK_RATE - 1)).toBe('00:00');
    expect(formatClock(TICK_RATE * 61)).toBe('01:01');
    expect(formatClock(TICK_RATE * 600)).toBe('10:00');
  });
});
