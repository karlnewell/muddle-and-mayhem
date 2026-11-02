/**
 * The win condition, checked at the end of every tick. A side with no
 * standing soldiers loses; both at zero on the same tick is a draw. The
 * winner is set once and never changed, and `step` freezes the battle
 * as soon as it is set.
 */
import type { BattleState, Side } from './types';
import { standingCount } from './soldiers';

/** Sets state.winner when a side has no standing soldiers; 'draw' when neither does. Emits a victory event once. */
export function checkVictory(state: BattleState): void {
  if (state.winner !== null) {
    return;
  }
  const blueStanding = standingCount(state, 'blue');
  const redStanding = standingCount(state, 'red');
  let winner: Side | 'draw';
  if (blueStanding === 0 && redStanding === 0) {
    winner = 'draw';
  } else if (redStanding === 0) {
    winner = 'blue';
  } else if (blueStanding === 0) {
    winner = 'red';
  } else {
    return;
  }
  state.winner = winner;
  state.events.push({ kind: 'victory', winner });
}
