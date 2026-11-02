/**
 * Every tunable in the simulation lives here. Logic files import these;
 * none of them defines a magic number for speed, range, damage, cooldown,
 * radius, chance, or interval.
 *
 * Units: world units, TILE_SIZE per tile. Time: ticks, TICK_RATE per second.
 * Speeds are world units per tick, durations are ticks.
 */
import type { ShotKind, Side, SoldierClass, Vec2 } from './types';

export const TICK_RATE = 30;
export const TILE_SIZE = 32;
export const MAX_HP = 100;
export const MOVE_SPEED = 3.2;
export const SOLDIER_RADIUS = 12;
export const MEDIC_CALLS = 3;
export const MEDIC_SPEED = 6;
export const REVIVE_FRACTION = 0.5;
export const INSTANT_KILL_CHANCE = 0.1;
export const GUNNER_JAM_CHANCE = 0.03;
export const GUNNER_JAM_TICKS = 45;
export const FLAME_CONE_COS = 0.8660254037844387; // cos 30°, so a 60° cone
export const FIRE_WHILE_MOVING = true;
export const REPATH_TICKS = 15;
export const STUCK_TICKS = 10;
export const STUCK_EPSILON = 0.5;   // moved less than this in a tick counts as no progress
export const WAYPOINT_EPSILON = 1;  // within this of a waypoint counts as reached
export const ARRIVE_SLACK = 2 * SOLDIER_RADIUS + 2; // a stuck soldier this close to its destination counts as arrived
export const AI_THINK_TICKS = 15;
export const AI_COVER_BONUS = 2;
export const AI_RANGE_FRACTION = 0.9;
export const AI_LAUNCHER_DISTANCE_WEIGHT = 3;
export const AI_TRAVEL_WEIGHT = 1;
export const AI_JITTER = 0.5;
export const AI_LOBBER_TARGET_REACH = 2; // lobbers look for a covered target within this many times their range
export const AI_SEED_SALT: Readonly<Record<Side, number>> = { blue: 0x9e3779b9, red: 0x7f4a7c15 };
export const AI_REVIVE_PRIORITY: readonly SoldierClass[] = ['launcher', 'blaster', 'chucker', 'gunner', 'scorcher'];
export const CLASS_ORDER: readonly SoldierClass[] = ['gunner', 'launcher', 'chucker', 'scorcher', 'blaster'];
export const SIDES: readonly Side[] = ['blue', 'red'];
export const SQUAD_NAMES: Readonly<Record<Side, readonly string[]>> = {
  blue: ['Pip', 'Bert', 'Maud', 'Fitz', 'Dot'],
  red: ['Grub', 'Nell', 'Otto', 'Sal', 'Wick'],
};
export const TILE_OPEN = 0;
export const TILE_WALL = 1;
export const TILE_CRATE = 2;
export const TILE_TREE = 3;

export interface WeaponStats {
  shot: ShotKind;
  range: number;          // world units
  cooldown: number;       // ticks between shots (flame: 0)
  damage: number;         // direct hit damage; flame: damage per tick; lobbed: 0
  splashRadius: number;   // world units, 0 for none
  splashDamage: number;   // damage to each standing soldier in the splash
  speed: number;          // direct: units per tick
  flightTicks: number;    // lobbed: ticks from launch to landing
  spread: number;         // max aim offset in world units
  instantKill: boolean;
}
/**
 * Range relationships to preserve when tuning: Launcher longest, Gunner and
 * Chucker medium, Blaster second shortest, Scorcher shortest. Gunner fastest
 * of direct weapons, Blaster slowest overall.
 */
export const WEAPONS: Readonly<Record<SoldierClass, Readonly<WeaponStats>>> = {
  gunner:   { shot: 'direct', range: 224, cooldown: 6,   damage: 8,  splashRadius: 0,  splashDamage: 0,  speed: 16, flightTicks: 0,  spread: 14, instantKill: false },
  launcher: { shot: 'direct', range: 352, cooldown: 75,  damage: 45, splashRadius: 40, splashDamage: 25, speed: 10, flightTicks: 0,  spread: 10, instantKill: true },
  chucker:  { shot: 'lobbed', range: 224, cooldown: 60,  damage: 0,  splashRadius: 48, splashDamage: 35, speed: 0,  flightTicks: 30, spread: 20, instantKill: false },
  scorcher: { shot: 'flame',  range: 96,  cooldown: 0,   damage: 1,  splashRadius: 0,  splashDamage: 0,  speed: 0,  flightTicks: 0,  spread: 0,  instantKill: true },
  blaster:  { shot: 'lobbed', range: 160, cooldown: 105, damage: 0,  splashRadius: 40, splashDamage: 70, speed: 0,  flightTicks: 36, spread: 16, instantKill: true },
};
/** 16 unit vectors at 22.5° steps, as literals (no Math.sin/cos in sim code). */
export const DIRECTIONS16: readonly Vec2[] = [
  { x: 1, y: 0 }, { x: 0.9238795325112867, y: 0.3826834323650898 },
  { x: 0.7071067811865476, y: 0.7071067811865476 }, { x: 0.3826834323650898, y: 0.9238795325112867 },
  { x: 0, y: 1 }, { x: -0.3826834323650898, y: 0.9238795325112867 },
  { x: -0.7071067811865476, y: 0.7071067811865476 }, { x: -0.9238795325112867, y: 0.3826834323650898 },
  { x: -1, y: 0 }, { x: -0.9238795325112867, y: -0.3826834323650898 },
  { x: -0.7071067811865476, y: -0.7071067811865476 }, { x: -0.3826834323650898, y: -0.9238795325112867 },
  { x: 0, y: -1 }, { x: 0.3826834323650898, y: -0.9238795325112867 },
  { x: 0.7071067811865476, y: -0.7071067811865476 }, { x: 0.9238795325112867, y: -0.3826834323650898 },
];
