/**
 * Which soldier is under a world point. Dead soldiers are never picked
 * (they are ash); downed ones are, so the player can select them for a
 * medic call. Nearest centre wins within the radius.
 */
import type { BattleState, Soldier } from '../sim';

export function pickSoldier(state: BattleState, x: number, y: number, radius: number): Soldier | null {
  const r2 = radius * radius;
  let best: Soldier | null = null;
  let bestD2 = 0;
  for (const s of state.soldiers) {
    if (s.status === 'dead') {
      continue;
    }
    const dx = s.x - x;
    const dy = s.y - y;
    const d2 = dx * dx + dy * dy;
    if (d2 <= r2 && (best === null || d2 < bestD2)) {
      best = s;
      bestD2 = d2;
    }
  }
  return best;
}
