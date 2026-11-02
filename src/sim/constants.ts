/**
 * Every tunable in the simulation lives here. Logic files import these;
 * none of them defines a magic number for speed, range, damage, cooldown,
 * radius, chance, or interval.
 *
 * Units: world units, TILE_SIZE per tile. Time: ticks, TICK_RATE per second.
 * Speeds are world units per tick, durations are ticks.
 *
 * The gameplay tunables are `let` bindings so that `overrideTuning` (at the
 * bottom) can swap candidate values in for `npm run measure`. The game never
 * calls it; a battle in play sees the values written here.
 */
import type { ShotKind, Side, SoldierClass, Vec2 } from './types';

export const TICK_RATE = 30;
export const TILE_SIZE = 32;
export let MAX_HP = 160;
export let MOVE_SPEED = 1.8;
export const SOLDIER_RADIUS = 12;
export let MEDIC_CALLS = 3;
export let MEDIC_SPEED = 6;
export let REVIVE_FRACTION = 0.5;
export let INSTANT_KILL_CHANCE = 0.1;
export let GUNNER_JAM_CHANCE = 0.03;
export let GUNNER_JAM_TICKS = 45;
export const FLAME_CONE_COS = 0.8660254037844387; // cos 30°, so a 60° cone
export const FIRE_WHILE_MOVING = true;
export const REPATH_TICKS = 15;
export const STUCK_TICKS = 10;
export const STUCK_EPSILON = 0.5;   // moved less than this in a tick counts as no progress
export const WAYPOINT_EPSILON = 1;  // within this of a waypoint counts as reached
export const ARRIVE_SLACK = 2 * SOLDIER_RADIUS + 2; // a stuck soldier this close to its destination counts as arrived
export let AI_THINK_TICKS = 15;
export let AI_COVER_BONUS = 2;
export let AI_RANGE_FRACTION = 0.9;
export let AI_LAUNCHER_DISTANCE_WEIGHT = 3;
export let AI_TRAVEL_WEIGHT = 1;
export let AI_JITTER = 0.5;
export let AI_LOBBER_TARGET_REACH = 2; // lobbers look for a covered target within this many times their range
export let AI_SPACING_PENALTY = 3;          // firing-tile score lost for standing beside a friendly: one grenade should not catch two
export let AI_MEDIC_PATIENCE_TICKS = 90;    // the AI revives a covered body once it has lain this long (3 s)
export let AI_MEDIC_DESPERATE_STANDING = 3; // with fewer standing than this, the AI revives at once, covered or not
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
 *
 * Plan 4 set these for 60 to 90 second battles: long cooldowns, wide spread
 * so most shots miss, and small splash so one grenade rarely catches two.
 * `npm run measure` prints the numbers any change should be judged by.
 */
export let WEAPONS: Readonly<Record<SoldierClass, Readonly<WeaponStats>>> = {
  gunner:   { shot: 'direct', range: 224, cooldown: 18,  damage: 5,   splashRadius: 0,  splashDamage: 0,  speed: 16, flightTicks: 0,  spread: 40, instantKill: false },
  launcher: { shot: 'direct', range: 352, cooldown: 270, damage: 35,  splashRadius: 32, splashDamage: 20, speed: 10, flightTicks: 0,  spread: 16, instantKill: true },
  chucker:  { shot: 'lobbed', range: 224, cooldown: 210, damage: 0,   splashRadius: 40, splashDamage: 30, speed: 0,  flightTicks: 30, spread: 36, instantKill: false },
  scorcher: { shot: 'flame',  range: 96,  cooldown: 0,   damage: 0.2, splashRadius: 0,  splashDamage: 0,  speed: 0,  flightTicks: 0,  spread: 0,  instantKill: true },
  blaster:  { shot: 'lobbed', range: 160, cooldown: 300, damage: 0,   splashRadius: 32, splashDamage: 55, speed: 0,  flightTicks: 36, spread: 30, instantKill: true },
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

/** The scalar tunables `overrideTuning` accepts, by name. Structural values (tick rate, tile size, radii) are not on the list. */
export type TunableName =
  | 'MAX_HP' | 'MOVE_SPEED' | 'MEDIC_CALLS' | 'MEDIC_SPEED' | 'REVIVE_FRACTION' | 'INSTANT_KILL_CHANCE'
  | 'GUNNER_JAM_CHANCE' | 'GUNNER_JAM_TICKS' | 'AI_THINK_TICKS' | 'AI_COVER_BONUS' | 'AI_RANGE_FRACTION'
  | 'AI_LAUNCHER_DISTANCE_WEIGHT' | 'AI_TRAVEL_WEIGHT' | 'AI_JITTER' | 'AI_LOBBER_TARGET_REACH'
  | 'AI_MEDIC_PATIENCE_TICKS' | 'AI_MEDIC_DESPERATE_STANDING' | 'AI_SPACING_PENALTY';

export type TuningOverrides = Partial<Record<TunableName, number>> & {
  WEAPONS?: Partial<Record<SoldierClass, Partial<WeaponStats>>>;
};

/**
 * Replace tunables for a measurement run. Scalars are assigned by name;
 * `WEAPONS` is merged per class, so `{ WEAPONS: { gunner: { cooldown: 10 } } }`
 * changes one field. Unknown names throw, so a typo in an override is loud.
 * Only `scripts/measure-pacing.mts` calls this.
 */
export function overrideTuning(overrides: TuningOverrides): void {
  for (const key of Object.keys(overrides) as (keyof TuningOverrides)[]) {
    const value = overrides[key];
    if (key === 'WEAPONS') {
      const merged = { ...WEAPONS } as Record<SoldierClass, WeaponStats>;
      for (const cls of Object.keys(value ?? {}) as SoldierClass[]) {
        if (!(cls in merged)) {
          throw new Error(`overrideTuning: unknown class ${cls}`);
        }
        merged[cls] = { ...merged[cls], ...(value as Record<SoldierClass, Partial<WeaponStats>>)[cls] };
      }
      WEAPONS = merged;
      continue;
    }
    if (typeof value !== 'number') {
      throw new Error(`overrideTuning: ${key} must be a number`);
    }
    switch (key) {
      case 'MAX_HP': MAX_HP = value; break;
      case 'MOVE_SPEED': MOVE_SPEED = value; break;
      case 'MEDIC_CALLS': MEDIC_CALLS = value; break;
      case 'MEDIC_SPEED': MEDIC_SPEED = value; break;
      case 'REVIVE_FRACTION': REVIVE_FRACTION = value; break;
      case 'INSTANT_KILL_CHANCE': INSTANT_KILL_CHANCE = value; break;
      case 'GUNNER_JAM_CHANCE': GUNNER_JAM_CHANCE = value; break;
      case 'GUNNER_JAM_TICKS': GUNNER_JAM_TICKS = value; break;
      case 'AI_THINK_TICKS': AI_THINK_TICKS = value; break;
      case 'AI_COVER_BONUS': AI_COVER_BONUS = value; break;
      case 'AI_RANGE_FRACTION': AI_RANGE_FRACTION = value; break;
      case 'AI_LAUNCHER_DISTANCE_WEIGHT': AI_LAUNCHER_DISTANCE_WEIGHT = value; break;
      case 'AI_TRAVEL_WEIGHT': AI_TRAVEL_WEIGHT = value; break;
      case 'AI_JITTER': AI_JITTER = value; break;
      case 'AI_LOBBER_TARGET_REACH': AI_LOBBER_TARGET_REACH = value; break;
      case 'AI_MEDIC_PATIENCE_TICKS': AI_MEDIC_PATIENCE_TICKS = value; break;
      case 'AI_SPACING_PENALTY': AI_SPACING_PENALTY = value; break;
      case 'AI_MEDIC_DESPERATE_STANDING': AI_MEDIC_DESPERATE_STANDING = value; break;
      default: throw new Error(`overrideTuning: unknown tunable ${String(key)}`);
    }
  }
}
