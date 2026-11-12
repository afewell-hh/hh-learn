/**
 * compare primitive: delivery bar from PR #488 (issue #525).
 * keyboard + deterministic focus, prefers-reduced-motion, no page scroll at 320px,
 * axe (no serious/critical), zero off-box requests, honest labels, fail-closed rendering.
 */
import { test, expect, Page } from '@playwright/test';
import { mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(__dirname, '../..');
const FIX = join(ROOT, 'docs/examples/authoring-platform/modules/shrink-blast-radius-compare');
const CSS = readFileSync(join(ROOT, 'clean-x-hedgehog-templates/assets/css/interactive.css'), 'utf-8');
const JS = readFileSync(join(ROOT, 'clean-x-hedgehog-templates/assets/js/compare.js'), 'utf-8');
const AXE = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf-8');
const SHOTS = join(ROOT, 'screenshots/compare');

type Json = Record<string, any>;
const interactive = (): Json => JSON.parse(readFileSync(join(FIX, 'interactives.json'), 'utf-8')).interactives[0];
const texts = () => ({ left: readFileSync(join(FIX, 'captures/tenant-sonic.txt'), 'utf-8'), right: readFileSync(join(FIX, 'captures/tenant-vpc.yaml'), 'utf-8') });
const payload = (mut?: (it: Json, t: { left: string; right: string }) => void) => { const it = interactive(); const t = texts(); mut?.(it, t); return { interactive: it, texts: t }; };

function html(p: Json, withScript = true): string {
  const json = JSON.stringify(p).replace(/</g, '\\u003c');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Shrink the blast radius</title>
<style>body{margin:0;font:16px/1.6 Georgia,serif;color:#14202b;background:#fff} main{max-width:1100px;margin:0 auto;padding:16px} @media (prefers-color-scheme:dark){body{background:#0b1016;color:#e8eef4}} pre{font-family:'Courier New',monospace;background:#eee;padding:20px;border:5px solid red} h3{color:red} p{margin:20px 0}</style>
<style>${CSS}</style></head><body><main><h1>Shrink the blast radius</h1><h2>Segmenting workloads</h2>
<p>Isolating one tenant from another normally means touching every switch on the path.</p>
<div data-hh-compare><script type="application/json">${json}</script></div>
<p>The comparison above is counted from the two files themselves.</p></main>
${withScript ? `<script>${JS}</script>` : ''}</body></html>`;
}

async function load(page: Page, p: Json, opts: { width?: number; height?: number; scheme?: 'light' | 'dark'; reduce?: boolean } = {}) {
  await page.setViewportSize({ width: opts.width ?? 1280, height: opts.height ?? 900 });
  await page.emulateMedia({ colorScheme: opts.scheme ?? 'light', reducedMotion: opts.reduce ? 'reduce' : 'no-preference' });
  await page.addInitScript(() => {
    const w = window as any;
    w.__net = [];
    const rec = (k: string) => w.__net.push(k);
    const f = w.fetch; w.fetch = (...a: any[]) => { rec('fetch'); return f.apply(w, a); };
    const o = XMLHttpRequest.prototype.open; XMLHttpRequest.prototype.open = function (...a: any[]) { rec('xhr'); return (o as any).apply(this, a); };
    if (navigator.sendBeacon) { navigator.sendBeacon = () => { rec('beacon'); return false; }; }
    const WS = w.WebSocket; w.WebSocket = function (...a: any[]) { rec('ws'); return new WS(...a); };
    w.__scrolls = [];
    const st = HTMLElement.prototype.scrollTo; (HTMLElement.prototype as any).scrollTo = function (o: any) { w.__scrolls.push(o && o.behavior); return (st as any).call(this, o); };
  });
  // setContent does not navigate, so init scripts only apply after a real navigation.
  await page.goto('about:blank');
  await page.setContent(html(p));
  await page.locator('.hh-ix-compare').waitFor();
}

const requests = (page: Page) => {
  const seen: string[] = [];
  page.on('request', (r) => { if (!/^(data|about|blob):/.test(r.url())) seen.push(r.url()); });
  return seen;
};

test.describe('honest rendering', () => {
  test('counts are derived from the files and the label is the weaker side', async ({ page }) => {
    await load(page, payload());
    // Real capture (VLAB, 2026-11-09): one tenant, one server attachment, so one switch changes.
    await expect(page.locator('.hh-ix-count[data-side=left] .hh-ix-num').first()).toHaveText('59');
    await expect(page.locator('.hh-ix-count[data-side=left] .hh-ix-count-dev .hh-ix-num')).toHaveText('1');
    await expect(page.locator('.hh-ix-count[data-side=right] .hh-ix-num').first()).toHaveText('27');
    await expect(page.locator('[data-hh-label]')).toHaveText('Captured');
    await expect(page.locator('.hh-ix-pill--fixture')).toHaveCount(0);
    await expect(page.locator('.hh-ix-pill--plane')).toHaveText('Control-plane evidence');
    // Equivalence sits between the strip and the panes.
    const order = await page.evaluate(() => {
      const q = (s: string) => document.querySelector(s)!;
      const before = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
      return before(q('.hh-ix-strip'), q('.hh-ix-equiv')) && before(q('.hh-ix-equiv'), q('.hh-ix-panes'));
    });
    expect(order).toBe(true);
  });

  test('one captured side and one illustrative side is labelled Illustrative', async ({ page }) => {
    // Both sides are captured now, so the weaker-label rule is exercised by degrading one.
    await load(page, payload((it) => {
      delete it.left.captured_from;
      it.left.provenance = 'illustrative';
      it.left.illustrative_reason = 'degraded on purpose, to check that the weaker side sets the label';
      it.source_label = 'illustrative';
    }));
    await expect(page.locator('[data-hh-label]')).toHaveText('Illustrative');
  });

  test('a captured side whose file still says @fixture fails closed', async ({ page }) => {
    await load(page, payload((it, texts) => { texts.left = '# @fixture left over\n' + texts.left; }));
    await expect(page.getByRole('alert')).toContainText('COMPARE_FIXTURE_CAPTURED');
  });

  test('an authored counts key fails closed: no panes, the rule is named', async ({ page }) => {
    await load(page, payload((it) => { it.counts = { left: 3, right: 1 }; }));
    await expect(page.getByRole('alert')).toContainText('COMPARE_COUNTS_AUTHORED');
    await expect(page.locator('.hh-ix-pane')).toHaveCount(0);
    await expect(page.locator('.hh-ix-count')).toHaveCount(0);
  });

  test('a device list that disagrees with the markers fails closed', async ({ page }) => {
    // leaf-01 is the only device in the capture; claiming two disagrees with the markers.
    await load(page, payload((it) => { it.left.devices = ['leaf-01', 'leaf-02']; }));
    await expect(page.getByRole('alert')).toContainText('COMPARE_DEVICES');
  });

  test('imaginary device markers fail closed and never raise the count', async ({ page }) => {
    await load(page, payload((it, texts) => { texts.left += '# @device imaginary-1\n# @device imaginary-2\n'; }));
    await expect(page.getByRole('alert')).toContainText('COMPARE_DEVICE_EMPTY');
    await expect(page.locator('.hh-ix-count')).toHaveCount(0);
  });

  test('a source_label stronger than the weakest side fails closed (renderer matches validator)', async ({ page }) => {
    await load(page, payload((it) => {
      delete it.left.captured_from;
      it.left.provenance = 'illustrative';
      it.left.illustrative_reason = 'degraded on purpose, so the primitive label is too strong';
      it.source_label = 'captured';
    }));
    await expect(page.getByRole('alert')).toContainText('HONESTY_MISMATCH');
  });

  test('the strip says what it measures: authoring effort, not device involvement', async ({ page }) => {
    await load(page, payload());
    await expect(page.locator('.hh-ix-count[data-side=right] .hh-ix-count-dev')).toContainText('0 devices configured by hand');
    await expect(page.locator('.hh-ix-strip-note')).toContainText('authoring effort, not device involvement');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });

  test('data-plane evidence fails closed', async ({ page }) => {
    await load(page, payload((it) => { it.evidence_plane = 'data-plane'; }));
    await expect(page.getByRole('alert')).toContainText('COMPARE_PLANE');
  });

  test('without the script the page keeps ordinary prose (graceful degradation)', async ({ page }) => {
    await page.setContent(html(payload(), false));
    await expect(page.locator('h2')).toHaveText('Segmenting workloads');
    await expect(page.locator('.hh-ix-pane')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

test.describe('keyboard and focus', () => {
  test('tab order reaches steps; arrows move selection and focus; Next never loses focus', async ({ page }) => {
    await load(page, payload());
    const steps = page.locator('.hh-ix-step');
    await expect(steps.nth(0)).toHaveAttribute('aria-current', 'step');
    await page.getByRole('button', { name: 'Next step' }).focus();
    await page.keyboard.press('Enter');
    await expect(steps.nth(1)).toHaveAttribute('aria-current', 'step');
    expect(await page.evaluate(() => document.activeElement?.textContent)).toBe('Next step');
    await page.keyboard.press('Enter');
    await expect(steps.nth(2)).toHaveAttribute('aria-current', 'step');
    // At the last step Next is aria-disabled, not disabled, so focus stays put.
    await page.keyboard.press('Enter');
    await expect(page.getByRole('button', { name: 'Next step' })).toBeFocused();
    await expect(page.getByRole('button', { name: 'Next step' })).toHaveAttribute('aria-disabled', 'true');

    await steps.nth(2).focus();
    await page.keyboard.press('ArrowUp');
    await expect(steps.nth(1)).toBeFocused();
    await expect(steps.nth(1)).toHaveAttribute('aria-current', 'step');
    await page.keyboard.press('Home');
    await expect(steps.nth(0)).toBeFocused();
    await page.keyboard.press('End');
    await expect(steps.nth(2)).toBeFocused();
    // Roving tabindex: exactly one step is in the tab order.
    expect(await page.locator('.hh-ix-step[tabindex="0"]').count()).toBe(1);
    await expect(page.locator('[role=status]')).toContainText('Step 3 of 3');
  });

  test('code regions are keyboard scrollable and device chips jump', async ({ page }) => {
    await load(page, payload());
    const region = page.getByRole('region', { name: /What the switch ends up configured with/ });
    await region.focus();
    await expect(region).toBeFocused();
    // The capture touches one switch, and a jump-nav with a single target is pointless, so the
    // renderer draws chips only above one device. That is the behaviour, not a gap in the test.
    await expect(page.locator('.hh-ix-chip')).toHaveCount(0);
  });

  test('device chips appear and jump once there is more than one device', async ({ page }) => {
    await load(page, payload((it, texts) => {
      texts.left += '\n# @device leaf-02\nVLAN|Vlan1010 {"vlanid":"1010"}\nVRF|VrfVtenant-a {"vni":"100"}\n';
      it.left.devices = ['leaf-01', 'leaf-02'];
    }));
    const region = page.getByRole('region', { name: /What the switch ends up configured with/ });
    await expect(page.locator('.hh-ix-chip')).toHaveCount(2);
    const before = await region.evaluate((e) => e.scrollTop);
    await page.getByRole('button', { name: 'leaf-02' }).click();
    await expect.poll(() => region.evaluate((e) => e.scrollTop)).not.toBe(before);
  });

  test('stepping through every step fires the local finish event and nothing else', async ({ page }) => {
    await load(page, payload((it) => { it.completes_on = 'all_steps'; }));
    await page.evaluate(() => { (window as any).__fin = 0; document.addEventListener('hh:interactive-finish', () => { (window as any).__fin++; }); });
    const steps = page.locator('.hh-ix-step');
    await steps.nth(0).click();
    await steps.nth(1).click();
    expect(await page.evaluate(() => (window as any).__fin)).toBe(0);
    await steps.nth(2).click();
    expect(await page.evaluate(() => (window as any).__fin)).toBe(1);
  });
});

test.describe('motion', () => {
  test('reduced motion: instant scroll and no transitions', async ({ page }) => {
    await load(page, payload(), { reduce: true });
    await page.locator('.hh-ix-step').nth(1).click();
    expect(await page.evaluate(() => (window as any).__scrolls)).not.toContain('smooth');
    expect(await page.locator('.hh-ix-step').first().evaluate((e) => getComputedStyle(e).transitionDuration)).toMatch(/^0s$|^0\.0*1?ms$|^1e-05s$/);
  });
  test('default motion: smooth, short', async ({ page }) => {
    await load(page, payload());
    await page.locator('.hh-ix-step').nth(1).click();
    expect(await page.evaluate(() => (window as any).__scrolls)).toContain('smooth');
    const dur = await page.locator('.hh-ix-step').first().evaluate((e) => getComputedStyle(e).transitionDuration);
    expect(parseFloat(dur) * (dur.endsWith('ms') ? 1 : 1000)).toBeLessThanOrEqual(200);
  });
});

test.describe('layout', () => {
  for (const width of [320, 375, 768, 1280]) {
    test(`no page-level horizontal scroll at ${width}px`, async ({ page }) => {
      await load(page, payload(), { width });
      for (let i = 0; i < 3; i++) {
        await page.locator('.hh-ix-step').nth(i).click();
        const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bw: document.body.scrollWidth }));
        expect(m.sw).toBeLessThanOrEqual(m.cw);
        expect(m.bw).toBeLessThanOrEqual(m.cw);
      }
    });
  }
  test('panes stack below 900px and sit side by side above', async ({ page }) => {
    await load(page, payload(), { width: 800 });
    const stacked = await page.evaluate(() => { const [a, b] = Array.from(document.querySelectorAll('.hh-ix-pane')).map((e) => e.getBoundingClientRect()); return b.top >= a.bottom - 1; });
    expect(stacked).toBe(true);
    await page.setViewportSize({ width: 1280, height: 900 });
    const side = await page.evaluate(() => { const [a, b] = Array.from(document.querySelectorAll('.hh-ix-pane')).map((e) => e.getBoundingClientRect()); return Math.abs(a.top - b.top) < 2 && Math.abs(a.width - b.width) < 2; });
    expect(side).toBe(true);
  });
});

test.describe('accessibility (axe)', () => {
  for (const [name, opts] of [
    ['desktop light', { width: 1280, scheme: 'light' }],
    ['desktop dark', { width: 1280, scheme: 'dark' }],
    ['320px light', { width: 320, scheme: 'light' }],
    ['320px dark', { width: 320, scheme: 'dark' }],
  ] as const) {
    test(`no serious or critical violations: ${name}`, async ({ page }) => {
      await load(page, payload(), opts);
      await page.locator('.hh-ix-step').nth(1).click();
      await page.addScriptTag({ content: AXE });
      const res = await page.evaluate(async () => (window as any).axe.run(document, { resultTypes: ['violations'] }));
      const bad = res.violations.filter((v: Json) => v.impact === 'serious' || v.impact === 'critical');
      expect(bad.map((v: Json) => `${v.id}: ${v.nodes.map((n: Json) => n.target.join(' ')).join(' | ')}`)).toEqual([]);
      // Reported for the record: anything below serious.
      test.info().annotations.push({ type: 'axe-other', description: res.violations.map((v: Json) => `${v.impact}:${v.id}`).join(', ') || 'none' });
    });
  }
  test('the fail-closed error state is also axe clean', async ({ page }) => {
    await load(page, payload((it) => { it.counts = { left: 1 }; }));
    await page.addScriptTag({ content: AXE });
    const res = await page.evaluate(async () => (window as any).axe.run(document));
    expect(res.violations.filter((v: Json) => v.impact === 'serious' || v.impact === 'critical')).toEqual([]);
  });
});

test.describe('network', () => {
  test('zero off-box requests and zero fetch/XHR/beacon/WebSocket calls during use', async ({ page }) => {
    const seen = requests(page);
    await load(page, payload());
    for (let i = 0; i < 3; i++) await page.locator('.hh-ix-step').nth(i).click();
    await page.locator('.hh-ix-fair summary').first().click();
    await page.keyboard.press('Tab');
    expect(seen).toEqual([]);
    expect(await page.evaluate(() => (window as any).__net)).toEqual([]);
  });
});

test.describe('screenshots', () => {
  test('desktop, 320px and dark', async ({ page }) => {
    mkdirSync(SHOTS, { recursive: true });
    await load(page, payload(), { width: 1280, height: 900 });
    await page.locator('.hh-ix-step').nth(1).click();
    await page.waitForTimeout(800); // let the smooth scroll settle
    await page.locator('.hh-ix-compare').screenshot({ path: join(SHOTS, 'compare-desktop.png') });
    await load(page, payload(), { width: 320, height: 640 });
    await page.locator('.hh-ix-step').nth(1).click();
    await page.waitForTimeout(800);
    await page.screenshot({ path: join(SHOTS, 'compare-320.png'), fullPage: true });
    await load(page, payload(), { width: 1280, height: 900, scheme: 'dark' });
    await page.locator('.hh-ix-step').nth(1).click();
    await page.waitForTimeout(800);
    await page.locator('.hh-ix-compare').screenshot({ path: join(SHOTS, 'compare-desktop-dark.png') });
  });
});

/**
 * Regression, found when the fixture was replaced by a real VLAB capture (2026-11-09).
 *
 * scrollTo() measured `target.offsetTop`, which is relative to the nearest POSITIONED
 * ancestor. The <pre> scroller is not positioned, so the value was a page coordinate,
 * scrollTo clamped to the bottom, and the highlighted step was never brought into view.
 * The short fixture file hid it: every line already fitted on screen, so no scroll was
 * needed for the highlight to be visible. The captured file is 75 lines and exposed it.
 */
test('every step scrolls its highlighted range into view in both panes', async ({ page }) => {
  await load(page, payload());
  const steps = page.locator('.hh-ix-step');
  const count = await steps.count();
  expect(count).toBeGreaterThan(1);

  for (let i = 0; i < count; i++) {
    await steps.nth(i).click();
    await page.waitForTimeout(600); // smooth scroll settles
    const seen = await page.evaluate(() =>
      [...document.querySelectorAll('pre.hh-ix-code')].map((pre) => {
        const hl = pre.querySelectorAll('.hh-ix-ln--hl');
        if (!hl.length) return { highlighted: 0, inView: false };
        const p = pre.getBoundingClientRect();
        const f = hl[0].getBoundingClientRect();
        return { highlighted: hl.length, inView: f.top >= p.top - 4 && f.top <= p.bottom };
      }),
    );
    for (const pane of seen) {
      expect(pane.highlighted).toBeGreaterThan(0);
      expect(pane.inView).toBe(true);
    }
  }
});
