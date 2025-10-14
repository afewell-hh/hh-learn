#!/usr/bin/env ts-node
/**
 * Fetch HTML source of a page to see what's actually rendering
 */

import { chromium } from '@playwright/test';

const url = 'https://hedgehog.cloud/learn/courses/course-authoring-101';

async function fetchSource() {
  console.log(`🔍 Fetching HTML source from: ${url}\n`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });

  const html = await page.content();

  // Look for the section that should contain modules
  const modulesSectionMatch = html.match(/content-blocks-section|Course Modules|modules-grid/gi);

  console.log(`Page HTML length: ${html.length} characters`);
  console.log(`\nSearching for module rendering sections...`);
  console.log(`Matches found: ${modulesSectionMatch ? modulesSectionMatch.length : 0}`);

  if (modulesSectionMatch) {
    console.log(`\nMatched terms: ${modulesSectionMatch.join(', ')}`);
  }

  // Extract a snippet around "Course Modules" or content-blocks-section
  const snippets = [
    'content-blocks-section',
    'Course Modules',
    'modules-grid',
    'module-card',
    'module_slugs_json'
  ];

  for (const search of snippets) {
    const index = html.toLowerCase().indexOf(search.toLowerCase());
    if (index !== -1) {
      const start = Math.max(0, index - 200);
      const end = Math.min(html.length, index + 500);
      console.log(`\n${'='.repeat(60)}`);
      console.log(`Found "${search}" at position ${index}:`);
      console.log('='.repeat(60));
      console.log(html.substring(start, end));
    }
  }

  await browser.close();
}

fetchSource().catch(err => {
  console.error('❌ Fetch failed:', err);
  process.exit(1);
});
