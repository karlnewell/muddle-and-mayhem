/**
 * DOM listeners. Converts mouse buttons and client coordinates into the
 * logical canvas space the app understands, and forwards key names with
 * the pointer's last position over the canvas (the volley aims there). The
 * context menu is suppressed on the canvas so the right button is free
 * for orders; Space and the slot keys are prevented from scrolling or
 * being typed.
 */
import type { Button } from './interpret';
import { keyFromEvent } from './keys';

export interface DomTarget {
  click(x: number, y: number, button: Button, shift: boolean): void;
  /** `cursor` is the pointer's last logical position over the canvas, or null before it has been there. */
  key(key: string, shift: boolean, cursor: { x: number; y: number } | null): boolean;
}

export interface Mapping {
  /** Client coordinates to logical canvas coordinates. */
  clientToLogical(clientX: number, clientY: number): { x: number; y: number };
}

export function attachInput(canvas: HTMLCanvasElement, target: DomTarget, mapping: Mapping): void {
  let cursor: { x: number; y: number } | null = null;
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('mousemove', (e) => {
    cursor = mapping.clientToLogical(e.clientX, e.clientY);
  });
  canvas.addEventListener('mousedown', (e) => {
    const button: Button | null = e.button === 0 ? 'left' : e.button === 2 ? 'right' : null;
    if (button === null) {
      return;
    }
    e.preventDefault();
    const p = mapping.clientToLogical(e.clientX, e.clientY);
    cursor = p;
    target.click(p.x, p.y, button, e.shiftKey);
  });
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) {
      return;
    }
    const key = keyFromEvent(e.code, e.key);
    if (target.key(key, e.shiftKey, cursor) || key === ' ') {
      e.preventDefault();
    }
  });
}
