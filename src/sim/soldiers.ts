/**
 * Soldier creation and lookup. Ten soldiers per battle: blue ids 0-4 then
 * red ids 5-9, each side in CLASS_ORDER, one per spawn point of the map.
 */
import type { BattleState, Side, Soldier, TileMap } from './types';
import { CLASS_ORDER, MAX_HP, SIDES, SQUAD_NAMES } from './constants';
import { normalize } from './vec';

/**
 * Ten soldiers: blue ids 0-4 then red ids 5-9, each side in CLASS_ORDER, placed
 * on map.spawns[side][i], names from SQUAD_NAMES, hp MAX_HP, status standing,
 * order hold, facing toward the other side (blue faceX 1, red faceX -1),
 * cooldown 0, targetId null, firing false, stuckTicks 0, lastRepathTick -1, downedTick -1.
 */
export function createSoldiers(map: TileMap): Soldier[] {
  const soldiers: Soldier[] = [];
  for (let si = 0; si < SIDES.length; si++) {
    const side = SIDES[si];
    for (let i = 0; i < CLASS_ORDER.length; i++) {
      const spawn = map.spawns[side][i];
      soldiers.push({
        id: si * CLASS_ORDER.length + i,
        side,
        cls: CLASS_ORDER[i],
        name: SQUAD_NAMES[side][i],
        x: spawn.x,
        y: spawn.y,
        prevX: spawn.x,
        prevY: spawn.y,
        faceX: side === 'blue' ? 1 : -1,
        faceY: 0,
        hp: MAX_HP,
        status: 'standing',
        order: { kind: 'hold' },
        path: [],
        cooldown: 0,
        targetId: null,
        firing: false,
        stuckTicks: 0,
        lastRepathTick: -1,
        downedTick: -1,
      });
    }
  }
  return soldiers;
}

/** Number of standing soldiers on `side`. */
export function standingCount(state: BattleState, side: Side): number {
  let count = 0;
  for (const s of state.soldiers) {
    if (s.side === side && isActive(s)) {
      count++;
    }
  }
  return count;
}

/** The soldier with this id, or undefined. Ids are array indices, but this never assumes it. */
export function soldierById(state: BattleState, id: number): Soldier | undefined {
  const direct = state.soldiers[id];
  if (direct !== undefined && direct.id === id) {
    return direct;
  }
  for (const s of state.soldiers) {
    if (s.id === id) {
      return s;
    }
  }
  return undefined;
}

/** True for a soldier that can move, fire, and be hit: status standing. */
export function isActive(s: Soldier): boolean {
  return s.status === 'standing';
}

/** Turn the soldier to face along (dx, dy); a zero vector leaves the facing unchanged. */
export function faceToward(s: Soldier, dx: number, dy: number): void {
  const dir = normalize(dx, dy);
  if (dir.x !== 0 || dir.y !== 0) {
    s.faceX = dir.x;
    s.faceY = dir.y;
  }
}
