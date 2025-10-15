#!/usr/bin/env ts-node
/**
 * Provision CMS pages for Courses and Pathways
 *
 * This script:
 * 1. Creates or updates two site pages via CMS Pages API
 * 2. Binds pages to HubDB tables using dynamicPageDataSourceType=HUBDB
 * 3. Creates pages in DRAFT state by default (use --publish to schedule publish)
 * 4. Idempotent: if page exists (by slug), PATCH the draft instead of creating duplicates
 *
 * Usage: npm run provision:pages [-- --dry-run] [-- --publish]
 */

import 'dotenv/config';
import { getHubSpotToken, allowlistOverrideEnabled } from './get-hubspot-token.js';
import { Client } from '@hubspot/api-client';

const hubspot = new Client({
  accessToken: getHubSpotToken()
});

interface PageConfig {
  name: string;
  slug: string;
  templatePath: string;
  tableEnvVar: string;
}

interface PageResult {
  name: string;
  slug: string;
  id: string;
  state: string;
  previewUrl?: string;
}

// Helper: Sleep for specified milliseconds
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper: Check if error is Cloudflare rate limiting
function isCloudflareBlock(err: any): boolean {
  if (err.code === 403 && typeof err.body === 'string') {
    return err.body.includes('Cloudflare') || err.body.includes('cf-ray');
  }
  return false;
}

// Helper: Check if error is rate limiting
function isRateLimitError(err: any): boolean {
  if (err.code === 429) return true;
  if (isCloudflareBlock(err)) return true;
  if (err.message && err.message.includes('rate limit')) return true;
  return false;
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

      // Don't retry if not a rate limit issue
      if (!isRateLimitError(err) && err.code !== 404) {
        throw err;
      }

      // Don't retry on last attempt
      if (attempt === maxRetries) {
        throw err;
      }

      // Calculate delay with exponential backoff: 2s, 4s, 8s, etc.
      const delayMs = initialDelayMs * Math.pow(2, attempt);

      if (isCloudflareBlock(err)) {
        console.log(`  ⏳ Cloudflare block detected, waiting ${delayMs/1000}s before retry ${attempt + 1}/${maxRetries}...`);
      } else {
        console.log(`  ⏳ Rate limit hit, waiting ${delayMs/1000}s before retry ${attempt + 1}/${maxRetries}...`);
      }

      await sleep(delayMs);
    }
  }

  throw lastError;
}

async function findPageBySlug(slug: string): Promise<any | null> {
  const token = getHubSpotToken();
  if (!token) {
    console.log('   ⚠️  No HUBSPOT_PRIVATE_APP_TOKEN set; cannot check for existing pages.');
    return null;
  }

  console.log(`   Searching for existing page with slug: ${slug}`);

  // Prefer search endpoint; fall back to list+filter if unavailable
  const base = 'https://api.hubapi.com';

  // Helper for retries on rate limits/Cloudflare
  async function httpRetry<T>(fn: () => Promise<T>) {
    return retryWithBackoff(fn, 3, 1500);
  }

  try {
    // Attempt CMS Pages search by slug
    const searchBody = {
      filters: [
        { propertyName: 'slug', operator: 'EQ', value: slug }
      ],
      limit: 10
    } as any;

    const searchRes: any = await httpRetry(async () => {
      const res = await fetch(`${base}/cms/v3/pages/site-pages/search`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(searchBody)
      });
      if (!res.ok) {
        const text = await res.text();
        const err: any = new Error(`HTTP ${res.status}: ${text}`);
        err.code = res.status;
        err.body = text;
        throw err;
      }
      return res.json();
    });

    const results = (searchRes?.results ?? []) as any[];
    const found = results.find(r => r.slug === slug) || null;
    if (found) return found;
  } catch (err: any) {
    // Fall through to list+filter approach
    const hint = err?.message || String(err);
    console.log(`   ↪︎ Search endpoint not available or failed (${hint}). Falling back to list.`);
  }

  try {
    // Fallback: list pages and filter client-side (paginate up to a few pages)
    let after: string | undefined = undefined;
    for (let i = 0; i < 5; i++) {
      const url = new URL(`${base}/cms/v3/pages/site-pages`);
      url.searchParams.set('limit', '100');
      if (after) url.searchParams.set('after', after);

      const listRes: any = await httpRetry(async () => {
        const res = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        });
        if (!res.ok) {
          const text = await res.text();
          const err: any = new Error(`HTTP ${res.status}: ${text}`);
          err.code = res.status;
          err.body = text;
          throw err;
        }
        return res.json();
      });

      const results = (listRes?.results ?? listRes ?? []) as any[];
      const found = results.find((r: any) => r.slug === slug);
      if (found) return found;

      after = listRes?.paging?.next?.after;
      if (!after) break;
    }
  } catch (err: any) {
    console.error(`Error listing pages:`, err.message || err);
  }

  return null;
}

// New helpers: robust page lookup to avoid duplicate creation
async function findPagesBySlugPrefix(slug: string): Promise<any[]> {
  const results: any[] = [];
  let after: string | undefined = undefined;
  const token = getHubSpotToken();
  const baseUrl = 'https://api.hubapi.com/cms/v3/pages/site-pages';
  while (true) {
    const params = new URLSearchParams({ limit: '100', archived: 'false', 'slug__icontains': slug });
    if (after) params.set('after', after);
    const url = `${baseUrl}?${params.toString()}`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Pages API list failed: ${resp.status} ${text}`);
    }
    const data = await resp.json();
    results.push(...(data.results || []));
    after = (data.paging && data.paging.next && data.paging.next.after) || undefined;
    if (!after) break;
  }
  return results.filter(p => typeof p.slug === 'string' && (p.slug === slug || p.slug.startsWith(`${slug}-`)));
}

async function findPrimaryPageBySlug(slug: string): Promise<any | null> {
  try {
    console.log(`   Searching for existing page(s) with slug prefix: ${slug}`);
    const pages = await findPagesBySlugPrefix(slug);
    if (!pages.length) return null;
    const exact = pages.find(p => p.slug === slug);
    if (exact) return exact;
    pages.sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
    return pages[0];
  } catch (err: any) {
    console.error(`Error finding page with slug \"${slug}\":`, err.message);
    return null;
  }
}

// Helper: Validate template existence via Source Code API
async function validateTemplateExists(templatePath: string): Promise<boolean> {
  let token: string;
  try {
    token = getHubSpotToken();
  } catch (err) {
    console.log('   ⚠️  No HubSpot token available; cannot validate template.');
    return false;
  }

  try {
    console.log(`   Validating template: ${templatePath}`);

    // Use v3 Source Code API to check if template exists in draft
    const base = 'https://api.hubapi.com';

    const response = await retryWithBackoff(async () => {
      const res = await fetch(
        `${base}/cms/v3/source-code/draft/metadata/${encodeURIComponent(templatePath)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
          }
        }
      );

      // 200 = exists, 404 = not found
      if (res.status === 200) {
        return { exists: true };
      } else if (res.status === 404) {
        return { exists: false };
      } else {
        const text = await res.text();
        const err: any = new Error(`HTTP ${res.status}: ${text}`);
        err.code = res.status;
        err.body = text;
        throw err;
      }
    });

    return response.exists;
  } catch (err: any) {
    console.error(`   Error validating template "${templatePath}":`, err.message);
    return false;
  }
}

// Helper: Check for common misnamed template paths
async function checkForMisnamedTemplates(dryRun: boolean = false): Promise<void> {
  const commonMispaths = [
    'CLEAN x HEDGEHOG/templates/learn/courses/courses-page.html',
    'CLEAN x HEDGEHOG/templates/learn/pathways/pathways-page.html'
  ];

  for (const mispath of commonMispaths) {
    const exists = await validateTemplateExists(mispath);
    if (exists) {
      console.log(`   🚩 RED FLAG: Found incorrectly nested template at "${mispath}"`);
      console.log(`      This template should be deleted or moved to remove nested folder structure.`);
      if (!dryRun) {
        console.log(`      Pages will not be updated until duplicate templates are resolved.`);
      }
    }
  }
}

async function createOrUpdatePage(
  config: PageConfig,
  tableId: string,
  dryRun: boolean = false,
  publish: boolean = false
): Promise<PageResult | null> {
  // Guardrails: allow only expected templates/slugs unless override is enabled
  const override = allowlistOverrideEnabled();
  const ALLOWED_SLUGS = new Set(['learn','learn/modules','learn/courses','learn/pathways','learn/my-learning']);
  const ALLOWED_TEMPLATE_PREFIX = 'CLEAN x HEDGEHOG/templates/learn/';

  if (!override) {
    if (!ALLOWED_SLUGS.has(config.slug)) {
      console.log(`\n📄 Page: ${config.name}`);
      console.log(`   Slug: ${config.slug}`);
      console.log('   ❌ Guardrail blocked: slug outside allowlist.');
      console.log('      Use --unsafe-allow-outside-allowlist (or ALLOWLIST_OVERRIDE=true) if absolutely necessary.');
      return null;
    }
    if (!config.templatePath.startsWith(ALLOWED_TEMPLATE_PREFIX)) {
      console.log(`\n📄 Page: ${config.name}`);
      console.log(`   Template: ${config.templatePath}`);
      console.log('   ❌ Guardrail blocked: template path outside allowlist.');
      console.log('      Use --unsafe-allow-outside-allowlist (or ALLOWLIST_OVERRIDE=true) if absolutely necessary.');
      return null;
    }
  }

  // Validate template exists before attempting to create/update page
  if (!dryRun) {
    const templateExists = await validateTemplateExists(config.templatePath);
    if (!templateExists) {
      console.log(`\n📄 Page: ${config.name}`);
      console.log(`   Slug: ${config.slug}`);
      console.log(`   ❌ ERROR: Template not found at "${config.templatePath}"`);
      console.log(`   Skipping page creation/update to prevent misconfiguration.`);
      console.log(`   Please verify the template exists in Design Manager.`);
      return null;
    }
  }

  const existingPage = await findPrimaryPageBySlug(config.slug);

  // Dynamic page data source type enum: HUBDB = 1
  const pagePayload = {
    name: config.name,
    slug: config.slug,
    templatePath: config.templatePath,
    dynamicPageDataSourceType: 1, // HUBDB
    dynamicPageDataSourceId: parseInt(tableId, 10),
    state: 'DRAFT',
    ...(publish && {
      publishImmediately: true,
      publicAccessRulesEnabled: false
    })
  };

  if (dryRun) {
    console.log(`\n📄 Page: ${config.name}`);
    console.log(`   Slug: ${config.slug}`);
    if (existingPage) {
      console.log('   Action: UPDATE (page exists)');
      console.log(`   Target ID: ${existingPage.id} (slug: ${existingPage.slug})`);
    } else {
      console.log('   Action: CREATE (no existing page found)');
    }
    console.log('   Payload:');
    console.log(JSON.stringify(pagePayload, null, 2));
    return {
      name: config.name,
      slug: config.slug,
      id: existingPage?.id || '<would-be-created>',
      state: publish ? 'PUBLISHED' : 'DRAFT'
    };
  }

  try {
    let page: any;

    if (existingPage) {
      // Update existing page
      console.log(`📝 Updating page: ${config.name} (ID: ${existingPage.id})`);
      page = await retryWithBackoff(() =>
        hubspot.cms.pages.sitePagesApi.update(
          String(existingPage.id),
          pagePayload as any
        )
      );
      console.log(`   ✓ Page updated`);
    } else {
      // Respect update-only default to prevent duplicate pages.
      const allowCreate = process.argv.includes('--allow-create') || process.env.ALLOW_CREATE_PAGES === 'true';
      if (!allowCreate) {
        console.log(`   ⚠️  Skipping CREATE for ${config.name}: creation disabled to prevent duplicates. Use --allow-create to create once.`);
        return {
          name: config.name,
          slug: config.slug,
          id: '<skipped-create>',
          state: 'SKIPPED'
        };
      }
      console.log(`📝 Creating page: ${config.name}`);
      page = await retryWithBackoff(() =>
        hubspot.cms.pages.sitePagesApi.create(pagePayload as any)
      );
      console.log(`   ✓ Page created with ID: ${page.id}`);
    }

    // Optionally schedule immediate publish
    if (publish && page.state !== 'PUBLISHED') {
      console.log(`📤 Scheduling page for publish: ${config.name}`);
      try {
        // Note: API client typing may be incomplete; schedule method exists but may need manual implementation
        const api: any = hubspot.cms.pages.sitePagesApi;
        await retryWithBackoff(() =>
          api.schedule(String(page.id), String(page.id))
        );
        console.log(`   ✓ Page scheduled for publish`);
      } catch (err: any) {
        console.log(`   ⚠️  Auto-publish failed: ${err.message}. Publish manually in CMS editor.`);
      }
    }

    return {
      name: config.name,
      slug: config.slug,
      id: String(page.id),
      state: publish ? 'PUBLISHED' : 'DRAFT',
      previewUrl: page.url || undefined
    };
  } catch (err: any) {
    console.error(`✗ Failed to provision page "${config.name}":`, err.message);
    if (err.body) {
      console.error('   Error details:', JSON.stringify(err.body, null, 2));
    }
    return null;
  }
}

async function provisionPages(dryRun: boolean = false, publish: boolean = false) {
  console.log('🔄 Starting CMS page provisioning...\n');

  if (dryRun) {
    console.log('📝 DRY RUN MODE - no changes will be made\n');
  }

  if (publish && !dryRun) {
    console.log('🚀 PUBLISH MODE - pages will be published immediately\n');
  }

  if (!dryRun) {
    try {
      getHubSpotToken(); // This will throw if no token is available
    } catch (err: any) {
      throw new Error(err.message);
    }
  }

  // Check for common misnamed templates
  console.log('🔍 Checking for common template path issues...\n');
  await checkForMisnamedTemplates(dryRun);
  console.log('');

  const pageConfigs: PageConfig[] = [
    {
      name: 'Learn',
      slug: 'learn',
      templatePath: 'CLEAN x HEDGEHOG/templates/learn/catalog.html',
      tableEnvVar: 'HUBDB_CATALOG_TABLE_ID'
    },
    {
      name: 'Modules',
      slug: 'learn/modules',
      templatePath: 'CLEAN x HEDGEHOG/templates/learn/module-page.html',
      tableEnvVar: 'HUBDB_MODULES_TABLE_ID'
    },
    {
      name: 'Courses',
      slug: 'learn/courses',
      templatePath: 'CLEAN x HEDGEHOG/templates/learn/courses-page.html',
      tableEnvVar: 'HUBDB_COURSES_TABLE_ID'
    },
    {
      name: 'Pathways',
      slug: 'learn/pathways',
      templatePath: 'CLEAN x HEDGEHOG/templates/learn/pathways-page.html',
      tableEnvVar: 'HUBDB_PATHWAYS_TABLE_ID'
    },
    {
      name: 'My Learning',
      slug: 'learn/my-learning',
      templatePath: 'CLEAN x HEDGEHOG/templates/learn/my-learning.html',
      tableEnvVar: 'HUBDB_MODULES_TABLE_ID'
    }
  ];

  const results: PageResult[] = [];

  for (const config of pageConfigs) {
    try {
      const tableId = process.env[config.tableEnvVar];

      if (!tableId && !dryRun) {
        console.error(`✗ ${config.tableEnvVar} environment variable not set. Skipping ${config.name}.`);
        continue;
      }

      const result = await createOrUpdatePage(
        config,
        tableId || '<table-id-required>',
        dryRun,
        publish
      );

      if (result) {
        results.push(result);
      }

      // Small delay between pages
      if (!dryRun) {
        await sleep(1000);
      }
    } catch (err: any) {
      console.error(`✗ Failed to process page "${config.name}":`, err.message);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 Page Provisioning Summary');
  console.log('='.repeat(60));

  results.forEach((result) => {
    console.log(`\nPage: ${result.name}`);
    console.log(`  Slug: ${result.slug}`);
    console.log(`  ID: ${result.id}`);
    console.log(`  State: ${result.state}`);
    if (result.previewUrl) {
      console.log(`  URL: ${result.previewUrl}`);
    }
  });

  console.log('\n✅ Page provisioning complete!\n');

  if (!dryRun && !publish && results.length > 0) {
    console.log('💡 Pages created in DRAFT state. To publish, run with --publish flag.\n');
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const publish = args.includes('--publish');

// Run provisioning
provisionPages(dryRun, publish).catch(err => {
  console.error('❌ Provisioning failed:', err);
  process.exit(1);
});
