/**
 * The Compact Crossroads map: 26 by 15 tiles (832 by 480 world units), a
 * shrunk Crossroads, mirror-symmetric left to right and top to bottom.
 * An open horizontal road runs through rows 6 to 8 and an open vertical
 * road through columns 11 to 14. Four 4-tile wall arms (columns 7 to 10
 * and 15 to 18, rows 5 and 9) box the crossing, small L walls guard the
 * vertical road, a crate pair sits near each road mouth and near each top
 * and bottom edge, and trees stand in the corners. Blue spawns down
 * column 1, red down column 24 (23 tiles apart), top to bottom in class
 * order. The default map since Plan 7, so soldiers draw bigger.
 *
 * The rows are written out in full on purpose: this file is data a human
 * reads and edits, not code that builds the map at load time.
 *
 * Legend: '.' open, '#' wall, 'c' crate, 't' tree, 'b' blue spawn, 'r' red spawn.
 */
import type { TileMap } from '../types';
import { parseMap } from '../map';

export const COMPACT_CROSSROADS_ROWS: readonly string[] = [
  '..........................',
  '...t..................t...',
  '.......cc.#....#.cc.......',
  '.b.......##....##.......r.',
  '....cc..............cc....',
  '.b.....####....####.....r.',
  '..........................',
  '.b......................r.',
  '..........................',
  '.b.....####....####.....r.',
  '....cc..............cc....',
  '.b.......##....##.......r.',
  '.......cc.#....#.cc.......',
  '...t..................t...',
  '..........................',
];

export const COMPACT_CROSSROADS: TileMap = parseMap('Compact Crossroads', COMPACT_CROSSROADS_ROWS);
