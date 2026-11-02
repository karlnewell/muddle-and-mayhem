/**
 * Medic calls. The medic is abstract: a run appears at its side's map edge,
 * level with the body, travels in a straight line at MEDIC_SPEED ignoring
 * cover, cannot be hit, and on arrival revives the soldier at a fraction of
 * full hp. The call is spent when the command is accepted. Nothing here
 * touches the rng.
 */
import type { BattleState, MedicRun, Side, Soldier } from './types';
import { MAX_HP, MEDIC_SPEED, REVIVE_FRACTION, SOLDIER_RADIUS } from './constants';
import { mapWidthUnits } from './map';
import { soldierById } from './soldiers';
import { dist2, normalize } from './vec';

/** True when a run is already heading for soldier `targetId`. */
function runUnderWay(state: BattleState, targetId: number): boolean {
  for (const run of state.medics) {
    if (run.targetId === targetId) {
      return true;
    }
  }
  return false;
}

/**
 * Validate and accept a medic command: own side, target downed, calls
 * remaining, no run already heading to that target. On success spends one
 * call, starts the run at the side's edge level with the body, emits
 * `medic`, and returns true. Otherwise changes nothing and returns false.
 */
export function callMedic(state: BattleState, side: Side, targetId: number): boolean {
  const target = soldierById(state, targetId);
  if (target === undefined || target.side !== side || target.status !== 'downed') {
    return false;
  }
  if (state.sides[side].medicCalls <= 0 || runUnderWay(state, targetId)) {
    return false;
  }
  state.sides[side].medicCalls--;
  const x = side === 'blue' ? SOLDIER_RADIUS : mapWidthUnits(state.map) - SOLDIER_RADIUS;
  const y = target.y;
  state.medics.push({ side, targetId, x, y, prevX: x, prevY: y });
  state.events.push({ kind: 'medic', side, targetId });
  return true;
}

/** Bring a downed soldier back at floor(MAX_HP * REVIVE_FRACTION), standing and holding where it lies. */
function revive(state: BattleState, s: Soldier): void {
  s.hp = Math.floor(MAX_HP * REVIVE_FRACTION);
  s.status = 'standing';
  s.downedTick = -1;
  s.order = { kind: 'hold' };
  s.path = [];
  s.cooldown = 0;
  s.stuckTicks = 0;
  s.targetId = null;
  s.firing = false;
  state.events.push({ kind: 'revived', soldierId: s.id });
}

/**
 * Advance every run by MEDIC_SPEED toward its target, in array order. A run
 * within MEDIC_SPEED of the body revives the soldier and ends; a run whose
 * target is no longer downed (cannot happen in v1, but be safe) is dropped.
 * Removal preserves the order of the remaining runs.
 */
export function advanceMedics(state: BattleState): void {
  const reach2 = MEDIC_SPEED * MEDIC_SPEED;
  const kept: MedicRun[] = [];
  for (const run of state.medics) {
    run.prevX = run.x;
    run.prevY = run.y;
    const target = soldierById(state, run.targetId);
    if (target === undefined || target.status !== 'downed') {
      continue;
    }
    if (dist2(run.x, run.y, target.x, target.y) <= reach2) {
      revive(state, target);
      continue;
    }
    const dir = normalize(target.x - run.x, target.y - run.y);
    run.x += dir.x * MEDIC_SPEED;
    run.y += dir.y * MEDIC_SPEED;
    kept.push(run);
  }
  state.medics = kept;
}
