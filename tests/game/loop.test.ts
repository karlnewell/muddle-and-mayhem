import { describe, expect, it } from 'vitest';
import { createFixedStepper } from '../../src/game/loop';

const TICK_MS = 1000 / 30;

describe('createFixedStepper', () => {
  it('returns no ticks until a whole tick has accumulated', () => {
    const s = createFixedStepper(TICK_MS, 250, 8);
    expect(s.accumulate(10)).toBe(0);
    expect(s.accumulate(10)).toBe(0);
    expect(s.accumulate(13.4)).toBe(1);
  });
  it('carries the remainder into the next frame', () => {
    const s = createFixedStepper(TICK_MS, 250, 8);
    expect(s.accumulate(50)).toBe(1);
    expect(s.alpha()).toBeCloseTo((50 - TICK_MS) / TICK_MS, 9);
    expect(s.accumulate(20)).toBe(1);
  });
  it('alpha stays in [0, 1)', () => {
    const s = createFixedStepper(TICK_MS, 250, 8);
    for (let i = 0; i < 100; i++) {
      s.accumulate(7 * (i % 5) + 1);
      expect(s.alpha()).toBeGreaterThanOrEqual(0);
      expect(s.alpha()).toBeLessThan(1);
    }
  });
  it('clamps a long frame to maxFrameMs', () => {
    const s = createFixedStepper(TICK_MS, 250, 100);
    expect(s.accumulate(5000)).toBe(7); // floor(250 / 33.33)
  });
  it('caps ticks per frame and drops the excess so it never snowballs', () => {
    const s = createFixedStepper(TICK_MS, 10000, 8);
    expect(s.accumulate(1000)).toBe(8);
    expect(s.alpha()).toBeLessThan(1);
    expect(s.accumulate(0)).toBe(0);
  });
  it('reset clears the accumulator', () => {
    const s = createFixedStepper(TICK_MS, 250, 8);
    s.accumulate(30);
    s.reset();
    expect(s.alpha()).toBe(0);
    expect(s.accumulate(30)).toBe(0);
  });
});
