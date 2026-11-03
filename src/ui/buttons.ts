/**
 * Canvas buttons: a rectangle with an id and a label. Screens lay them out,
 * draw them, and ask `hitButton` which one a click landed on.
 */
/** A rectangle in logical canvas pixels. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ButtonRect extends Rect {
  id: string;
  label: string;
}

export function hitButton(buttons: readonly ButtonRect[], x: number, y: number): string | null {
  for (const b of buttons) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) {
      return b.id;
    }
  }
  return null;
}

/** Vertically stacked, horizontally centred buttons. */
export function stackButtons(
  items: readonly { id: string; label: string }[],
  centreX: number,
  top: number,
  w: number,
  h: number,
  gap: number,
): ButtonRect[] {
  return items.map((item, i) => ({ id: item.id, label: item.label, x: centreX - w / 2, y: top + i * (h + gap), w, h }));
}
