/**
 * A scripted blue squad for `npm run measure -- --blue=holdline`: plays
 * more like a person than the shipped AI does. At tick 0 every soldier
 * walks to a fixed post beside cover west of the left wall gap. At post it
 * holds; when a majority of the standing squad can fire at the enemy
 * nearest the squad's centre it focuses fire on that one, and a soldier
 * whose target slips away holds again. It calls the medic for the first
 * downed friendly (in `AI_REVIVE_PRIORITY` order) that no standing enemy
 * has within weapon range, or for anyone once a single soldier stands. It
 * advances, attack orders on the focus or nearest enemy for everyone, only
 * while it has more standing soldiers than the enemy, and returns to its
 * posts when it no longer does.
 *
 * Deterministic: a pure function of the state, no rng, thinking every
 * `AI_THINK_TICKS`, issuing a command only when the order would change.
 * Tooling, not the shipped opponent: `src/sim/ai.ts` is untouched.
 */
import type { BattleState, Command, Controller, Order, Side, Soldier, SoldierClass, TileCoord } from '../src/sim/index.ts';
import { AI_REVIVE_PRIORITY, AI_THINK_TICKS, TILE_SIZE, WEAPONS, canFireAt, tileCenter, worldToTile } from '../src/sim/index.ts';

/** Posts on Crossroads: the road mouth west of the left wall arms, with the Scorcher and Blaster tucked beside the arm ends. */
export const HOLD_TILES: Readonly<Record<SoldierClass, TileCoord>> = {
  gunner: { tx: 9, ty: 8 },
  launcher: { tx: 7, ty: 10 },
  chucker: { tx: 9, ty: 12 },
  scorcher: { tx: 10, ty: 10 },
  blaster: { tx: 11, ty: 12 },
};

/** A soldier within this of its post counts as there; a stuck arrival (ARRIVE_SLACK) is inside it. */
const AT_POST = TILE_SIZE;

function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

function standingOf(state: BattleState, side: Side): Soldier[] {
  return state.soldiers.filter((s) => s.side === side && s.status === 'standing');
}

function post(s: Soldier): { x: number; y: number } {
  const t = HOLD_TILES[s.cls];
  return tileCenter(t.tx, t.ty);
}

function atPost(s: Soldier): boolean {
  const p = post(s);
  return dist2(s.x, s.y, p.x, p.y) <= AT_POST * AT_POST;
}

/** The enemy nearest (x, y) by squared distance; ties to the lower id, which is array order. */
function nearestTo(x: number, y: number, enemies: readonly Soldier[]): Soldier {
  let best = enemies[0];
  let bestD2 = dist2(x, y, best.x, best.y);
  for (const e of enemies) {
    const d2 = dist2(x, y, e.x, e.y);
    if (d2 < bestD2) {
      best = e;
      bestD2 = d2;
    }
  }
  return best;
}

/** The enemy nearest the squad's centre that more than half of `own` can fire at, or null. */
export function focusTarget(state: BattleState, own: readonly Soldier[], enemies: readonly Soldier[]): Soldier | null {
  if (own.length === 0 || enemies.length === 0) {
    return null;
  }
  let cx = 0;
  let cy = 0;
  for (const s of own) {
    cx += s.x;
    cy += s.y;
  }
  cx /= own.length;
  cy /= own.length;
  const byDistance = [...enemies].sort((a, b) => dist2(cx, cy, a.x, a.y) - dist2(cx, cy, b.x, b.y) || a.id - b.id);
  for (const e of byDistance) {
    const seeing = own.filter((s) => canFireAt(state, s, e)).length;
    if (seeing * 2 > own.length) {
      return e;
    }
  }
  return null;
}

/** True when a medic run is already heading for soldier `id`. */
function runUnderWay(state: BattleState, id: number): boolean {
  return state.medics.some((m) => m.targetId === id);
}

/** True when no standing enemy has the body within its own weapon range. */
function bodyIsSafe(body: Soldier, enemies: readonly Soldier[]): boolean {
  return enemies.every((e) => dist2(e.x, e.y, body.x, body.y) > WEAPONS[e.cls].range * WEAPONS[e.cls].range);
}

function medicCommand(state: BattleState, side: Side, standing: number, enemies: readonly Soldier[]): Command | null {
  if (state.sides[side].medicCalls <= 0) {
    return null;
  }
  const priority = (s: Soldier): number => AI_REVIVE_PRIORITY.indexOf(s.cls);
  const downed = state.soldiers
    .filter((s) => s.side === side && s.status === 'downed' && !runUnderWay(state, s.id))
    .sort((a, b) => priority(a) - priority(b) || a.id - b.id);
  for (const body of downed) {
    if (standing <= 1 || bodyIsSafe(body, enemies)) {
      return { tick: state.tick, side, type: 'medic', targetId: body.id };
    }
  }
  return null;
}

/** True when `desired` would change nothing about the soldier's current order. */
function alreadyHolds(current: Order, desired: Order): boolean {
  if (desired.kind === 'attack') {
    return current.kind === 'attack' && current.targetId === desired.targetId;
  }
  if (desired.kind === 'move') {
    if (current.kind !== 'move') {
      return false;
    }
    const a = worldToTile(current.x, current.y);
    const b = worldToTile(desired.x, desired.y);
    return a.tx === b.tx && a.ty === b.ty;
  }
  return current.kind === 'hold';
}

/** What the soldier should be doing now, under the rules in the file comment. */
function desiredOrder(state: BattleState, s: Soldier, advance: Soldier | null, focus: Soldier | null): Order {
  if (advance !== null) {
    return { kind: 'attack', targetId: advance.id };
  }
  const p = post(s);
  const walkingToPost = s.order.kind === 'move' && worldToTile(s.order.x, s.order.y).tx === HOLD_TILES[s.cls].tx && worldToTile(s.order.x, s.order.y).ty === HOLD_TILES[s.cls].ty;
  if (walkingToPost) {
    return s.order; // let the walk finish; the sim turns it into hold on arrival
  }
  if (!atPost(s)) {
    return { kind: 'move', x: p.x, y: p.y };
  }
  if (focus !== null && canFireAt(state, s, focus)) {
    return { kind: 'attack', targetId: focus.id };
  }
  return { kind: 'hold' };
}

export function createHoldLine(side: Side): Controller {
  const enemySide: Side = side === 'blue' ? 'red' : 'blue';
  return {
    side,
    think(state: BattleState): Command[] {
      if (state.winner !== null || state.tick - Math.floor(state.tick / AI_THINK_TICKS) * AI_THINK_TICKS !== 0) {
        return [];
      }
      const own = standingOf(state, side);
      const enemies = standingOf(state, enemySide);
      const focus = focusTarget(state, own, enemies);
      let advance: Soldier | null = null;
      if (enemies.length > 0 && own.length > enemies.length) {
        let cx = 0;
        let cy = 0;
        for (const s of own) {
          cx += s.x;
          cy += s.y;
        }
        advance = focus ?? nearestTo(cx / own.length, cy / own.length, enemies);
      }
      const commands: Command[] = [];
      for (const s of own) {
        const desired = desiredOrder(state, s, advance, focus);
        if (alreadyHolds(s.order, desired)) {
          continue;
        }
        if (desired.kind === 'attack') {
          commands.push({ tick: state.tick, side, type: 'attack', soldierIds: [s.id], targetId: desired.targetId });
        } else if (desired.kind === 'move') {
          commands.push({ tick: state.tick, side, type: 'move', soldierIds: [s.id], x: desired.x, y: desired.y });
        } else {
          commands.push({ tick: state.tick, side, type: 'hold', soldierIds: [s.id] });
        }
      }
      const medic = medicCommand(state, side, own.length, enemies);
      if (medic !== null) {
        commands.push(medic);
      }
      return commands;
    },
  };
}
