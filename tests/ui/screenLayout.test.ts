import { describe, expect, it } from 'vitest';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../../src/render/renderConstants';
import type { Rect } from '../../src/ui/buttons';
import { menuButtons, menuHintLines, menuPanelRect, menuSpeedRects } from '../../src/ui/menu';
import { resultButtons, resultPanelRect, resultRowY } from '../../src/ui/result';
import { titleLayout } from '../../src/ui/title';
import { RESULT, TEXT_CHAR_WIDTH } from '../../src/ui/uiConstants';

function inside(inner: Rect, outer: Rect): void {
  expect(inner.x).toBeGreaterThanOrEqual(outer.x);
  expect(inner.y).toBeGreaterThanOrEqual(outer.y);
  expect(inner.x + inner.w).toBeLessThanOrEqual(outer.x + outer.w);
  expect(inner.y + inner.h).toBeLessThanOrEqual(outer.y + outer.h);
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

const CANVAS: Rect = { x: 0, y: 0, w: LOGICAL_WIDTH, h: LOGICAL_HEIGHT };

describe('title screen layout', () => {
  const t = titleLayout();
  const named: [string, Rect][] = [
    ['title', t.title],
    ['subtitle', t.subtitle],
    ['blue portrait', t.portraits[0]],
    ['red portrait', t.portraits[1]],
    ['start', t.start],
    ['hint', t.hint],
    ['speed', t.speed],
    ['controls', t.controls],
    ['build', t.build],
  ];

  it('keeps every element inside the 1032 by 520 canvas', () => {
    for (const [, r] of named) {
      inside(r, CANVAS);
    }
  });

  it('overlaps no two elements', () => {
    for (let i = 0; i < named.length; i++) {
      for (let j = i + 1; j < named.length; j++) {
        expect(overlaps(named[i][1], named[j][1]), `${named[i][0]} and ${named[j][0]}`).toBe(false);
      }
    }
  });

  it('places the speed segments inside the speed block', () => {
    for (const s of t.speedSegments) {
      inside(s, t.speed);
    }
  });
});

describe('Esc menu layout', () => {
  it('fits the canvas, with the buttons, speed selector and both hint lines inside the panel', () => {
    const panel = menuPanelRect();
    inside(panel, CANVAS);
    for (const b of [...menuButtons(), ...menuSpeedRects()]) {
      inside(b, panel);
    }
    const lines = menuHintLines();
    expect(lines.length).toBe(2);
    for (const l of lines) {
      inside(l.rect, panel);
      expect(l.text.length * TEXT_CHAR_WIDTH.small).toBeLessThanOrEqual(panel.w - 24);
    }
    const lastSpeed = menuSpeedRects()[0];
    expect(lines[0].rect.y).toBeGreaterThan(lastSpeed.y + lastSpeed.h);
  });
});

describe('result screen layout', () => {
  it('fits the panel in the canvas, every table row inside the panel above the buttons', () => {
    const panel = resultPanelRect();
    inside(panel, CANVAS);
    const firstButton = resultButtons('idle')[0];
    for (let i = 0; i < RESULT.tableRows; i++) {
      const y = resultRowY(i);
      expect(y - RESULT.rowHeight / 2).toBeGreaterThanOrEqual(panel.y);
      expect(y + RESULT.rowHeight / 2).toBeLessThanOrEqual(firstButton.y);
    }
    expect(RESULT.tableRows).toBe(13);
    for (const b of resultButtons('shown')) {
      inside(b, panel);
    }
  });
});
