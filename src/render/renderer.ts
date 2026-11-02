/**
 * The battlefield renderer behind a small interface. `createTopDownRenderer`
 * draws the world at one logical pixel per unit below the top bar; an
 * isometric renderer would implement the same `BattleRenderer` with its own
 * projection and draw modules, and nothing in input, HUD or app changes.
 */
import type { BattleState, Command, Side } from '../sim';
import { drawEffects } from './drawEffects';
import { drawMap } from './drawMap';
import { drawMedics, drawProjectiles } from './drawProjectiles';
import { drawPendingOrders, drawSoldiers } from './drawSoldiers';
import type { Effect } from './effects';
import { createTopDownProjection } from './projection';
import type { Projection } from './projection';
import { FIELD_HEIGHT, FIELD_WIDTH, TOP_BAR_HEIGHT } from './renderConstants';

export interface ViewState {
  selection: readonly number[];
  alpha: number;
  effects: readonly Effect[];
  playerSide: Side;
  /** Player commands queued for the next tick, drawn as ghost orders. */
  pending: readonly Command[];
}

export interface BattleRenderer {
  readonly projection: Projection;
  /** True when a logical canvas point lies on the battlefield. */
  onField(sx: number, sy: number): boolean;
  draw(ctx: CanvasRenderingContext2D, state: BattleState, view: ViewState): void;
}

export function createTopDownRenderer(): BattleRenderer {
  const projection = createTopDownProjection(0, TOP_BAR_HEIGHT);
  return {
    projection,
    onField(sx: number, sy: number): boolean {
      const w = projection.screenToWorld(sx, sy);
      return w.x >= 0 && w.y >= 0 && w.x < FIELD_WIDTH && w.y < FIELD_HEIGHT;
    },
    draw(ctx: CanvasRenderingContext2D, state: BattleState, view: ViewState): void {
      const origin = projection.worldToScreen(0, 0);
      ctx.save();
      ctx.translate(origin.x, origin.y);
      ctx.beginPath();
      ctx.rect(0, 0, FIELD_WIDTH, FIELD_HEIGHT);
      ctx.clip();
      drawMap(ctx, state.map);
      drawMedics(ctx, state, view.alpha);
      drawPendingOrders(ctx, state, view.pending, view.alpha);
      drawSoldiers(ctx, state, { selection: view.selection, alpha: view.alpha, playerSide: view.playerSide });
      drawProjectiles(ctx, state, view.alpha);
      drawEffects(ctx, state, view.effects, view.alpha);
      ctx.restore();
    },
  };
}
