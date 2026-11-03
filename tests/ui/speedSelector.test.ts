import { describe, expect, it } from 'vitest';
import { hitButton } from '../../src/ui/buttons';
import { speedFromButton, speedSelectorRects } from '../../src/ui/speedSelector';

describe('speedSelectorRects', () => {
  it('lays out 0.5x, 0.75x and 1x left to right, centred, with ids a click maps back to a speed', () => {
    const rects = speedSelectorRects(640, 600);
    expect(rects.map((r) => r.label)).toEqual(['0.5x', '0.75x', '1x']);
    expect(rects[0].x + (rects[2].x + rects[2].w) - 2 * 640).toBeCloseTo(0);
    expect(rects[1].x).toBeGreaterThan(rects[0].x + rects[0].w);
    const hit = (r: (typeof rects)[number]) => hitButton(rects, r.x + r.w / 2, r.y + r.h / 2);
    expect(rects.map((r) => speedFromButton(hit(r)))).toEqual([0.5, 0.75, 1]);
    expect(speedFromButton(hitButton(rects, 640, 500))).toBeNull();
    expect(speedFromButton('resume')).toBeNull();
  });
});
