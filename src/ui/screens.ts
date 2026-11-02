/**
 * The screen state machine (spec 4.7): title, battle (with or without the
 * Esc menu), result. A pure reducer; `app.ts` acts on the transitions
 * (creating a session on `start`, `restart`, `playAgain`). An event that
 * does not apply returns the same object so callers can detect a no-op.
 */
export type Screen = 'title' | 'battle' | 'result';

export interface ScreenState {
  screen: Screen;
  menuOpen: boolean;
}

export type ScreenEvent = 'start' | 'battleEnded' | 'playAgain' | 'toTitle' | 'toggleMenu' | 'closeMenu' | 'restart';

export const INITIAL_SCREEN: ScreenState = { screen: 'title', menuOpen: false };

const BATTLE: ScreenState = { screen: 'battle', menuOpen: false };
const RESULT: ScreenState = { screen: 'result', menuOpen: false };

export function reduceScreen(s: ScreenState, e: ScreenEvent): ScreenState {
  switch (e) {
    case 'start':
      return s.screen === 'title' ? { ...BATTLE } : s;
    case 'toggleMenu':
      return s.screen === 'battle' ? { screen: 'battle', menuOpen: !s.menuOpen } : s;
    case 'closeMenu':
      return s.screen === 'battle' && s.menuOpen ? { ...BATTLE } : s;
    case 'battleEnded':
      return s.screen === 'battle' ? { ...RESULT } : s;
    case 'restart':
      return s.screen === 'battle' && s.menuOpen ? { ...BATTLE } : s;
    case 'playAgain':
      return s.screen === 'result' ? { ...BATTLE } : s;
    case 'toTitle':
      return (s.screen === 'battle' && s.menuOpen) || s.screen === 'result' ? { ...INITIAL_SCREEN } : s;
  }
}
