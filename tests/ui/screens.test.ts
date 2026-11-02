import { describe, expect, it } from 'vitest';
import { INITIAL_SCREEN, reduceScreen } from '../../src/ui/screens';
import type { ScreenState } from '../../src/ui/screens';

const title: ScreenState = { screen: 'title', menuOpen: false };
const battle: ScreenState = { screen: 'battle', menuOpen: false };
const menu: ScreenState = { screen: 'battle', menuOpen: true };
const result: ScreenState = { screen: 'result', menuOpen: false };

describe('reduceScreen', () => {
  it('starts on the title', () => {
    expect(INITIAL_SCREEN).toEqual(title);
  });
  it('start opens a battle from the title only', () => {
    expect(reduceScreen(title, 'start')).toEqual(battle);
    expect(reduceScreen(battle, 'start')).toBe(battle);
  });
  it('toggleMenu works in battle only and closeMenu is idempotent', () => {
    expect(reduceScreen(battle, 'toggleMenu')).toEqual(menu);
    expect(reduceScreen(menu, 'toggleMenu')).toEqual(battle);
    expect(reduceScreen(title, 'toggleMenu')).toBe(title);
    expect(reduceScreen(result, 'toggleMenu')).toBe(result);
    expect(reduceScreen(menu, 'closeMenu')).toEqual(battle);
    expect(reduceScreen(battle, 'closeMenu')).toBe(battle);
  });
  it('battleEnded goes to the result and closes the menu', () => {
    expect(reduceScreen(battle, 'battleEnded')).toEqual(result);
    expect(reduceScreen(menu, 'battleEnded')).toEqual(result);
    expect(reduceScreen(title, 'battleEnded')).toBe(title);
  });
  it('restart (from the menu) and playAgain (from the result) open a fresh battle', () => {
    expect(reduceScreen(menu, 'restart')).toEqual(battle);
    expect(reduceScreen(result, 'playAgain')).toEqual(battle);
    expect(reduceScreen(title, 'playAgain')).toBe(title);
    expect(reduceScreen(battle, 'restart')).toBe(battle);
  });
  it('toTitle works from the menu and the result', () => {
    expect(reduceScreen(menu, 'toTitle')).toEqual(title);
    expect(reduceScreen(result, 'toTitle')).toEqual(title);
    expect(reduceScreen(battle, 'toTitle')).toBe(battle);
  });
});
