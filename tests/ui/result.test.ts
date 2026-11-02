import { describe, expect, it } from 'vitest';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../../src/render/renderConstants';
import { resultButtons, resultTableBottom } from '../../src/ui/result';

describe('resultButtons', () => {
  it('offers Play again, Copy report and Title in that order', () => {
    const buttons = resultButtons('idle');
    expect(buttons.map((b) => b.id)).toEqual(['playAgain', 'copyReport', 'title']);
    expect(buttons.map((b) => b.label)).toEqual(['Play again', 'Copy report', 'Title']);
  });
  it('relabels the copy button by state', () => {
    expect(resultButtons('copied')[1].label).toBe('Copied');
    expect(resultButtons('shown')[1].label).toBe('Report shown below');
    expect(resultButtons('shown')[1].id).toBe('copyReport');
  });
  it('keeps every button on the canvas and below the table', () => {
    for (const b of resultButtons('idle')) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x + b.w).toBeLessThanOrEqual(LOGICAL_WIDTH);
      expect(b.y).toBeGreaterThan(resultTableBottom());
      expect(b.y + b.h).toBeLessThanOrEqual(LOGICAL_HEIGHT);
    }
  });
});
