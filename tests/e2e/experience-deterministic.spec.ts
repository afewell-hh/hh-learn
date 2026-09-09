/**
 * RED (Phase 4, #485) — Fabric Operator replay player, deterministic e2e (#483/#484).
 *
 * Loads a committed local fixture via file:// (no published page, no CDN variable —
 * matching this repo's deterministic-suite philosophy). The player browser asset
 * (clean-x-hedgehog-templates/assets/js/experience-player.js) does NOT exist yet, so
 * the player never initializes and the behavioural assertions FAIL (RED).
 *
 * NON-NEGOTIABLE gates asserted here:
 *   - Zero network to /events/track and api.hedgehog.cloud (Slice 1 is backend-free).
 *   - Scenario data is PARSED from the inline island, never fetched.
 *
 * GREEN target: implement experience-player.js (+ generated core/view) so all pass.
 */
import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'url';
import * as path from 'path';

const FIXTURE = pathToFileURL(path.resolve(__dirname, 'fixtures/experience-fixture.html')).href;
const FIXTURE_FLAG_OFF = pathToFileURL(path.resolve(__dirname, 'fixtures/experience-flag-off.html')).href;

/** Attach network guards that fail the test if any forbidden request is issued. */
function guardNetwork(page: import('@playwright/test').Page): string[] {
  const forbidden: string[] = [];
  page.on('request', (req) => {
    const url = req.url();
    if (/\/events\/track/.test(url) || /api\.hedgehog\.cloud/.test(url)) {
      forbidden.push(url);
    }
  });
  return forbidden;
}

test.describe('Fabric Operator replay — deterministic', () => {
  test('renders title, honesty label, terminal, and controls', async ({ page }) => {
    await page.goto(FIXTURE);
    await expect(page.locator('[data-testid="honesty-label"]')).toContainText('not a live fabric');
    await expect(page.getByRole('log', { name: /terminal output/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /next/i })).toBeVisible();
  });

  test('advances steps via keyboard (ArrowRight) and moves focus to the new step', async ({ page }) => {
    await page.goto(FIXTURE);
    await page.getByRole('button', { name: /next/i }).focus();
    await page.keyboard.press('ArrowRight'); // step 0
    await page.keyboard.press('ArrowRight'); // step 1
    await expect(page.locator('[data-testid="step-title"]')).toBeFocused();
    await expect(page.getByRole('log')).toContainText('kubectl get vpcs');
  });

  test('reaches the CTA / lead bridge at arc end (Skip to end)', async ({ page }) => {
    await page.goto(FIXTURE);
    await page.getByRole('button', { name: /skip to end/i }).click();
    const cta = page.locator('[data-testid="lead-bridge"]');
    await expect(cta).toBeVisible();
    await expect(cta.getByRole('link', { name: /launch the full virtual lab/i })).toHaveAttribute('href', '/vlab');
  });

  test('NON-NEGOTIABLE: makes zero requests to /events/track or api.hedgehog.cloud', async ({ page }) => {
    const forbidden = guardNetwork(page);
    await page.goto(FIXTURE);
    await page.getByRole('button', { name: /skip to end/i }).click();
    await page.waitForTimeout(500);
    expect(forbidden, `forbidden requests: ${forbidden.join(', ')}`).toHaveLength(0);
  });

  test('parses the inline island (never fetches scenario JSON)', async ({ page }) => {
    const requestedJson: string[] = [];
    page.on('request', (req) => {
      if (/\.json(\?|$)/.test(req.url())) requestedJson.push(req.url());
    });
    await page.goto(FIXTURE);
    await expect(page.getByRole('log')).toContainText('webapp-prod');
    expect(requestedJson).toHaveLength(0);
  });

  test('inline island is a single non-executable application/json script', async ({ page }) => {
    await page.goto(FIXTURE);
    const islands = await page.locator('script[type="application/json"]#hhl-exp-scenario').count();
    expect(islands).toBe(1);
  });

  test('feature flag OFF renders nothing', async ({ page }) => {
    await page.goto(FIXTURE_FLAG_OFF);
    await expect(page.getByRole('log')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /next/i })).toHaveCount(0);
  });

  test('reduced motion: output is rendered instantly (no typing animation class)', async ({ page, browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    await p.goto(FIXTURE);
    await p.getByRole('button', { name: /next/i }).click();
    await expect(p.getByRole('log')).not.toHaveClass(/is-typing/);
    await ctx.close();
  });

  test('responsive: no horizontal page scroll at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto(FIXTURE);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflow).toBe(false);
  });
});
