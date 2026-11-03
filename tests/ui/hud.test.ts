import { describe, expect, it } from 'vitest';
import { TOP_BAR_HEIGHT } from '../../src/render/renderConstants';
import { LOGICAL_HEIGHT } from '../../src/render/renderConstants';
import { hudCardRects, sidePanelRect, speedBadgeRect, tunedBadgeRect } from '../../src/ui/hud';

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

describe('hudCardRects', () => {
  for (const side of ['blue', 'red'] as const) {
    it(`stacks five cards in slot order inside the ${side} side panel, without overlap, leaving room below`, () => {
      const panel = sidePanelRect(side);
      const cards = hudCardRects(side);
      expect(cards.map((c) => c.id)).toEqual(['slot0', 'slot1', 'slot2', 'slot3', 'slot4']);
      for (const c of cards) {
        expect(c.x).toBeGreaterThanOrEqual(panel.x);
        expect(c.x + c.w).toBeLessThanOrEqual(panel.x + panel.w);
        expect(c.y).toBeGreaterThanOrEqual(panel.y);
        expect(c.y + c.h).toBeLessThanOrEqual(panel.y + panel.h);
      }
      for (let i = 1; i < cards.length; i++) {
        expect(cards[i].y).toBeGreaterThanOrEqual(cards[i - 1].y + cards[i - 1].h);
      }
      const last = cards[cards.length - 1];
      expect(panel.y + panel.h - (last.y + last.h)).toBeGreaterThanOrEqual(70);
    });
  }

  it('fills the space below the top bar on the player side', () => {
    expect(sidePanelRect('blue')).toMatchObject({ x: 0, y: 40, w: 200, h: 480 });
    expect(sidePanelRect('red')).toMatchObject({ x: 832, y: 40, w: 200, h: 480 });
    expect(sidePanelRect('blue').y + sidePanelRect('blue').h).toBe(LOGICAL_HEIGHT);
  });
});
