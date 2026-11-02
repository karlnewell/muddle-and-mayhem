/**
 * DOM listeners. Converts mouse buttons and client coordinates into the
 * logical canvas space the app understands, and forwards key names. The
 * context menu is suppressed on the canvas so the right button is free
 * for orders; Space and the slot keys are prevented from scrolling or
 * being typed.
 */
import type { Button } from './interpret';

export interface DomTarget {
  click(x: number, y: number, button: Button, shift: boolean): void;
  key(key: string, shift: boolean): boolean;
}

export interface Mapping {
  /** Client coordinates to logical canvas coordinates. */
  clientToLogical(clientX: number, clientY: number): { x: number; y: number };
}

export function attachInput(canvas: HTMLCanvasElement, target: DomTarget, mapping: Mapping): void {
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('mousedown', (e) => {
    const button: Button | null = e.button === 0 ? 'left' : e.button === 2 ? 'right' : null;
    if (button === null) {
      return;
    }
    e.preventDefault();
    const p = mapping.clientToLogical(e.clientX, e.clientY);
    target.click(p.x, p.y, button, e.shiftKey);
  });
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) {
      return;
    }
    if (target.key(e.key, e.shiftKey) || e.key === ' ') {
      e.preventDefault();
    }
  });
}
