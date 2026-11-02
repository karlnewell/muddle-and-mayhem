/**
 * Simulation state and command types.
 *
 * Plain data only. `JSON.stringify(state)` is the canonical serialisation
 * used for hashing, so no class instances, Maps, Sets, or typed arrays.
 * The one exception is `BattleState.rng`, which `serializeState` replaces
 * with its state number.
 */
import type { Rng } from './rng';

export type Side = 'blue' | 'red';
export type SoldierClass = 'gunner' | 'launcher' | 'chucker' | 'scorcher' | 'blaster';
export type SoldierStatus = 'standing' | 'downed' | 'dead';
export type ShotKind = 'direct' | 'lobbed' | 'flame';

export interface Vec2 { x: number; y: number }
export interface TileCoord { tx: number; ty: number }

export type Order =
  | { kind: 'hold' }
  | { kind: 'move'; x: number; y: number }
  | { kind: 'attack'; targetId: number };

export interface Soldier {
  id: number;
  side: Side;
  cls: SoldierClass;
  name: string;
  x: number; y: number;
  prevX: number; prevY: number;
  faceX: number; faceY: number;     // unit vector, last firing or moving direction
  hp: number;
  status: SoldierStatus;
  order: Order;
  path: Vec2[];                     // remaining waypoints in world units, first is next
  cooldown: number;                 // ticks until the weapon may fire again
  targetId: number | null;          // soldier fired at this tick, or null
  firing: boolean;                  // true on ticks the weapon discharged (flame: cone active)
  stuckTicks: number;
  lastRepathTick: number;
}

export interface Projectile {
  id: number;
  kind: 'direct' | 'lobbed';
  weapon: SoldierClass;
  side: Side;
  ownerId: number;
  x: number; y: number;
  prevX: number; prevY: number;
  vx: number; vy: number;           // direct: units per tick; lobbed: 0
  startX: number; startY: number;
  targetX: number; targetY: number; // lobbed: landing point; direct: aim point
  launchTick: number;
  landTick: number;                 // lobbed only; direct: -1
  travelled: number;                // direct only
  maxDistance: number;              // direct only
}

export interface MedicRun {
  side: Side;
  targetId: number;
  x: number; y: number;
  prevX: number; prevY: number;
}

export interface SideState { medicCalls: number; selected: number[] }

export type BattleEvent =
  | { kind: 'shot'; soldierId: number; weapon: SoldierClass }
  | { kind: 'jam'; soldierId: number }
  | { kind: 'impact'; x: number; y: number; weapon: SoldierClass; radius: number }
  | { kind: 'damage'; soldierId: number; amount: number; weapon: SoldierClass }
  | { kind: 'downed'; soldierId: number }
  | { kind: 'killed'; soldierId: number }
  | { kind: 'medic'; side: Side; targetId: number }
  | { kind: 'revived'; soldierId: number }
  | { kind: 'victory'; winner: Side | 'draw' };

export type Command =
  | { tick: number; side: Side; type: 'select'; soldierIds: number[] }
  | { tick: number; side: Side; type: 'move'; soldierIds: number[]; x: number; y: number }
  | { tick: number; side: Side; type: 'attack'; soldierIds: number[]; targetId: number }
  | { tick: number; side: Side; type: 'hold'; soldierIds: number[] }
  | { tick: number; side: Side; type: 'medic'; targetId: number };

export interface TileMap {
  name: string;
  width: number;                    // tiles
  height: number;                   // tiles
  tiles: number[];                  // row-major, TILE_OPEN or a cover kind
  spawns: Record<Side, Vec2[]>;     // five world-unit points per side, class order
}

export interface BattleState {
  tick: number;
  seed: number;
  map: TileMap;
  soldiers: Soldier[];              // ids 0..9, blue first, class order per side
  projectiles: Projectile[];
  medics: MedicRun[];
  sides: Record<Side, SideState>;
  winner: Side | 'draw' | null;
  nextProjectileId: number;
  // this tick's events; cleared at the start of every step, so a caller that
  // runs several steps per frame must drain them after each step
  events: BattleEvent[];
  rng: Rng;
}
