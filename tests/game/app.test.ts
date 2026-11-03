import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/game/app';
import { resultButtons } from '../../src/ui/result';

const FIXED = { seed: 7, fixed: true };
const never = () => 0.5;

/** A finished battle on the result screen, with a copy stub that records what it was given. */
function finished(copyResult: boolean) {
  const copied: string[] = [];
  const app = createApp(FIXED, never, {
    copyText: (text) => {
      copied.push(text);
      return Promise.resolve(copyResult);
    },
  });
  app.click(10, 10, 'left', false); // title: any click starts
  app.advanceTicks(30 * 600);
  expect(app.screen.screen).toBe('result');
  return { app, copied };
}

function centre(id: string): [number, number] {
  const b = resultButtons('idle').find((x) => x.id === id)!;
  return [b.x + b.w / 2, b.y + b.h / 2];
}

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe('app report', () => {
  it('has no report before a battle', () => {
    const app = createApp(FIXED, never, {});
    expect(app.report()).toBeNull();
  });
  it('reports the finished battle as Markdown with the seed and the log', () => {
    const { app } = finished(true);
    const md = app.report()!;
    expect(md).toContain('Seed: 7');
    expect(md).toContain('| blue | Gunner |');
    expect(md).toContain('"side":"red"');
  });
  it('Copy report hands the Markdown to copyText once and shows Copied on success', async () => {
    const { app, copied } = finished(true);
    expect(app.copyState).toBe('idle');
    app.click(...centre('copyReport'), 'left', false);
    await settle();
    expect(copied).toEqual([app.report()]);
    expect(app.copyState).toBe('copied');
  });
  it('shows the fallback label when the clipboard was not available', async () => {
    const { app } = finished(false);
    app.click(...centre('copyReport'), 'left', false);
    await settle();
    expect(app.copyState).toBe('shown');
  });
  it('Play again resets the copy state and the report', async () => {
    const { app } = finished(true);
    app.click(...centre('copyReport'), 'left', false);
    await settle();
    app.click(...centre('playAgain'), 'left', false);
    expect(app.screen.screen).toBe('battle');
    expect(app.copyState).toBe('idle');
    expect(app.report()).toContain('Seed: 8');
  });
  it('defaults to the fallback when no copyText is given', async () => {
    const app = createApp(FIXED, never, {});
    app.click(10, 10, 'left', false);
    app.advanceTicks(30 * 600);
    app.click(...centre('copyReport'), 'left', false);
    await settle();
    expect(app.copyState).toBe('shown');
  });
});

describe('app volley key', () => {
  it('A with the cursor over an enemy queues one stand-fast attack for the whole standing squad', () => {
    const app = createApp(FIXED, never, {});
    app.click(10, 10, 'left', false);
    const enemy = app.session!.state.soldiers[7];
    const p = app.renderer.projection.worldToScreen(enemy.x, enemy.y);
    expect(app.key('a', false, p)).toBe(true);
    expect(app.session!.pending).toEqual([{ tick: 0, side: 'blue', type: 'attack', soldierIds: [0, 1, 2, 3, 4], targetId: 7, stand: true }]);
    expect(app.selection).toEqual([]);
  });
  it('A without a cursor position is not used', () => {
    const app = createApp(FIXED, never, {});
    app.click(10, 10, 'left', false);
    expect(app.key('a', false)).toBe(false);
    expect(app.session!.pending).toEqual([]);
  });
});

describe('volley cue', () => {
  it('starts when A is pressed while paused, covering the squad and the enemy nearest the cursor', () => {
    const app = createApp(FIXED, never, {});
    app.click(10, 10, 'left', false);
    expect(app.volleyCue).toBeNull();
    const target = app.session!.state.soldiers[8];
    const at = app.renderer.projection.worldToScreen(target.x, target.y);
    expect(app.key('a', false, at)).toBe(true);
    expect(app.session!.paused).toBe(true);
    expect(app.volleyCue).toEqual({ soldierIds: [0, 1, 2, 3, 4], targetId: 8, startMs: null });
  });
});
