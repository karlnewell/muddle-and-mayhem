/**
 * Soldier movement for one tick: follow orders along planned paths, then
 * resolve overlaps between soldiers, push out of cover, and keep everyone
 * inside the map. Only standing soldiers move or take part in separation;
 * downed and dead soldiers are skipped entirely (they never block).
 *
 * Weapon rules stay out of this file: `canFireAt` is a callback so the
 * attack order can stop a soldier once its target is fireable.
 */
import type { BattleState, Soldier, Vec2 } from './types';
import {
  ARRIVE_SLACK, DIRECTIONS16, MOVE_SPEED, REPATH_TICKS, SOLDIER_RADIUS,
  STUCK_EPSILON, STUCK_TICKS, WAYPOINT_EPSILON,
} from './constants';
import { coverPushOut, mapHeightUnits, mapWidthUnits, tileIndex, worldToTile } from './map';
import { findPath, pathToWaypoints } from './path';
import { faceToward, isActive, soldierById } from './soldiers';
import { clamp, dist2, imod } from './vec';

export type CanFireAt = (s: Soldier, target: Soldier) => boolean;

/** Cover push-out passes per soldier per tick; an algorithm bound, not a game tunable. */
const COVER_PUSH_PASSES = 3;

/**
 * Waypoints from the soldier's tile to the world point `dest`, or null when
 * no tile path exists. When the soldier already stands on the destination
 * tile but not on the point itself, the single waypoint is the point, so an
 * order to a spot a few units away is still carried out.
 */
export function planPath(state: BattleState, s: Soldier, dest: Vec2, blocked?: ReadonlySet<number>): Vec2[] | null {
  const path = findPath(state.map, worldToTile(s.x, s.y), worldToTile(dest.x, dest.y), blocked);
  if (path === null) {
    return null;
  }
  const waypoints = pathToWaypoints(path, dest);
  if (waypoints.length === 0 && dist2(s.x, s.y, dest.x, dest.y) > WAYPOINT_EPSILON * WAYPOINT_EPSILON) {
    waypoints.push({ x: dest.x, y: dest.y });
  }
  return waypoints;
}

function hold(s: Soldier): void {
  s.order = { kind: 'hold' };
  s.path = [];
}

/** Install a plan, or hold when there is none; either way this counts as a re-plan. */
function adoptPlan(state: BattleState, s: Soldier, waypoints: Vec2[] | null): void {
  if (waypoints === null) {
    hold(s);
  } else {
    s.path = waypoints;
  }
  s.lastRepathTick = state.tick;
}

/** The world point an order is heading for, or null for hold. */
function orderDest(state: BattleState, s: Soldier): Vec2 | null {
  if (s.order.kind === 'move') {
    return { x: s.order.x, y: s.order.y };
  }
  if (s.order.kind === 'attack') {
    const target = soldierById(state, s.order.targetId);
    return target === undefined ? null : { x: target.x, y: target.y };
  }
  return null;
}

/** Attack order: drop it when the target is down, stop when fireable, else keep a plan toward it. */
function updateAttack(state: BattleState, s: Soldier, canFireAt: CanFireAt): void {
  if (s.order.kind !== 'attack') {
    return;
  }
  const target = soldierById(state, s.order.targetId);
  if (target === undefined || !isActive(target)) {
    hold(s);
    return;
  }
  if (canFireAt(s, target)) {
    s.path = [];
    faceToward(s, target.x - s.x, target.y - s.y);
    return;
  }
  if (s.path.length === 0 || state.tick - s.lastRepathTick >= REPATH_TICKS) {
    adoptPlan(state, s, planPath(state, s, { x: target.x, y: target.y }));
  }
}

/** One step of MOVE_SPEED toward the next waypoint; land on it when within reach. */
function followPath(s: Soldier): void {
  const wp = s.path[0];
  const dx = wp.x - s.x;
  const dy = wp.y - s.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d <= MOVE_SPEED + WAYPOINT_EPSILON) {
    s.x = wp.x;
    s.y = wp.y;
    s.path.shift();
  } else {
    s.x += (dx / d) * MOVE_SPEED;
    s.y += (dy / d) * MOVE_SPEED;
  }
  faceToward(s, dx, dy);
}

/**
 * Stuck rule. `progress2` is the squared net displacement over the previous
 * tick (after that tick's separation and push-out), which is the only measure
 * that sees a soldier being shoved back to where it started.
 */
function checkStuck(state: BattleState, s: Soldier, progress2: number): void {
  if (s.order.kind === 'hold') {
    s.stuckTicks = 0;
    return;
  }
  // The tick an order arrives, progress measures the idle tick before it; skip it.
  if (s.lastRepathTick === state.tick) {
    return;
  }
  if (progress2 < STUCK_EPSILON * STUCK_EPSILON) {
    s.stuckTicks++;
  } else {
    s.stuckTicks = 0;
  }
  if (s.stuckTicks < STUCK_TICKS) {
    return;
  }
  s.stuckTicks = 0;
  const dest = orderDest(state, s);
  if (dest === null) {
    hold(s);
    return;
  }
  if (s.order.kind === 'move' && dist2(s.x, s.y, dest.x, dest.y) <= ARRIVE_SLACK * ARRIVE_SLACK) {
    hold(s);
    return;
  }
  // Other standing soldiers' tiles count as cover; findPath always allows the goal tile.
  const blocked = new Set<number>();
  for (const other of state.soldiers) {
    if (other !== s && isActive(other)) {
      const t = worldToTile(other.x, other.y);
      blocked.add(tileIndex(state.map, t.tx, t.ty));
    }
  }
  adoptPlan(state, s, planPath(state, s, dest, blocked));
}

/**
 * Push every overlapping pair of standing soldiers apart. Movers yield: a
 * soldier following a path takes the whole push and a soldier without one
 * takes none, so walking into a holder never displaces it; the mover makes
 * no progress, the stuck rule fires and it re-plans around the holder's
 * tile. Two movers, or two holders, split the overlap half each.
 */
function separate(state: BattleState): void {
  const soldiers = state.soldiers;
  const minD2 = 2 * SOLDIER_RADIUS * (2 * SOLDIER_RADIUS);
  for (let i = 0; i < soldiers.length; i++) {
    const a = soldiers[i];
    if (!isActive(a)) {
      continue;
    }
    for (let j = i + 1; j < soldiers.length; j++) {
      const b = soldiers[j];
      if (!isActive(b)) {
        continue;
      }
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= minD2) {
        continue;
      }
      let nx: number;
      let ny: number;
      let overlap: number;
      if (d2 === 0) {
        const dir = DIRECTIONS16[imod(a.id + b.id, DIRECTIONS16.length)];
        nx = dir.x;
        ny = dir.y;
        overlap = 2 * SOLDIER_RADIUS;
      } else {
        const d = Math.sqrt(d2);
        nx = dx / d;
        ny = dy / d;
        overlap = 2 * SOLDIER_RADIUS - d;
      }
      const aMoving = a.path.length > 0;
      const bMoving = b.path.length > 0;
      const aShare = aMoving === bMoving ? 0.5 : aMoving ? 1 : 0;
      const bShare = 1 - aShare;
      if (aShare > 0) {
        a.x -= nx * overlap * aShare;
        a.y -= ny * overlap * aShare;
      }
      if (bShare > 0) {
        b.x += nx * overlap * bShare;
        b.y += ny * overlap * bShare;
      }
    }
  }
}

/** Push each standing soldier out of cover (a few passes), then clamp inside the map. */
function resolveCover(state: BattleState): void {
  const map = state.map;
  const maxX = mapWidthUnits(map) - SOLDIER_RADIUS;
  const maxY = mapHeightUnits(map) - SOLDIER_RADIUS;
  for (const s of state.soldiers) {
    if (!isActive(s)) {
      continue;
    }
    for (let pass = 0; pass < COVER_PUSH_PASSES; pass++) {
      const push = coverPushOut(map, s.x, s.y, SOLDIER_RADIUS);
      if (push === null) {
        break;
      }
      s.x += push.x;
      s.y += push.y;
    }
    s.x = clamp(s.x, SOLDIER_RADIUS, maxX);
    s.y = clamp(s.y, SOLDIER_RADIUS, maxY);
  }
}

/** Advance every standing soldier along its order for one tick, then separate overlaps and push out of cover and map bounds. */
export function moveSoldiers(state: BattleState, canFireAt: CanFireAt): void {
  for (const s of state.soldiers) {
    if (!isActive(s)) {
      continue;
    }
    const progress2 = dist2(s.prevX, s.prevY, s.x, s.y);
    s.prevX = s.x;
    s.prevY = s.y;
    updateAttack(state, s, canFireAt);
    const hadPath = s.path.length > 0;
    if (hadPath) {
      followPath(s);
    }
    if (s.path.length === 0 && s.order.kind === 'move') {
      hold(s);
    }
    if (hadPath) {
      checkStuck(state, s, progress2);
    }
  }
  separate(state);
  resolveCover(state);
}
