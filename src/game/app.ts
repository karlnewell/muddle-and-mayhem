/**
 * The game: screens, the current battle session, the player's selection,
 * visual effects, and the frame function. DOM-free so it can be driven by
 * tests and by the debug hook; `main.ts` and `input/dom.ts` feed it
 * logical canvas coordinates and key names, and give it a context to draw
 * into. It never writes to simulation state: every action becomes a
 * `Command` queued on the session.
 */
import { interpretClick, interpretKey } from '../input/interpret';
import type { Button, InputResult } from '../input/interpret';
import { SLOT_KEYS } from '../input/keys';
import { effectsFromEvents, pruneEffects } from '../render/effects';
import type { Effect } from '../render/effects';
import { PALETTE } from '../render/palette';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../render/renderConstants';
import { createTopDownRenderer } from '../render/renderer';
import type { BattleRenderer } from '../render/renderer';
import type { Side } from '../sim';
import { hitButton } from '../ui/buttons';
import { drawHud, hudCardRects } from '../ui/hud';
import { drawMenu, menuButtons } from '../ui/menu';
import { drawResult, resultButtons } from '../ui/result';
import { INITIAL_SCREEN, reduceScreen } from '../ui/screens';
import type { ScreenEvent, ScreenState } from '../ui/screens';
import { drawTitle } from '../ui/title';
import { nextSeed } from './seed';
import type { SeedChoice } from './seed';
import { createSession } from './session';
import type { BattleSession } from './session';

export const PLAYER_SIDE: Side = 'blue';

export interface App {
  readonly renderer: BattleRenderer;
  readonly screen: ScreenState;
  readonly session: BattleSession | null;
  readonly selection: readonly number[];
  readonly seedChoice: SeedChoice;
  /** Advance time and draw. `nowMs` is a monotonic clock in milliseconds. */
  frame(ctx: CanvasRenderingContext2D, nowMs: number): void;
  /** A mouse button pressed at logical canvas coordinates. */
  click(x: number, y: number, button: Button, shift: boolean): void;
  /** A key pressed (`KeyboardEvent.key`). Returns true when the key was used. */
  key(key: string, shift: boolean): boolean;
  /** Step the current battle `n` ticks right now, pause or not (debug and tests). */
  advanceTicks(n: number): void;
}

export function createApp(initialSeed: SeedChoice, random: () => number): App {
  const renderer = createTopDownRenderer();
  let screen: ScreenState = INITIAL_SCREEN;
  let session: BattleSession | null = null;
  let selection: number[] = [];
  let effects: Effect[] = [];
  let seedChoice = initialSeed;
  let lastNow: number | null = null;

  function startBattle(seed: SeedChoice): void {
    seedChoice = seed;
    session = createSession(seed.seed);
    selection = [];
    effects = [];
    lastNow = null;
  }

  function dispatch(e: ScreenEvent): void {
    const next = reduceScreen(screen, e);
    if (next === screen) {
      return;
    }
    screen = next;
    if (e === 'start') {
      startBattle(seedChoice);
    } else if (e === 'restart' || e === 'playAgain') {
      startBattle(e === 'restart' ? seedChoice : nextSeed(seedChoice, random));
    } else if (e === 'toTitle') {
      session = null;
      selection = [];
      effects = [];
      if (!seedChoice.fixed) {
        seedChoice = nextSeed(seedChoice, random);
      }
    }
  }

  function applyInput(result: InputResult): void {
    if (session === null) {
      return;
    }
    selection = result.selection;
    for (const cmd of result.commands) {
      session.queue(cmd);
    }
    if (result.togglePause) {
      session.paused = !session.paused;
    }
    if (result.toggleMenu) {
      dispatch('toggleMenu');
    }
  }

  function absorbEvents(): void {
    if (session === null) {
      return;
    }
    // events from the ticks just stepped are already drained into effects by the caller
    if (session.state.winner !== null && screen.screen === 'battle') {
      dispatch('battleEnded');
    }
  }

  function stepTicks(n: number): void {
    if (session === null) {
      return;
    }
    for (let i = 0; i < n && session.state.winner === null; i++) {
      const events = session.stepOnce();
      effects = effects.concat(effectsFromEvents(events, session.state.tick - 1));
    }
    effects = pruneEffects(effects, session.state.tick);
    absorbEvents();
  }

  function battleClick(x: number, y: number, button: Button, shift: boolean): void {
    if (session === null) {
      return;
    }
    if (screen.menuOpen) {
      if (button !== 'left') {
        return;
      }
      const id = hitButton(menuButtons(), x, y);
      if (id === 'resume') {
        dispatch('closeMenu');
      } else if (id === 'restart') {
        dispatch('restart');
      } else if (id === 'title') {
        dispatch('toTitle');
      }
      return;
    }
    if (renderer.onField(x, y)) {
      const w = renderer.projection.screenToWorld(x, y);
      applyInput(interpretClick(session.state, selection, button, w.x, w.y, shift, PLAYER_SIDE));
      return;
    }
    if (button === 'left') {
      const id = hitButton(hudCardRects(), x, y);
      if (id !== null && id.startsWith('slot')) {
        const slot = Number(id.slice(4));
        applyInput(interpretKey(session.state, selection, SLOT_KEYS[slot], shift, PLAYER_SIDE));
      }
    }
  }

  function resultClick(x: number, y: number, button: Button): void {
    if (button !== 'left') {
      return;
    }
    const id = hitButton(resultButtons(), x, y);
    if (id === 'playAgain') {
      dispatch('playAgain');
    } else if (id === 'title') {
      dispatch('toTitle');
    }
  }

  function draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = PALETTE.pageBackground;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    if (screen.screen === 'title' || session === null) {
      drawTitle(ctx);
      return;
    }
    const state = session.state;
    renderer.draw(ctx, state, { selection, alpha: session.alpha(), effects, playerSide: PLAYER_SIDE, pending: session.pending });
    drawHud(ctx, state, { playerSide: PLAYER_SIDE, selection, paused: session.paused });
    if (screen.screen === 'result') {
      drawResult(ctx, state, PLAYER_SIDE);
    } else if (screen.menuOpen) {
      drawMenu(ctx);
    }
  }

  return {
    renderer,
    get screen() {
      return screen;
    },
    get session() {
      return session;
    },
    get selection() {
      return selection;
    },
    get seedChoice() {
      return seedChoice;
    },
    frame(ctx: CanvasRenderingContext2D, nowMs: number): void {
      const dt = lastNow === null ? 0 : nowMs - lastNow;
      lastNow = nowMs;
      if (session !== null && screen.screen === 'battle' && !screen.menuOpen) {
        const before = session.state.tick;
        const events = session.advance(dt);
        if (session.state.tick !== before) {
          // Events are stamped with the last stepped tick so their lifetimes line up with the clock.
          effects = effects.concat(effectsFromEvents(events, session.state.tick - 1));
        }
        effects = pruneEffects(effects, session.state.tick);
        absorbEvents();
      }
      draw(ctx);
    },
    click(x: number, y: number, button: Button, shift: boolean): void {
      if (screen.screen === 'title') {
        if (button === 'left') {
          dispatch('start');
        }
        return;
      }
      if (screen.screen === 'result') {
        resultClick(x, y, button);
        return;
      }
      battleClick(x, y, button, shift);
    },
    key(key: string, shift: boolean): boolean {
      if (screen.screen !== 'battle' || session === null) {
        return false;
      }
      if (screen.menuOpen) {
        if (key === 'Escape') {
          dispatch('closeMenu');
          return true;
        }
        return false;
      }
      const result = interpretKey(session.state, selection, key, shift, PLAYER_SIDE);
      const used = result.commands.length > 0 || result.togglePause === true || result.toggleMenu === true || !sameIds(result.selection, selection);
      applyInput(result);
      return used;
    },
    advanceTicks(n: number): void {
      stepTicks(n);
    },
  };
}

function sameIds(a: readonly number[], b: readonly number[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}
