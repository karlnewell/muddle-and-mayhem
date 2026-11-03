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
import { MENU_KEY, SLOT_KEYS } from '../input/keys';
import { effectsFromEvents, pruneEffects } from '../render/effects';
import type { Effect } from '../render/effects';
import { PALETTE } from '../render/palette';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from '../render/renderConstants';
import { createTopDownRenderer } from '../render/renderer';
import { startVolleyCue, volleyCueFromCommands, volleyCueProgress } from '../render/volleyCue';
import type { VolleyCue } from '../render/volleyCue';
import type { BattleRenderer } from '../render/renderer';
import { hashState } from '../sim';
import type { Side } from '../sim';
import { formatReportMarkdown, formatReportRows } from '../stats/reportText';
import { hitButton } from '../ui/buttons';
import { drawDebugOverlay } from '../ui/debugOverlay';
import { drawHud, hudCardRects } from '../ui/hud';
import { drawMenu, menuButtons } from '../ui/menu';
import { drawResult, resultButtons } from '../ui/result';
import type { CopyState } from '../ui/result';
import { INITIAL_SCREEN, reduceScreen } from '../ui/screens';
import type { ScreenEvent, ScreenState } from '../ui/screens';
import { drawTitle } from '../ui/title';
import { nextSeed } from './seed';
import type { SeedChoice } from './seed';
import { createSession } from './session';
import type { BattleSession } from './session';
import { FULL_SPEED } from './speed';
import type { SpeedStatus } from './speed';
import { NO_TUNING } from './tuning';
import type { TuneStatus } from './tuning';

export const PLAYER_SIDE: Side = 'blue';

export interface AppOptions {
  /** Start with the debug overlay showing (`?debug=1`). */
  debugOverlay?: boolean;
  /** The `?tune=` status, already applied by the caller; shown as the TUNED badge and in the overlay. */
  tuning?: TuneStatus;
  /** The `?speed=` status: the factor every battle's stepper scales real time by, shown as the SPEED badge. */
  speed?: SpeedStatus;
  /**
   * Put the report text where the player can take it: resolve true when the
   * clipboard took it, false when it was shown another way (the DOM fallback).
   * Absent means no clipboard: the button reports `shown`.
   */
  copyText?: (text: string) => Promise<boolean>;
}

export interface App {
  readonly renderer: BattleRenderer;
  readonly screen: ScreenState;
  readonly session: BattleSession | null;
  readonly selection: readonly number[];
  readonly seedChoice: SeedChoice;
  /** True while the debug overlay is drawn over the battlefield. */
  readonly debugOverlay: boolean;
  /** The `?tune=` overrides in force, if any, and any parse error. */
  readonly tuning: TuneStatus;
  /** The `?speed=` factor in force and any parse error. */
  readonly speed: SpeedStatus;
  /** What the Copy report button says about its last press. */
  readonly copyState: CopyState;
  /** The volley cue waiting or showing, or null. */
  readonly volleyCue: VolleyCue | null;
  /** The Markdown battle report for the current battle, or null before one. */
  report(): string | null;
  /** Advance time and draw. `nowMs` is a monotonic clock in milliseconds. */
  frame(ctx: CanvasRenderingContext2D, nowMs: number): void;
  /** A mouse button pressed at logical canvas coordinates. */
  click(x: number, y: number, button: Button, shift: boolean): void;
  /**
   * A key pressed (`KeyboardEvent.key`), with the pointer's last logical canvas
   * position if it has been over the canvas (the volley aims there). Returns
   * true when the key was used.
   */
  key(key: string, shift: boolean, cursor?: { x: number; y: number } | null): boolean;
  /** Step the current battle `n` ticks right now, pause or not (debug and tests). */
  advanceTicks(n: number): void;
}

export function createApp(initialSeed: SeedChoice, random: () => number, options: AppOptions = {}): App {
  const renderer = createTopDownRenderer();
  let debugOverlay = options.debugOverlay === true;
  const tuning = options.tuning ?? NO_TUNING;
  const speed = options.speed ?? FULL_SPEED;
  const copyText = options.copyText ?? (() => Promise.resolve(false));
  let copyState: CopyState = 'idle';
  let screen: ScreenState = INITIAL_SCREEN;
  let session: BattleSession | null = null;
  let selection: number[] = [];
  let effects: Effect[] = [];
  let volleyCue: VolleyCue | null = null;
  let seedChoice = initialSeed;
  let lastNow: number | null = null;

  function startBattle(seed: SeedChoice): void {
    seedChoice = seed;
    session = createSession(seed.seed, tuning.overrides, speed.speed);
    selection = [];
    effects = [];
    volleyCue = null;
    lastNow = null;
    copyState = 'idle';
  }

  function report(): string | null {
    return session === null ? null : formatReportMarkdown(session.stats(), session.log, speed.speed);
  }

  /** Hand the report to the clipboard callback; the label follows the outcome, and a stale battle's answer is ignored. */
  function copyReport(): void {
    const text = report();
    const owner = session;
    if (text === null) {
      return;
    }
    copyText(text).then(
      (ok) => {
        if (session === owner) {
          copyState = ok ? 'copied' : 'shown';
        }
      },
      () => {
        if (session === owner) {
          copyState = 'shown';
        }
      },
    );
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
      volleyCue = null;
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
    volleyCue = volleyCueFromCommands(result.commands, PLAYER_SIDE) ?? volleyCue;
    if (result.togglePause) {
      session.paused = !session.paused;
    }
    if (result.toggleMenu) {
      dispatch('toggleMenu');
    }
    if (result.toggleDebug) {
      debugOverlay = !debugOverlay;
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
    const id = hitButton(resultButtons(copyState), x, y);
    if (id === 'playAgain') {
      dispatch('playAgain');
    } else if (id === 'copyReport') {
      copyReport();
    } else if (id === 'title') {
      dispatch('toTitle');
    }
  }

  /** Stamp a fresh volley cue with this frame's time and drop it once over; returns what to draw. */
  function volleyView(nowMs: number) {
    if (volleyCue === null) {
      return null;
    }
    volleyCue = startVolleyCue(volleyCue, nowMs);
    const progress = volleyCueProgress(volleyCue, nowMs);
    const view = { cue: volleyCue, progress, side: PLAYER_SIDE };
    if (progress >= 1) {
      volleyCue = null;
    }
    return view;
  }

  function draw(ctx: CanvasRenderingContext2D, nowMs: number): void {
    ctx.fillStyle = PALETTE.pageBackground;
    ctx.fillRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    if (screen.screen === 'title' || session === null) {
      drawTitle(ctx);
      return;
    }
    const state = session.state;
    renderer.draw(ctx, state, { selection, alpha: session.alpha(), effects, playerSide: PLAYER_SIDE, pending: session.pending, volley: volleyView(nowMs) });
    drawHud(ctx, state, { playerSide: PLAYER_SIDE, selection, paused: session.paused, tuned: tuning.active, speed: speed.speed });
    if (screen.screen === 'result') {
      drawResult(ctx, state, PLAYER_SIDE, { rows: formatReportRows(session.stats()), copyState });
    } else if (screen.menuOpen) {
      drawMenu(ctx);
    }
    if (debugOverlay) {
      // Drawn last so it stays readable over the menu and result panels.
      drawDebugOverlay(ctx, state, { seed: session.seed, paused: session.paused, hash: hashState(state), tuning, speed });
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
    get debugOverlay() {
      return debugOverlay;
    },
    get tuning() {
      return tuning;
    },
    get speed() {
      return speed;
    },
    get copyState() {
      return copyState;
    },
    get volleyCue() {
      return volleyCue;
    },
    report,
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
      draw(ctx, nowMs);
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
    key(key: string, shift: boolean, cursor: { x: number; y: number } | null = null): boolean {
      if (screen.screen === 'title' || session === null) {
        return false;
      }
      if (screen.screen === 'result' || screen.menuOpen) {
        // Orders are off while the menu or the result panel is up; Escape closes the menu and D still toggles the overlay.
        if (screen.menuOpen && key === MENU_KEY) {
          dispatch('closeMenu');
          return true;
        }
        if (interpretKey(session.state, selection, key, shift, PLAYER_SIDE).toggleDebug === true) {
          debugOverlay = !debugOverlay;
          return true;
        }
        return false;
      }
      const world = cursor === null ? null : renderer.projection.screenToWorld(cursor.x, cursor.y);
      const result = interpretKey(session.state, selection, key, shift, PLAYER_SIDE, world);
      const used =
        result.commands.length > 0 ||
        result.togglePause === true ||
        result.toggleMenu === true ||
        result.toggleDebug === true ||
        !sameIds(result.selection, selection);
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
