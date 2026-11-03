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
  it('at speed 0.5 runs half the ticks for the same real time', () => {
    const full = createFixedStepper(TICK_MS, 250, 8);
    const half = createFixedStepper(TICK_MS, 250, 8, 0.5);
    let fullTicks = 0;
    let halfTicks = 0;
    for (let i = 0; i < 600; i++) {
      fullTicks += full.accumulate(1000 / 60);
      halfTicks += half.accumulate(1000 / 60);
    }
    expect(fullTicks).toBe(300);
    expect(halfTicks).toBe(150);
  });
  it('at speed 0.75 runs three quarters of the ticks, and alpha follows the scaled time', () => {
    const s = createFixedStepper(TICK_MS, 250, 8, 0.75);
    let ticks = 0;
    for (let i = 0; i < 400; i++) {
      ticks += s.accumulate(10);
    }
    // 4000 ms real is 3000 ms of game time, 90 ticks; summing 7.5 ms steps lands a hair under, as at full speed
    expect(ticks).toBeGreaterThanOrEqual(89);
    expect(ticks + s.accumulate(1)).toBe(90);
    const t = createFixedStepper(TICK_MS, 250, 8, 0.5);
    expect(t.accumulate(TICK_MS)).toBe(0);
    expect(t.alpha()).toBeCloseTo(0.5, 9);
  });
  it('takes a new speed from the next frame on', () => {
    const s = createFixedStepper(TICK_MS, 250, 8, 0.5);
    expect(s.accumulate(TICK_MS * 2)).toBe(1);
    s.setSpeed(1);
    expect(s.accumulate(TICK_MS * 2)).toBe(2);
  });
  it('clamps the real frame before scaling it', () => {
    const s = createFixedStepper(TICK_MS, 250, 100, 0.5);
    expect(s.accumulate(5000)).toBe(3); // floor(125 / 33.33)
  });
});
