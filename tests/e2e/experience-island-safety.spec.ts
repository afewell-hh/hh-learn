/**
 * RED (Phase 4, #485) — JSON-island DOM-parser half of the accepted #484 test.
 *
 * The unit test (tests/unit/experience-serialize-island.test.ts) proves the STRING
 * invariants + lossless round-trip. This spec proves the DOM-PARSER half required by
 * the #484 acceptance: render the ADVERSARIAL island produced by serializeIsland() in
 * a real HTML parser and assert exactly one non-executable application/json script,
 * no premature termination, and no injected executable script.
 *
 * Isolated in its own spec so the RED import failure (serialize-island not implemented)
 * does not disturb the behavioural deterministic spec.
 *
 * FAILS TODAY: src/experiences/serialize-island.ts does not exist (spec fails to load = RED).
 */
import { test, expect } from '@playwright/test';

// serializeIsland is imported DYNAMICALLY inside the test so that, in RED, the missing
// module fails only this test at runtime rather than aborting Playwright's collection
// (a top-level import of a missing module is a hard collection error).

// Adversarial payload: end-script-tag + reopened executable script (sets a sentinel),
// CDATA close, HTML comment open, and the two Unicode line/paragraph separators.
const ADVERSARIAL = {
  scenarioId: 'fabric-operator',
  version: '1',
  narrative: 'x </script><script>window.__pwned=true</script> ]]> <!-- c -->     end',
};

test.describe('JSON island — DOM-parser adversarial safety', () => {
  test('renders as exactly one non-executable application/json island; payload is inert and round-trips', async ({ page }) => {
    const { serializeIsland } = await import('../../src/experiences/serialize-island');
    const island = serializeIsland(ADVERSARIAL);
    const html = `<!doctype html><html><head><meta charset="utf-8"></head><body>` +
      `<script type="application/json" id="hhl-exp-scenario">${island}</script>` +
      `</body></html>`;
    await page.setContent(html);

    // Exactly one island, and it is the ONLY <script> in the document
    // (no premature termination spawned a second, executable <script>).
    expect(await page.locator('script[type="application/json"]#hhl-exp-scenario').count()).toBe(1);
    expect(await page.locator('script').count()).toBe(1);

    // The injected executable payload never ran.
    expect(await page.evaluate(() => (window as unknown as { __pwned?: boolean }).__pwned)).toBeUndefined();

    // The island's textContent parses back to the original object (lossless).
    const parsed = await page.evaluate(() => {
      const el = document.getElementById('hhl-exp-scenario');
      return JSON.parse(el!.textContent as string);
    });
    expect(parsed).toEqual(ADVERSARIAL);
  });
});
