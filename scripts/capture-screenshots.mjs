#!/usr/bin/env node
import { chromium, devices } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';

const BASE = process.env.E2E_BASE_URL || 'https://hedgehog.cloud';

async function firstHref(page, url, css) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  const hrefs = await page.evaluate((selector) => {
    return Array.from(document.querySelectorAll(selector)).map(a => a.getAttribute('href') || '');
  }, css);
  const wanted = hrefs.find(h => h.includes('/learn/courses/')) || hrefs.find(h => h.includes('/learn/pathways/')) || null;
  return wanted;
}

function ensureDir(path) {
  try { mkdirSync(path, { recursive: true }); } catch {}
}

async function capture() {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const mobile = await browser.newContext({ ...devices['iPhone 13'] });
    const p = await context.newPage();
    const m = await mobile.newPage();

    const outDir = 'screenshots/pr-179';
    ensureDir(outDir);

    // Discover one course and one pathway link from list pages using DOM selectors
    const courseHref = await firstHref(p, `${BASE}/learn/courses`, 'a[href*="/learn/courses/"]');
    const pathwayHref = await firstHref(p, `${BASE}/learn/pathways`, 'a[href*="/learn/pathways/"]');
    const normalize = (href) => {
      if (!href) return null;
      try { const u = new URL(href, BASE); return u.toString(); } catch { return null; }
    };
    const courseUrl = normalize(courseHref);
    const pathwayUrl = normalize(pathwayHref);

    const targets = [];
    if (courseUrl) targets.push({ name: 'course-detail', url: courseUrl });
    if (pathwayUrl) targets.push({ name: 'pathway-detail', url: pathwayUrl });

    for (const t of targets) {
      await p.goto(t.url, { waitUntil: 'networkidle' });
      const desktopPath = `${outDir}/${t.name}-desktop.png`;
      await p.screenshot({ path: desktopPath, fullPage: true });

      await m.goto(t.url, { waitUntil: 'networkidle' });
      const mobilePath = `${outDir}/${t.name}-mobile.png`;
      await m.screenshot({ path: mobilePath, fullPage: true });

      writeFileSync(`${outDir}/${t.name}.txt`, `URL: ${t.url}\nTimestamp: ${new Date().toISOString()}\n`);
      console.log(`Captured: ${desktopPath} and ${mobilePath}`);
    }

    await context.close();
    await mobile.close();
  } finally {
    await browser.close();
  }
}

capture().catch(err => { console.error(err); process.exit(1); });

