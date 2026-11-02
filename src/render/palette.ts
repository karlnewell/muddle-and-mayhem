/**
 * Colours and fonts for the placeholder look (spec 4.8): flat shapes, blue
 * against red, readable at a glance. Everything that picks a colour or a
 * size for drawing takes it from here.
 */
import type { Side, SoldierClass } from '../sim';

export const FONT_FAMILY = 'ui-monospace, Menlo, Consolas, "Liberation Mono", monospace';

export const PALETTE = {
  pageBackground: '#0e1116',
  ground: '#3b6b35',
  groundGrid: 'rgba(0, 0, 0, 0.06)',
  wall: '#6f6f78',
  wallEdge: '#45454c',
  crate: '#8a5a2b',
  crateEdge: '#5a3a18',
  tree: '#1f4a22',
  treeEdge: '#143016',
  outline: '#101418',
  text: '#f2f2f2',
  textDim: '#b9bec7',
  panel: '#161b22',
  panelEdge: '#2a3139',
  selection: '#ffe66d',
  path: 'rgba(255, 230, 109, 0.8)',
  reticle: '#ff9f43',
  hpHigh: '#4cd964',
  hpMid: '#ffd54a',
  hpLow: '#ff5a5a',
  hpBack: 'rgba(0, 0, 0, 0.55)',
  cooldown: 'rgba(255, 255, 255, 0.85)',
  ash: '#2b2b2b',
  ashFleck: '#4a4a4a',
  medic: '#ffffff',
  medicCross: '#d64545',
  medicLine: 'rgba(255, 255, 255, 0.5)',
  bullet: '#ffe66d',
  rocket: '#ff9f43',
  rocketTrail: 'rgba(200, 200, 200, 0.5)',
  grenade: '#9bb36a',
  dynamite: '#c0392b',
  shadow: 'rgba(0, 0, 0, 0.35)',
  flame: 'rgba(255, 140, 40, 0.45)',
  flameCore: 'rgba(255, 230, 120, 0.55)',
  impact: '#ffffff',
  hitFlash: 'rgba(255, 255, 255, 0.9)',
  revive: '#4cd964',
  jam: '#ffd54a',
  overlay: 'rgba(0, 0, 0, 0.6)',
  button: '#2a3139',
  buttonEdge: '#5c6773',
  buttonText: '#f2f2f2',
  pausedBanner: 'rgba(14, 17, 22, 0.75)',
} as const;

export const SIDE_COLOUR: Readonly<Record<Side, string>> = { blue: '#3d7bd6', red: '#d64545' };
export const SIDE_COLOUR_DIM: Readonly<Record<Side, string>> = { blue: '#2a4f85', red: '#7d2f2f' };
export const SIDE_NAME: Readonly<Record<Side, string>> = { blue: 'General Muddle', red: 'General Mayhem' };

export const CLASS_LETTER: Readonly<Record<SoldierClass, string>> = {
  gunner: 'G',
  launcher: 'L',
  chucker: 'C',
  scorcher: 'S',
  blaster: 'B',
};
export const CLASS_NAME: Readonly<Record<SoldierClass, string>> = {
  gunner: 'Gunner',
  launcher: 'Launcher',
  chucker: 'Chucker',
  scorcher: 'Scorcher',
  blaster: 'Blaster',
};
export const IMPACT_COLOUR: Readonly<Record<SoldierClass, string>> = {
  gunner: '#ffe66d',
  launcher: '#ff9f43',
  chucker: '#d8e39b',
  scorcher: '#ff8c28',
  blaster: '#ff6b4a',
};

/** Soldier drawing sizes, logical pixels. */
export const SOLDIER_DRAW = {
  radius: 12,
  downedRx: 15,
  downedRy: 7,
  ringRadius: 18,
  hpBarWidth: 30,
  hpBarHeight: 4,
  hpBarOffset: 20,
  cooldownBarHeight: 2,
  facingInset: 5,
  facingOutset: 4,
  letterFont: `bold 13px ${FONT_FAMILY}`,
  promptFont: `bold 14px ${FONT_FAMILY}`,
  ashRx: 14,
  ashRy: 9,
} as const;
