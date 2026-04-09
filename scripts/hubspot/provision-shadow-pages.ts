#!/usr/bin/env ts-node
/**
 * Provision shadow CMS pages for the HH-Learn shadow environment (Issue #371)
 *
 * Shadow pages are published but unlisted pages that mirror the /learn structure
 * at /learn-shadow, allowing safe feature development without touching live pages.
 *
 * Shadow page slugs: learn-shadow, learn-shadow/modules, learn-shadow/courses,
 *   learn-shadow/pathways, learn-shadow/my-learning, learn-shadow/register,
 *   learn-shadow/action-runner
 *
 * Shadow templates: CLEAN x HEDGEHOG/templates/learn-shadow/
 *
 * This script:
 * 1. Creates or updates shadow site pages via CMS Pages API
 * 2. Binds pages to the same HubDB tables as production (Phase 0A: data not isolated)
 * 3. Creates pages in DRAFT state by default (use --publish to publish immediately)
 * 4. Idempotent: if page exists by slug, PATCH the draft instead of creating duplicates
 *
 * Usage: node dist/scripts/hubspot/provision-shadow-pages.js [--dry-run] [--publish] [--allow-create]
 */

import 'dotenv/config';
import { getHubSpotToken } from './get-hubspot-token.js';
import { Client } from '@hubspot/api-client';

const hubspot = new Client({
  accessToken: getHubSpotToken()
});

const SHADOW_TEMPLATE_PREFIX = 'CLEAN x HEDGEHOG/templates/learn-shadow/';
const SHADOW_SLUG_PREFIX = 'learn-shadow';

interface PageConfig {
  name: string;
  slug: string;
  templatePath: string;
  /** Name of env var that holds the HubDB table ID. Use 'STATIC' for pages with no HubDB binding. */
  tableEnvVar: string;
}

interface PageResult {
  name: string;
  slug: string;
  id: string;
  state: string;
  url?: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
      const isRateLimit = err.code === 429 || err.code === 403 ||
        (err.message && err.message.includes('rate limit'));
      if (!isRateLimit && err.code !== 404) throw err;
      if (attempt === maxRetries) throw err;
      const delay = initialDelayMs * Math.pow(2, attempt);
      console.log(`  ⏳ Rate limit, waiting ${delay / 1000}s (retry ${attempt + 1}/${maxRetries})...`);
      await sleep(delay);
    }
  }
  throw lastError;
}

async function findPageBySlug(slug: string): Promise<any | null> {
  const token = getHubSpotToken();
  const base = 'https://api.hubapi.com';

  // Try search endpoint first
  try {
    const res = await fetch(`${base}/cms/v3/pages/site-pages/search`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({ filters: [{ propertyName: 'slug', operator: 'EQ', value: slug }], limit: 10 })
    });
    if (res.ok) {
      const data = await res.json();
      const found = (data.results ?? []).find((r: any) => r.slug === slug);
      if (found) return found;
    }
  } catch { /* fall through */ }

  // Fallback: list + filter
  try {
    let after: string | undefined = undefined;
    for (let i = 0; i < 5; i++) {
      const url = new URL(`${base}/cms/v3/pages/site-pages`);
      url.searchParams.set('limit', '100');
      if (after) url.searchParams.set('after', after);
      const res = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' }
      });
      if (!res.ok) break;
      const data = await res.json();
      const found = (data.results ?? []).find((r: any) => r.slug === slug);
      if (found) return found;
      after = data?.paging?.next?.after;
      if (!after) break;
    }
  } catch { /* ignore */ }

  return null;
}

async function validateTemplateExists(templatePath: string): Promise<boolean> {
  const token = getHubSpotToken();
  try {
    const res = await fetch(
      `https://api.hubapi.com/cms/v3/source-code/draft/metadata/${encodeURIComponent(templatePath)}`,
      { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' } }
    );
    return res.status === 200;
  } catch {
    return false;
  }
}

async function createOrUpdatePage(
  config: PageConfig,
  tableId: string,
  dryRun: boolean,
  publish: boolean,
  allowCreate: boolean
): Promise<PageResult | null> {
  // Guardrail: only allow shadow slugs and shadow template paths
  if (!config.slug.startsWith(SHADOW_SLUG_PREFIX)) {
    console.log(`❌ Guardrail: slug "${config.slug}" does not start with "${SHADOW_SLUG_PREFIX}". Blocked.`);
    return null;
  }
  if (!config.templatePath.startsWith(SHADOW_TEMPLATE_PREFIX)) {
    console.log(`❌ Guardrail: template "${config.templatePath}" is not a shadow template. Blocked.`);
    return null;
  }

  console.log(`\n📄 Shadow page: ${config.name}`);
  console.log(`   Slug: ${config.slug}`);
  console.log(`   Template: ${config.templatePath}`);

  if (!dryRun) {
    const exists = await validateTemplateExists(config.templatePath);
    if (!exists) {
      console.log(`   ❌ Template not found in Design Manager. Upload templates first.`);
      console.log(`      Run: npm run upload:templates`);
      return null;
    }
  }

  const existingPage = await findPageBySlug(config.slug);

  const payload: any = {
    name: config.name,
    slug: config.slug,
    templatePath: config.templatePath,
    state: 'DRAFT',
    // Shadow pages must never appear in search results.
    // Primary protection: <meta name="robots" content="noindex, nofollow"> in each template.
    // Belt-and-suspenders: set HubSpot page-level no-index flags as well.
    metaRobotsNoIndex: true,
    metaRobotsNoFollow: true,
    ...(publish && { publishImmediately: true, publicAccessRulesEnabled: false })
  };

  const isStatic = config.tableEnvVar === 'STATIC';
  if (!isStatic) {
    payload.dynamicPageDataSourceType = 1; // HUBDB
    payload.dynamicPageDataSourceId = parseInt(tableId, 10);
  }

  if (dryRun) {
    const action = existingPage ? `UPDATE (id: ${existingPage.id})` : 'CREATE';
    console.log(`   Action: ${action}`);
    console.log('   Payload:', JSON.stringify(payload, null, 2));
    return { name: config.name, slug: config.slug, id: existingPage?.id || '<new>', state: publish ? 'PUBLISHED' : 'DRAFT' };
  }

  try {
    let page: any;
    if (existingPage) {
      console.log(`   Updating existing page (id: ${existingPage.id})`);
      page = await retryWithBackoff(() =>
        hubspot.cms.pages.sitePagesApi.update(String(existingPage.id), payload as any)
      );
      console.log(`   ✓ Updated`);
    } else if (allowCreate) {
      console.log(`   Creating new page`);
      page = await retryWithBackoff(() =>
        hubspot.cms.pages.sitePagesApi.create(payload as any)
      );
      console.log(`   ✓ Created (id: ${page.id})`);
    } else {
      console.log(`   ⚠️  No existing page found. Use --allow-create to create it.`);
      return { name: config.name, slug: config.slug, id: '<skipped>', state: 'SKIPPED' };
    }

    if (publish && page.state !== 'PUBLISHED') {
      try {
        const api: any = hubspot.cms.pages.sitePagesApi;
        await retryWithBackoff(() => api.schedule(String(page.id), String(page.id)));
        console.log(`   ✓ Scheduled for publish`);
      } catch (err: any) {
        console.log(`   ⚠️  Auto-publish failed: ${err.message}. Publish manually in CMS.`);
      }
    }

    return { name: config.name, slug: config.slug, id: String(page.id), state: publish ? 'PUBLISHED' : 'DRAFT', url: page.url };
  } catch (err: any) {
    console.error(`   ✗ Failed: ${err.message}`);
    if (err.body) console.error('   Details:', JSON.stringify(err.body, null, 2));
    return null;
  }
}

async function provisionShadowPages(dryRun: boolean, publish: boolean, allowCreate: boolean) {
  console.log('🌑 Starting shadow CMS page provisioning (Issue #371)...\n');
  if (dryRun) console.log('📝 DRY RUN — no changes will be made\n');
  if (publish && !dryRun) console.log('🚀 PUBLISH MODE — pages published immediately\n');
  if (allowCreate && !dryRun) console.log('➕ CREATE MODE — new pages will be created\n');

  // Shadow pages mirror production but at learn-shadow/* slugs and use learn-shadow/* templates.
  // Phase 0A: HubDB table bindings point to the same production tables (data isolation is future work).
  const pageConfigs: PageConfig[] = [
    {
      name: 'Learn Shadow — Get Started',
      slug: 'learn-shadow',
      templatePath: `${SHADOW_TEMPLATE_PREFIX}get-started.html`,
      tableEnvVar: 'HUBDB_CATALOG_TABLE_ID'
    },
    {
      name: 'Learn Shadow — Modules',
      slug: 'learn-shadow/modules',
      templatePath: `${SHADOW_TEMPLATE_PREFIX}module-page.html`,
      tableEnvVar: 'HUBDB_MODULES_TABLE_ID'
    },
    {
      name: 'Learn Shadow — Courses',
      slug: 'learn-shadow/courses',
      templatePath: `${SHADOW_TEMPLATE_PREFIX}courses-page.html`,
      tableEnvVar: 'HUBDB_COURSES_TABLE_ID'
    },
    {
      name: 'Learn Shadow — Pathways',
      slug: 'learn-shadow/pathways',
      templatePath: `${SHADOW_TEMPLATE_PREFIX}pathways-page.html`,
      tableEnvVar: 'HUBDB_PATHWAYS_TABLE_ID'
    },
    {
      name: 'Learn Shadow — My Learning',
      slug: 'learn-shadow/my-learning',
      templatePath: `${SHADOW_TEMPLATE_PREFIX}my-learning.html`,
      tableEnvVar: 'HUBDB_MODULES_TABLE_ID'
    },
    {
      name: 'Learn Shadow — Register',
      slug: 'learn-shadow/register',
      templatePath: `${SHADOW_TEMPLATE_PREFIX}register.html`,
      tableEnvVar: 'STATIC'
    },
    {
      name: 'Learn Shadow — Action Runner',
      slug: 'learn-shadow/action-runner',
      templatePath: `${SHADOW_TEMPLATE_PREFIX}action-runner.html`,
      tableEnvVar: 'STATIC'
    }
  ];

  const results: PageResult[] = [];

  for (const config of pageConfigs) {
    const isStatic = config.tableEnvVar === 'STATIC';
    const tableId = isStatic ? 'STATIC' : (process.env[config.tableEnvVar] || '');
    if (!tableId && !dryRun) {
      console.error(`✗ ${config.tableEnvVar} not set in env. Skipping ${config.name}.`);
      continue;
    }
    const result = await createOrUpdatePage(config, tableId, dryRun, publish, allowCreate);
    if (result) results.push(result);
    if (!dryRun) await sleep(1000);
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Shadow Page Provisioning Summary');
  console.log('='.repeat(60));
  for (const r of results) {
    console.log(`\n  ${r.name}`);
    console.log(`    Slug:  ${r.slug}`);
    console.log(`    ID:    ${r.id}`);
    console.log(`    State: ${r.state}`);
    if (r.url) console.log(`    URL:   ${r.url}`);
  }
  console.log('\n✅ Shadow page provisioning complete!\n');
  if (!dryRun && !publish && results.length > 0) {
    console.log('💡 Pages are in DRAFT. Run with --publish to publish them.\n');
  }
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const publish = args.includes('--publish');
const allowCreate = args.includes('--allow-create');

provisionShadowPages(dryRun, publish, allowCreate).catch(err => {
  console.error('❌ Shadow page provisioning failed:', err.message);
  process.exit(1);
});
