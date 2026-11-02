import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { LOGICAL_WIDTH } from '../src/render/renderConstants';
import { tunedBadgeRect } from '../src/ui/hud';
import { resultButtons } from '../src/ui/result';

// Loads the game with a `tune` override and checks the three things a tuning
// session relies on: the override is in force and shown as the TUNED badge,
// the result screen carries the per-class report, and Copy report puts the
// same Markdown on the clipboard. The seed is fixed; the debug hook
// (window.__mm) reads what the canvas alone cannot expose.

const OVERRIDES = { WEAPONS: { launcher: { cooldown: 180 } } };
const TUNE = encodeURIComponent(JSON.stringify(OVERRIDES));

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  return errors;
}

/** The canvas pixel just inside the left edge of the TUNED badge (fill, not lettering), as [r, g, b]. */
async function badgePixel(page: Page): Promise<number[]> {
  const r = tunedBadgeRect();
  return page.locator('canvas#game').evaluate(
    (c: HTMLCanvasElement, [lx, ly, logicalWidth]) => {
      const scale = c.width / logicalWidth;
      const d = c.getContext('2d')!.getImageData(Math.round(lx * scale), Math.round(ly * scale), 1, 1).data;
      return [d[0], d[1], d[2]];
    },
    [r.x + 5, r.y + r.h / 2, LOGICAL_WIDTH] as const,
  );
}

/**
 * PALETTE.selection, the badge yellow (#ffe66d), within a tolerance for
 * scaling; on the result screen the whole canvas sits under a 60% black
 * overlay, so the badge reads at 40% brightness there.
 */
function expectBadgeYellow(pixel: number[], dimmed = false): void {
  const factor = dimmed ? 0.4 : 1;
  const expected = [0xff, 0xe6, 0x6d].map((c) => Math.round(c * factor));
  pixel.forEach((c, i) => expect(Math.abs(c - expected[i])).toBeLessThanOrEqual(8));
}

test('a tune override shows the TUNED badge, reaches a result with a report, and copies it', async ({ page, context }) => {
  const errors = collectErrors(page);
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(`./?seed=7&tune=${TUNE}`);
  await page.waitForFunction(() => window.__mm !== undefined && window.__mm.screen === 'title');
  expect(await page.evaluate(() => [window.__mm!.tuned, window.__mm!.overrides, window.__mm!.tuneError])).toEqual([true, OVERRIDES, null]);

  const canvas = page.locator('canvas#game');
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() => window.__mm!.screen === 'battle');
  await page.waitForTimeout(100);
  expectBadgeYellow(await badgePixel(page));

  await page.evaluate(() => window.__mm!.advanceTicks(30 * 600));
  await page.waitForFunction(() => window.__mm!.screen === 'result');
  await page.waitForTimeout(100);
  expectBadgeYellow(await badgePixel(page), true);
  const report = await page.evaluate(() => window.__mm!.report());
  expect(report).toContain('Seed: 7');
  expect(report).toContain('| blue | Gunner |');
  expect(report).toContain('Overrides: `{"WEAPONS":{"launcher":{"cooldown":180}}}`');
  expect(report).toContain('"side":"red"');
  const stats = await page.evaluate(() => window.__mm!.stats as { sides: { blue: { gunner: { shots: number } } } });
  expect(stats.sides.blue.gunner.shots).toBeGreaterThan(0);

  const copy = resultButtons('idle').find((b) => b.id === 'copyReport')!;
  const at = await page.evaluate(([x, y]) => window.__mm!.logicalToClient(x, y), [copy.x + copy.w / 2, copy.y + copy.h / 2] as const);
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(report);

  expect(errors).toEqual([]);
});

test('a rejected tune parameter starts the battle on shipped balance without errors', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('./?seed=7&tune=nonsense');
  await page.waitForFunction(() => window.__mm !== undefined && window.__mm.screen === 'title');
  const status = await page.evaluate(() => [window.__mm!.tuned, window.__mm!.tuneError]);
  expect(status[0]).toBe(false);
  expect(status[1]).toMatch(/JSON/);
  const canvas = page.locator('canvas#game');
  const box = (await canvas.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForFunction(() => window.__mm!.screen === 'battle');
  expect(errors).toEqual([]);
});
