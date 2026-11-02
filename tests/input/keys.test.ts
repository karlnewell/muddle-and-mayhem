import { describe, expect, it } from 'vitest';
import { keyFromEvent } from '../../src/input/keys';

describe('keyFromEvent', () => {
  it('reads slot digits from the key code so Shift does not turn them into symbols', () => {
    expect(keyFromEvent('Digit2', '@')).toBe('2');
    expect(keyFromEvent('Digit5', '%')).toBe('5');
    expect(keyFromEvent('Digit1', '1')).toBe('1');
  });
  it('passes other keys through unchanged', () => {
    expect(keyFromEvent('Digit6', '6')).toBe('6');
    expect(keyFromEvent('KeyH', 'H')).toBe('H');
    expect(keyFromEvent('Space', ' ')).toBe(' ');
    expect(keyFromEvent('Escape', 'Escape')).toBe('Escape');
  });
});
