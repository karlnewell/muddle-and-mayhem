import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { resultButtons } from '../src/ui/result';

// Plays a few seconds of a battle through the real page: title, start,
// select, move, attack, unpause, then fast-forwards to the result. The seed
// is fixed so the battle is the same on every run; the debug hook
// (window.__mm) reads state the canvas alone cannot expose.

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
  });
  return errors;
}

async function soldierClient(page: Page, id: number): Promise<{ x: number; y: number }> {
  return page.evaluate((soldierId) => {
    const mm = window.__mm!;
    const state = mm.state as { soldiers: { id: number; x: number; y: number }[] };
    const s = state.soldiers.find((e) => e.id === soldierId)!;
    return mm.worldToClient(s.x, s.y);
  }, id);
}

async function hudPixels(page: Page): Promise<string> {
  return page.locator('canvas#game').evaluate((c: HTMLCanvasElement) => {
    const ctx = c.getContext('2d')!;
    // the bottom fifth of the canvas is the HUD
    const y = Math.floor(c.height * 0.85);
    const d = ctx.getImageData(0, y, c.width, c.height - y).data;
    let hash = 2166136261;
    for (let i = 0; i < d.length; i += 16) hash = Math.imul(hash ^ d[i], 16777619);
    return String(hash >>> 0);
  });
}

test('a battle can be started, ordered, run, and finished', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./?seed=7');
  await expect(page).toHaveTitle('Muddle & Mayhem');
  const canvas = page.locator('canvas#game');
  await expect(canvas).toBeVisible();
  await page.waitForFunction(() => window.__mm !== undefined && window.__mm.screen === 'title');

  // Title: any click starts a paused battle at tick 0.
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() => window.__mm!.screen === 'battle');
  expect(await page.evaluate(() => [window.__mm!.tick, window.__mm!.paused, window.__mm!.seed])).toEqual([0, true, 7]);

  // Left click blue soldier 0 selects it; right click on open ground queues a move.
  const pip = await soldierClient(page, 0);
  await page.mouse.click(pip.x, pip.y);
  expect(await page.evaluate(() => [...window.__mm!.selection])).toEqual([0]);
  const ground = await page.evaluate(() => window.__mm!.worldToClient(480, 320));
  await page.mouse.click(ground.x, ground.y, { button: 'right' });

  // Slot key 2 selects Bert; right click on a red soldier queues an attack.
  await page.keyboard.press('2');
  expect(await page.evaluate(() => [...window.__mm!.selection])).toEqual([1]);
  await page.keyboard.press('Shift+3');
  expect(await page.evaluate(() => [...window.__mm!.selection])).toEqual([1, 2]);
  await page.keyboard.press('2');
  const grub = await soldierClient(page, 5);
  await page.mouse.click(grub.x, grub.y, { button: 'right' });
  const pending = await page.evaluate(() => (window.__mm!.pending as { type: string }[]).map((c) => c.type));
  expect(pending).toEqual(['select', 'move', 'select', 'select', 'select', 'attack']);

  // Still paused: nothing has ticked.
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__mm!.tick)).toBe(0);

  // Space unpauses; the sim ticks at 30 Hz and the HUD changes.
  const hudBefore = await hudPixels(page);
  await page.keyboard.press(' ');
  await page.waitForFunction(() => window.__mm!.tick >= 30, undefined, { timeout: 5000 });
  // the PAUSED badge is gone and the clock has moved, so the HUD differs from the paused frame
  expect(await hudPixels(page)).not.toBe(hudBefore);
  const log = await page.evaluate(() => (window.__mm!.log as { type: string; side: string }[]));
  expect(log.filter((c) => c.side === 'blue').map((c) => c.type)).toEqual(['select', 'move', 'select', 'select', 'select', 'attack']);
  expect(log.some((c) => c.side === 'red')).toBe(true);
  expect(await page.evaluate(() => window.__mm!.replayMatches())).toBe(true);

  // Pause again, then fast-forward to the end of the battle.
  await page.keyboard.press(' ');
  await page.waitForTimeout(100);
  const paused = await page.evaluate(() => [window.__mm!.paused, window.__mm!.tick]);
  expect(paused[0]).toBe(true);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.__mm!.tick)).toBe(paused[1]);

  await page.evaluate(() => window.__mm!.advanceTicks(30 * 600));
  await page.waitForFunction(() => window.__mm!.screen === 'result');
  const outcome = await page.evaluate(() => [window.__mm!.winner, window.__mm!.replayMatches()]);
  expect(['blue', 'red', 'draw']).toContain(outcome[0]);
  expect(outcome[1]).toBe(true);

  // Esc does nothing on the result screen; Play again starts a fresh paused battle with the next seed.
  await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.__mm!.screen)).toBe('result');
  const playAgain = resultButtons('idle').find((b) => b.id === 'playAgain')!;
  const again = await page.evaluate(
    ([x, y]) => window.__mm!.logicalToClient(x, y),
    [playAgain.x + playAgain.w / 2, playAgain.y + playAgain.h / 2] as const,
  );
  await page.mouse.click(again.x, again.y);
  await page.waitForFunction(() => window.__mm!.screen === 'battle' && window.__mm!.tick === 0);
  expect(await page.evaluate(() => [window.__mm!.seed, window.__mm!.paused])).toEqual([8, true]);

  // Esc opens the menu and freezes the clock even when unpaused; Title returns home.
  await page.keyboard.press(' ');
  await page.waitForFunction(() => window.__mm!.tick > 0);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => window.__mm!.menuOpen);
  const frozen = await page.evaluate(() => window.__mm!.tick);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => window.__mm!.tick)).toBe(frozen);

  expect(errors).toEqual([]);
});

test('A volleys the whole squad at the enemy under the cursor and S selects it', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./?seed=7');
  await page.waitForFunction(() => window.__mm !== undefined && window.__mm.screen === 'title');
  const box = (await page.locator('canvas#game').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() => window.__mm!.screen === 'battle');

  // Nothing selected: the volley still orders every standing soldier to stand fast, and waits in pending while paused.
  const target = await soldierClient(page, 8);
  await page.mouse.move(target.x + 3, target.y + 2);
  await page.keyboard.press('a');
  expect(await page.evaluate(() => [...window.__mm!.selection])).toEqual([]);
  expect(await page.evaluate(() => window.__mm!.pending)).toEqual([
    { tick: 0, side: 'blue', type: 'attack', soldierIds: [0, 1, 2, 3, 4], targetId: 8, stand: true },
  ]);

  // S selects the whole squad.
  await page.keyboard.press('s');
  expect(await page.evaluate(() => [...window.__mm!.selection])).toEqual([0, 1, 2, 3, 4]);
  expect(errors).toEqual([]);
});
