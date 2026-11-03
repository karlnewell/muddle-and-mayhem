import { describe, expect, it } from 'vitest';
import { TOP_BAR_HEIGHT } from '../../src/render/renderConstants';
import { speedBadgeRect, tunedBadgeRect } from '../../src/ui/hud';

describe('tunedBadgeRect', () => {
  it('is a fixed rectangle inside the top bar with the TUNED label', () => {
    const r = tunedBadgeRect();
    expect(r.id).toBe('tuned');
    expect(r.label).toBe('TUNED');
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.y + r.h).toBeLessThanOrEqual(TOP_BAR_HEIGHT);
    expect(r.x).toBeGreaterThan(150);
  });
});

describe('speedBadgeRect', () => {
  it('sits in the top bar just right of the TUNED badge, labelled with the speed', () => {
    const t = tunedBadgeRect();
    const r = speedBadgeRect(0.5);
    expect(r.id).toBe('speed');
    expect(r.label).toBe('SPEED 0.5x');
    expect(r.x).toBeGreaterThan(t.x + t.w);
    expect(r.y).toBe(t.y);
    expect(r.y + r.h).toBeLessThanOrEqual(TOP_BAR_HEIGHT);
    expect(speedBadgeRect(0.75).label).toBe('SPEED 0.75x');
  });
});
