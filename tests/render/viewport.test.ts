import { describe, expect, it } from 'vitest';
import { clientToLogical, fitViewport } from '../../src/render/viewport';
import { createTopDownProjection } from '../../src/render/projection';
import { FIELD_HEIGHT, FIELD_WIDTH, LOGICAL_HEIGHT, LOGICAL_WIDTH, TOP_BAR_HEIGHT } from '../../src/render/renderConstants';

describe('renderConstants', () => {
  it('stacks the top bar, the field and the HUD', () => {
    expect(FIELD_WIDTH).toBe(1280);
    expect(FIELD_HEIGHT).toBe(704);
    expect(LOGICAL_WIDTH).toBe(FIELD_WIDTH);
    expect(LOGICAL_HEIGHT).toBeGreaterThan(TOP_BAR_HEIGHT + FIELD_HEIGHT);
  });
});

describe('fitViewport', () => {
  it('letterboxes a wide window by height', () => {
    const v = fitViewport(3000, 876, 1, 1280, 876);
    expect(v.scale).toBe(1);
    expect(v.cssWidth).toBe(1280);
    expect(v.cssHeight).toBe(876);
    expect(v.pixelWidth).toBe(1280);
  });
  it('letterboxes a tall window by width', () => {
    const v = fitViewport(640, 2000, 1, 1280, 876);
    expect(v.scale).toBe(0.5);
    expect(v.cssWidth).toBe(640);
    expect(v.cssHeight).toBe(438);
  });
  it('multiplies the backing store by devicePixelRatio', () => {
    const v = fitViewport(1280, 876, 2, 1280, 876);
    expect(v.scale).toBe(1);
    expect(v.pixelWidth).toBe(2560);
    expect(v.pixelHeight).toBe(1752);
  });
});

describe('clientToLogical', () => {
  it('maps a client point to logical canvas pixels through the scale and the canvas offset', () => {
    const v = fitViewport(640, 2000, 2, 1280, 876);
    const p = clientToLogical(v, 100 + 320, 50 + 219, 100, 50);
    expect(p.x).toBeCloseTo(640, 9);
    expect(p.y).toBeCloseTo(438, 9);
  });
});

describe('createTopDownProjection', () => {
  it('offsets by the top bar and round-trips', () => {
    const proj = createTopDownProjection(0, TOP_BAR_HEIGHT);
    const s = proj.worldToScreen(100, 200);
    expect(s).toEqual({ x: 100, y: 200 + TOP_BAR_HEIGHT });
    expect(proj.screenToWorld(s.x, s.y)).toEqual({ x: 100, y: 200 });
  });
});
