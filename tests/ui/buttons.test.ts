import { describe, expect, it } from 'vitest';
import { hitButton } from '../../src/ui/buttons';
import type { ButtonRect } from '../../src/ui/buttons';

const buttons: ButtonRect[] = [
  { id: 'resume', x: 100, y: 100, w: 200, h: 40, label: 'Resume' },
  { id: 'quit', x: 100, y: 160, w: 200, h: 40, label: 'Title' },
];

describe('hitButton', () => {
  it('returns the id of the rect under the point, edges inclusive', () => {
    expect(hitButton(buttons, 150, 120)).toBe('resume');
    expect(hitButton(buttons, 100, 100)).toBe('resume');
    expect(hitButton(buttons, 300, 200)).toBe('quit');
  });
  it('returns null outside every rect', () => {
    expect(hitButton(buttons, 150, 150)).toBeNull();
    expect(hitButton(buttons, 0, 0)).toBeNull();
  });
});
