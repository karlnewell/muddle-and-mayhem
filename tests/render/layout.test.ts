import { describe, expect, it } from 'vitest';
import { FIELD_HEIGHT, FIELD_WIDTH, LOGICAL_HEIGHT, LOGICAL_WIDTH, SIDE_PANEL_WIDTH, TOP_BAR_HEIGHT, battleLayout } from '../../src/render/renderConstants';
import { createTopDownRenderer } from '../../src/render/renderer';

describe('battle layout', () => {
  it('is a 1032 by 520 canvas: the top bar, then the 200-wide side panel beside the 832 by 480 field', () => {
    expect(FIELD_WIDTH).toBe(832);
    expect(FIELD_HEIGHT).toBe(480);
    expect(SIDE_PANEL_WIDTH).toBe(200);
    expect(LOGICAL_WIDTH).toBe(1032);
    expect(LOGICAL_HEIGHT).toBe(520);
    expect(TOP_BAR_HEIGHT).toBe(40);
  });

  it('puts the side panel on the player side of the field', () => {
    expect(battleLayout('blue')).toEqual({ panelX: 0, fieldX: 200, top: 40 });
    expect(battleLayout('red')).toEqual({ panelX: 832, fieldX: 0, top: 40 });
  });

  it('projects the field beside the panel, so picking follows', () => {
    const blue = createTopDownRenderer('blue');
    expect(blue.projection.worldToScreen(0, 0)).toEqual({ x: 200, y: 40 });
    expect(blue.projection.screenToWorld(616, 280)).toEqual({ x: 416, y: 240 });
    expect(blue.onField(199, 100)).toBe(false);
    expect(blue.onField(200, 40)).toBe(true);
    expect(blue.onField(1031, 519)).toBe(true);
    expect(blue.onField(500, 39)).toBe(false);
    const red = createTopDownRenderer('red');
    expect(red.projection.worldToScreen(0, 0)).toEqual({ x: 0, y: 40 });
    expect(red.onField(831, 100)).toBe(true);
    expect(red.onField(832, 100)).toBe(false);
  });
});
