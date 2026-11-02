/**
 * `window.__mm`: a read-mostly window onto the running game for the
 * Playwright test, for playtesting from the console, and for bug reports
 * (paste the seed and the log; `replayBattle` rebuilds the battle). Exposed
 * in every build on purpose; see docs/decisions.md.
 */
import { hashState } from '../sim';
import type { TuningOverrides, Vec2 } from '../sim';
import type { App } from './app';

export interface DebugHook {
  readonly seed: number;
  readonly tick: number;
  readonly paused: boolean;
  readonly winner: string | null;
  readonly screen: string;
  readonly menuOpen: boolean;
  /** True while the in-game debug overlay is drawn. */
  readonly debugOverlay: boolean;
  /** True while a `?tune=` override is in force. */
  readonly tuned: boolean;
  /** The overrides in force (empty when none), so a battle report can carry them. */
  readonly overrides: TuningOverrides;
  /** Why `?tune=` was rejected, or null. */
  readonly tuneError: string | null;
  readonly selection: readonly number[];
  readonly log: unknown;
  readonly pending: unknown;
  readonly state: unknown;
  hash(): number | null;
  replayMatches(): boolean | null;
  advanceTicks(n: number): void;
  /** Client (CSS pixel) coordinates of a world point, for synthetic clicks. */
  worldToClient(x: number, y: number): Vec2;
  /** Client coordinates of a logical canvas point. */
  logicalToClient(x: number, y: number): Vec2;
}

export function createDebugHook(app: App, logicalToClient: (x: number, y: number) => Vec2): DebugHook {
  return {
    get seed() {
      return app.session?.seed ?? app.seedChoice.seed;
    },
    get tick() {
      return app.session?.state.tick ?? 0;
    },
    get paused() {
      return app.session?.paused ?? true;
    },
    get winner() {
      return app.session?.state.winner ?? null;
    },
    get screen() {
      return app.screen.screen;
    },
    get menuOpen() {
      return app.screen.menuOpen;
    },
    get debugOverlay() {
      return app.debugOverlay;
    },
    get tuned() {
      return app.tuning.active;
    },
    get overrides() {
      return app.tuning.overrides;
    },
    get tuneError() {
      return app.tuning.error;
    },
    get selection() {
      return app.selection;
    },
    get log() {
      return app.session?.log ?? [];
    },
    get pending() {
      return app.session?.pending ?? [];
    },
    get state() {
      return app.session?.state ?? null;
    },
    hash() {
      return app.session === null ? null : hashState(app.session.state);
    },
    replayMatches() {
      return app.session === null ? null : app.session.replayMatches();
    },
    advanceTicks(n: number) {
      app.advanceTicks(n);
    },
    worldToClient(x: number, y: number) {
      const s = app.renderer.projection.worldToScreen(x, y);
      return logicalToClient(s.x, s.y);
    },
    logicalToClient,
  };
}

declare global {
  interface Window {
    __mm?: DebugHook;
  }
}

export function installDebugHook(hook: DebugHook): void {
  window.__mm = hook;
}
