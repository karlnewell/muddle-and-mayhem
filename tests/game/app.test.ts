import { describe, expect, it } from 'vitest';
import { createApp } from '../../src/game/app';
import type { ButtonRect } from '../../src/ui/buttons';
import { menuSpeedRects } from '../../src/ui/menu';
import { resultButtons } from '../../src/ui/result';
import { titleSpeedRects } from '../../src/ui/title';
import { hudCardRects, sidePanelRect } from '../../src/ui/hud';

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

const mid = (r: ButtonRect): [number, number] => [r.x + r.w / 2, r.y + r.h / 2];

describe('game speed choice', () => {
  it('starts at half speed when given nothing', () => {
    expect(createApp(FIXED, never, {}).speed).toEqual({ speed: 0.5, error: null });
  });
  it('a click on a title segment picks that speed and saves it without starting a battle', () => {
    const saved: number[] = [];
    const app = createApp(FIXED, never, { saveSpeed: (s) => saved.push(s) });
    app.click(...mid(titleSpeedRects()[2]), 'left', false);
    expect(app.screen.screen).toBe('title');
    expect(app.speed.speed).toBe(1);
    expect(saved).toEqual([1]);
    app.click(10, 10, 'left', false);
    expect(app.screen.screen).toBe('battle');
    expect(app.report()).toContain('- Speed: 1x');
  });
  it('Left and Right step the speed on the title screen, stopping at the ends', () => {
    const saved: number[] = [];
    const app = createApp(FIXED, never, { saveSpeed: (s) => saved.push(s) });
    expect(app.key('ArrowLeft', false)).toBe(true);
    expect(app.speed.speed).toBe(0.5);
    app.key('ArrowRight', false);
    app.key('ArrowRight', false);
    app.key('ArrowRight', false);
    expect(app.speed.speed).toBe(1);
    expect(saved).toEqual([0.75, 1]);
    expect(app.key('x', false)).toBe(false);
  });
  it('the Esc menu changes the speed of the battle in progress', () => {
    const app = createApp(FIXED, never, {});
    app.click(10, 10, 'left', false);
    app.key('Escape', false);
    expect(app.screen.menuOpen).toBe(true);
    app.click(...mid(menuSpeedRects()[1]), 'left', false);
    expect(app.speed.speed).toBe(0.75);
    expect(app.screen.menuOpen).toBe(true);
    app.key('ArrowRight', false);
    expect(app.speed.speed).toBe(1);
    // arrows are not speed keys during play
    app.key('Escape', false);
    app.key('ArrowLeft', false);
    expect(app.speed.speed).toBe(1);
  });
});

describe('side panel cards', () => {
  it('a click on a card selects that slot, shift-click adds, and a click below the cards selects nothing new', () => {
    const app = createApp(FIXED, never, {});
    app.click(10, 10, 'left', false);
    const cards = hudCardRects('blue');
    for (let i = 0; i < cards.length; i++) {
      app.click(...mid(cards[i]), 'left', false);
      expect(app.selection).toEqual([i]);
    }
    app.click(...mid(cards[0]), 'left', true);
    expect([...app.selection].sort()).toEqual([0, 4]);
    const panel = sidePanelRect('blue');
    const last = cards[cards.length - 1];
    app.click(panel.x + panel.w / 2, last.y + last.h + 10, 'left', false);
    expect([...app.selection].sort()).toEqual([0, 4]);
  });
});

describe('app report map', () => {
  it('names the map the battle ran on', () => {
    const { app } = finished(true);
    const md = app.report()!;
    expect(md).toContain('- Map: Compact Crossroads (`compact`)');
    expect(md).toContain('MAPS.compact)');
  });
});

describe('drag to select', () => {
  /** A paused battle with blue soldiers 0 and 1 at known screen points; the box corners sit 30 out, clear of the pick radius. */
  function battle() {
    const app = createApp(FIXED, never, {});
    app.click(10, 10, 'left', false);
    const [a, b] = [0, 1].map((id) => {
      const s = app.session!.state.soldiers[id];
      return app.renderer.projection.worldToScreen(s.x, s.y);
    });
    return { app, a, b };
  }
  const corners = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
    x0: Math.min(a.x, b.x) - 30,
    y0: Math.min(a.y, b.y) - 30,
    x1: Math.max(a.x, b.x) + 30,
    y1: Math.max(a.y, b.y) + 30,
  });

  it('a drag on empty ground selects the soldiers inside on release, while paused', () => {
    const { app, a, b } = battle();
    const box = corners(a, b);
    app.press(box.x0, box.y0, 'left', false);
    expect(app.dragBox).toBeNull();
    app.pointerMove(box.x1, box.y1);
    expect(app.dragBox).not.toBeNull();
    expect(app.selection).toEqual([]);
    app.release(box.x1, box.y1);
    expect(app.session!.paused).toBe(true);
    expect(app.dragBox).toBeNull();
    expect(app.selection).toEqual([0, 1]);
    expect(app.session!.pending.filter((c) => c.type === 'select')).toHaveLength(1);
  });
  it('a press on a friendly soldier selects it at once and starts no drag', () => {
    const { app, a } = battle();
    app.press(a.x, a.y, 'left', false);
    expect(app.selection).toEqual([0]);
    app.pointerMove(a.x + 60, a.y + 60);
    expect(app.dragBox).toBeNull();
    app.release(a.x + 60, a.y + 60);
    expect(app.selection).toEqual([0]);
  });
  it('a press and release without travel is a click on empty ground', () => {
    const { app, a } = battle();
    app.click(a.x, a.y, 'left', false);
    const ground = app.renderer.projection.worldToScreen(416, 240);
    app.press(ground.x, ground.y, 'left', false);
    expect(app.selection).toEqual([0]);
    app.release(ground.x + 1, ground.y);
    expect(app.selection).toEqual([]);
  });
  it('right press and presses off the field keep their click meaning', () => {
    const { app, a } = battle();
    app.click(a.x, a.y, 'left', false);
    const ground = app.renderer.projection.worldToScreen(416, 240);
    app.press(ground.x, ground.y, 'right', false);
    expect(app.session!.pending.map((c) => c.type)).toEqual(['select', 'move']);
    const card = hudCardRects('blue')[3];
    app.press(...mid(card), 'left', false);
    expect(app.selection).toEqual([3]);
    expect(app.dragBox).toBeNull();
  });
  it('a drag in progress is dropped when the menu opens', () => {
    const { app, a, b } = battle();
    const box = corners(a, b);
    app.press(box.x0, box.y0, 'left', false);
    app.pointerMove(box.x1, box.y1);
    app.key('Escape', false);
    app.release(box.x1, box.y1);
    expect(app.selection).toEqual([]);
  });
});
