/**
 * The Crossroads map: 40 by 22 tiles (1280 by 704 world units), mirror-
 * symmetric left to right. An open vertical road runs through columns
 * 18 to 21 and an open horizontal road through rows 9 to 11, boxed by four
 * wall arms, with crate clusters in each quadrant, small L walls near the
 * edges, and trees in the corners. Blue spawns down column 2, red down
 * column 37, top to bottom in class order.
 *
 * The rows are written out in full on purpose: this file is data a human
 * reads and edits, not code that builds the map at load time.
 *
 * Legend: '.' open, '#' wall, 'c' crate, 't' tree, 'b' blue spawn, 'r' red spawn.
 */
import type { TileMap } from '../types';
import { parseMap } from '../map';

export const CROSSROADS_ROWS: readonly string[] = [
  '........................................',
  '....t.......t..............t.......t....',
  '..........cc................cc..........',
  '..........cc...##......##...cc..........',
  '...............#........#...............',
  '....t..............................t....',
  '..b.....c......................c.....r..',
  '........cc....................cc........',
  '..b.........######....######.........r..',
  '........................................',
  '..b..................................r..',
  '........................................',
  '..b.........######....######.........r..',
  '........................................',
  '..b.....c......................c.....r..',
  '........cc....................cc........',
  '....t..............................t....',
  '...............#........#...............',
  '..........cc...##......##...cc..........',
  '..........cc................cc..........',
  '....t.......t..............t.......t....',
  '........................................',
];

export const CROSSROADS: TileMap = parseMap('Crossroads', CROSSROADS_ROWS);
