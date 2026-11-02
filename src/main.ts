/**
 * Entry point: the canvas, the viewport that fits it to the window, the
 * app, DOM input, the debug hook, and the requestAnimationFrame loop.
 * Everything else is DOM-free and lives in src/game, src/render,
 * src/input and src/ui.
 */
import { createApp } from './game/app';
import { createDebugHook, installDebugHook } from './game/debug';
import { seedFromSearch } from './game/seed';
import { applyTune } from './game/tuning';
import { debugFromSearch } from './game/urlFlags';
import { attachInput } from './input/dom';
import { LOGICAL_HEIGHT, LOGICAL_WIDTH } from './render/renderConstants';
import { clientToLogical, fitViewport, logicalToClientOffset } from './render/viewport';
import { showTextOverlay } from './ui/textOverlay';
import type { Viewport } from './render/viewport';

function findCanvas(): HTMLCanvasElement {
  const el = document.getElementById('game');
  if (!(el instanceof HTMLCanvasElement)) {
    throw new Error('canvas not found');
  }
  return el;
}
const canvas = findCanvas();
const context = canvas.getContext('2d');
if (!context) {
  throw new Error('2d context not available');
}
const ctx: CanvasRenderingContext2D = context;

// Overrides go in before the app, and so before any battle, exists.
const tuning = applyTune(window.location.search);
const app = createApp(seedFromSearch(window.location.search, Math.random), Math.random, {
  debugOverlay: debugFromSearch(window.location.search),
  tuning,
  async copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      showTextOverlay(text);
      return false;
    }
  },
});

let viewport: Viewport = fitViewport(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1, LOGICAL_WIDTH, LOGICAL_HEIGHT);

function resize(): void {
  viewport = fitViewport(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1, LOGICAL_WIDTH, LOGICAL_HEIGHT);
  canvas.width = viewport.pixelWidth;
  canvas.height = viewport.pixelHeight;
  canvas.style.width = `${viewport.cssWidth}px`;
  canvas.style.height = `${viewport.cssHeight}px`;
}
window.addEventListener('resize', resize);
resize();

attachInput(canvas, app, {
  clientToLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    return clientToLogical(viewport, clientX, clientY, rect.left, rect.top);
  },
});

installDebugHook(
  createDebugHook(app, (x, y) => {
    const rect = canvas.getBoundingClientRect();
    const o = logicalToClientOffset(viewport, x, y);
    return { x: rect.left + o.x, y: rect.top + o.y };
  }),
);

function frame(now: number): void {
  ctx.setTransform(viewport.pixelWidth / LOGICAL_WIDTH, 0, 0, viewport.pixelHeight / LOGICAL_HEIGHT, 0, 0);
  app.frame(ctx, now);
  window.requestAnimationFrame(frame);
}
window.requestAnimationFrame(frame);
