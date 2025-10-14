#!/usr/bin/env ts-node
/**
 * Take screenshots of published pages for verification
 */

import { chromium } from '@playwright/test';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

const BASE_URL = 'https://hedgehog.cloud';

const pages = [
  { name: 'modules-list', url: `${BASE_URL}/learn` },
  { name: 'courses-list', url: `${BASE_URL}/learn/courses` },
  { name: 'pathways-list', url: `${BASE_URL}/learn/pathways` },
  { name: 'authoring-basics-module', url: `${BASE_URL}/learn/authoring-basics` },
  { name: 'course-authoring-101-course', url: `${BASE_URL}/learn/courses/course-authoring-101?debug=1` },
  { name: 'course-authoring-expert-pathway', url: `${BASE_URL}/learn/pathways/course-authoring-expert?debug=1` },
];

async function takeScreenshots() {
  console.log('📸 Taking screenshots of published pages...\n');

  // Create screenshots directory
  const screenshotsDir = join(process.cwd(), 'screenshots');
  await mkdir(screenshotsDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  for (const pageConfig of pages) {
    try {
      console.log(`📸 Capturing: ${pageConfig.name}`);
      console.log(`   URL: ${pageConfig.url}`);

      await page.goto(pageConfig.url, { waitUntil: 'networkidle', timeout: 30000 });

      // Wait a bit for any dynamic content
      await page.waitForTimeout(2000);

      const screenshotPath = join(screenshotsDir, `${pageConfig.name}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });

      console.log(`   ✓ Saved: ${screenshotPath}\n`);
    } catch (err: any) {
      console.error(`   ✗ Failed: ${err.message}\n`);
    }
  }

  await browser.close();
  console.log('✅ Screenshots complete!\n');
  console.log(`Screenshots saved to: ${screenshotsDir}\n`);
}

takeScreenshots().catch(err => {
  console.error('❌ Screenshot process failed:', err);
  process.exit(1);
});
