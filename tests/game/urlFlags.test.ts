import { describe, expect, it } from 'vitest';
import { debugFromSearch } from '../../src/game/urlFlags';

describe('debugFromSearch', () => {
  it('turns the overlay on for ?debug=1, alone or with other parameters', () => {
    expect(debugFromSearch('?debug=1')).toBe(true);
    expect(debugFromSearch('?seed=7&debug=1')).toBe(true);
  });
  it('leaves it off otherwise', () => {
    expect(debugFromSearch('')).toBe(false);
    expect(debugFromSearch('?seed=7')).toBe(false);
    expect(debugFromSearch('?debug=0')).toBe(false);
    expect(debugFromSearch('?debug=yes')).toBe(false);
  });
});
