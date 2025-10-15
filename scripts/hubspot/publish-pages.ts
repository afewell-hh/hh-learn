#!/usr/bin/env ts-node
/**
 * Publish CMS pages from DRAFT to live
 *
 * This script publishes specific pages by slug.
 * Usage: npm run publish:pages [-- --dry-run]
 */

import 'dotenv/config';
import { Client } from '@hubspot/api-client';
import { getHubSpotToken, allowlistOverrideEnabled, maskToken } from './get-hubspot-token.js';

const ACCESS_TOKEN = getHubSpotToken();
const hubspot = new Client({ accessToken: ACCESS_TOKEN });

// Page IDs from provisioning output (Issue #59, #142)
const PAGES_TO_PUBLISH = [
  { slug: 'learn', id: '197177162603' },
  { slug: 'learn/modules', id: '197624622201' },
  { slug: 'learn/courses', id: '197280289288' },
  { slug: 'learn/pathways', id: '197280289546' },
  { slug: 'learn/my-learning', id: '197399202740' }
];

const ALLOWED_SLUGS = new Set(
  PAGES_TO_PUBLISH.map((p) => p.slug)
);

const ALLOWED_TEMPLATE_PREFIX = 'CLEAN x HEDGEHOG/templates/learn/';

// Helper: Sleep for specified milliseconds
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper: Retry with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelayMs: number = 2000
): Promise<T> {
  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;

      const isRateLimit = err.code === 429 ||
                          err.code === 403 ||
                          (err.message && err.message.includes('rate limit'));

      if (!isRateLimit && err.code !== 404) {
        throw err;
      }

      if (attempt === maxRetries) {
        throw err;
      }

      const delayMs = initialDelayMs * Math.pow(2, attempt);
      console.log(`  ⏳ Rate limit hit, waiting ${delayMs/1000}s before retry ${attempt + 1}/${maxRetries}...`);
      await sleep(delayMs);
    }
  }

  throw lastError;
}

// Get page details by ID
async function getPageById(pageId: string): Promise<any | null> {
  try {
    const page = await retryWithBackoff(() =>
      hubspot.cms.pages.sitePagesApi.getById(pageId, false)
    );
    return page;
  } catch (err: any) {
    console.error(`Error getting page ${pageId}:`, err.message);
    return null;
  }
}

// Publish a page
async function publishPage(pageId: string, slug: string, dryRun: boolean = false): Promise<boolean> {
  console.log(`\n📄 Processing: ${slug}`);
  console.log(`   Page ID: ${pageId}`);

  const page = await getPageById(pageId);
  if (!page) {
    console.log(`   ✗ Page not found`);
    return false;
  }

  console.log(`   Current state: ${page.state}`);
  console.log(`   URL: ${page.url || 'N/A'}`);

  // Guardrails: only operate on allow‑listed slugs and templates unless override is set
  const override = allowlistOverrideEnabled();
  const isSlugAllowed = ALLOWED_SLUGS.has(slug);
  const templatePath: string | undefined = (page as any).templatePath || (page as any).template_path;
  const isTemplateAllowed = !!templatePath && templatePath.startsWith(ALLOWED_TEMPLATE_PREFIX);

  if (!override && (!isSlugAllowed || !isTemplateAllowed)) {
    console.log('   ❌ Guardrail blocked operation.');
    console.log(`      slugAllowed=${isSlugAllowed}, templateAllowed=${isTemplateAllowed}, templatePath=${templatePath || '<none>'}`);
    console.log('      Use --unsafe-allow-outside-allowlist (or ALLOWLIST_OVERRIDE=true) only if absolutely necessary.');
    return false;
  }

  if (page.state === 'PUBLISHED') {
    console.log(`   ℹ️  Already published`);
    return true;
  }

  if (dryRun) {
    console.log(`   [DRY RUN] Would publish page`);
    return true;
  }

  try {
    console.log(`   Publishing...`);

    // Use REST API directly to publish
    const token = ACCESS_TOKEN;
    const updated = await retryWithBackoff(async () => {
      const res = await fetch(
        `https://api.hubapi.com/cms/v3/pages/site-pages/${pageId}`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            state: 'PUBLISHED'
          })
        }
      );

      if (!res.ok) {
        const text = await res.text();
        const err: any = new Error(`HTTP ${res.status}: ${text}`);
        err.code = res.status;
        err.body = text;
        throw err;
      }

      return await res.json();
    });

    console.log(`   ✓ Published successfully`);
    console.log(`   New state: ${updated.state}`);
    return true;
  } catch (err: any) {
    console.error(`   ✗ Failed to publish:`, err.message);
    if (err.body) {
      console.error(`   Error details:`, err.body.substring(0, 300));
    }
    return false;
  }
}

async function publishPages(dryRun: boolean = false) {
  console.log('🔄 Starting page publishing...\n');

  if (dryRun) {
    console.log('📝 DRY RUN MODE - no changes will be made\n');
  }

  console.log(`🔐 Using HubSpot token: ${maskToken(ACCESS_TOKEN)}`);

  const results: { slug: string; success: boolean }[] = [];

  for (const { id, slug } of PAGES_TO_PUBLISH) {
    const success = await publishPage(id, slug, dryRun);
    results.push({ slug, success });

    // Small delay between pages
    if (!dryRun) {
      await sleep(2000);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Publishing Summary');
  console.log('='.repeat(60));

  results.forEach(({ slug, success }) => {
    const status = success ? '✓' : '✗';
    console.log(`${status} ${slug}`);
  });

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  console.log('');
  console.log(`✓ Success: ${successCount}`);
  console.log(`✗ Failed: ${failCount}`);
  console.log('');

  if (successCount > 0 && !dryRun) {
    console.log('✅ Publishing complete!\n');
    console.log('💡 Pages are now live. Visit URLs to verify:\n');
    console.log('   - https://hedgehog.cloud/learn');
    console.log('   - https://hedgehog.cloud/learn/modules');
    console.log('   - https://hedgehog.cloud/learn/courses');
    console.log('   - https://hedgehog.cloud/learn/pathways');
    console.log('   - https://hedgehog.cloud/learn/my-learning');
    console.log('');
  } else if (dryRun) {
    console.log('✅ Dry run complete!\n');
  }

  if (failCount > 0) {
    throw new Error(`${failCount} page(s) failed to publish`);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// Run publishing
publishPages(dryRun).catch(err => {
  console.error('❌ Publishing failed:', err.message);
  process.exit(1);
});
