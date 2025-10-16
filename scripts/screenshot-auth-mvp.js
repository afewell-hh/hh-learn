#!/usr/bin/env node
const { mkdirSync } = require('fs');
const { chromium } = require('playwright');

(async () => {
  const outDir = 'screenshots/issue-auth-mvp';
  mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch();
  const ctxDesktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const ctxMobile = await browser.newContext({ viewport: { width: 375, height: 812 }, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1' });
  const pages = [
    { url: 'https://hedgehog.cloud/learn', base: 'learn' },
    { url: 'https://hedgehog.cloud/learn/my-learning', base: 'my-learning' },
  ];
  for (const p of pages) {
    const d = await ctxDesktop.newPage();
    await d.goto(p.url, { waitUntil: 'domcontentloaded' });
    await d.screenshot({ path: `${outDir}/${p.base}-desktop.png`, fullPage: true });
    await d.close();
    const m = await ctxMobile.newPage();
    await m.goto(p.url, { waitUntil: 'domcontentloaded' });
    await m.screenshot({ path: `${outDir}/${p.base}-mobile.png`, fullPage: true });
    await m.close();
  }
  await ctxDesktop.close();
  await ctxMobile.close();
  await browser.close();
  console.log(`Wrote screenshots to ${outDir}`);
})();

