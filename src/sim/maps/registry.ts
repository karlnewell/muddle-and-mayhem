/**
 * Every map the game knows, by a short id a person types (`--map=compact`
 * in the measure script, `MAPS.compact` in a replay instruction). The
 * `TileMap.name` is the readable name. `DEFAULT_MAP` is the one
 * `createBattle` uses when no map is given and the renderer sizes the
 * field from; the other maps stay so old measurements and old reports
 * still replay.
 */
import type { TileMap } from '../types';
import { COMPACT_CROSSROADS } from './compactCrossroads';
import { CROSSROADS } from './crossroads';

export type MapId = 'crossroads' | 'compact';

export const MAPS: Readonly<Record<MapId, TileMap>> = {
  crossroads: CROSSROADS,
  compact: COMPACT_CROSSROADS,
};

export const MAP_IDS: readonly MapId[] = ['crossroads', 'compact'];

export const DEFAULT_MAP_ID: MapId = 'compact';

export const DEFAULT_MAP: TileMap = MAPS[DEFAULT_MAP_ID];

/** The id of a registered map: the same object, or failing that a map with the same name. Null when none matches. */
export function mapIdOf(map: TileMap): MapId | null {
  for (const id of MAP_IDS) {
    if (MAPS[id] === map) {
      return id;
    }
  }
  for (const id of MAP_IDS) {
    if (MAPS[id].name === map.name) {
      return id;
    }
  }
  return null;
}
