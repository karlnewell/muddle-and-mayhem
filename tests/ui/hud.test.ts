import { describe, expect, it } from 'vitest';
import { TOP_BAR_HEIGHT } from '../../src/render/renderConstants';
import { tunedBadgeRect } from '../../src/ui/hud';

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
