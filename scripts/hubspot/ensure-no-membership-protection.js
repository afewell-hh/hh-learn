#!/usr/bin/env node
'use strict';

// Ensure /learn pages are not protected by HubSpot Membership gating.
// Dry-run by default; pass --apply to update pages.

const HUBSPOT_TOKEN =
  process.env.HUBSPOT_PRIVATE_APP_TOKEN ||
  process.env.HUBSPOT_API_TOKEN ||
  process.env.HUBSPOT_PROJECT_ACCESS_TOKEN;

if (!HUBSPOT_TOKEN) {
  console.error('Missing HubSpot token. Set HUBSPOT_PRIVATE_APP_TOKEN or HUBSPOT_API_TOKEN.');
  process.exit(1);
}

const APPLY = process.argv.includes('--apply');
const LEARN_PREFIX = process.env.LEARN_SLUG_PREFIX || 'learn/';

async function hubspotFetch(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${HUBSPOT_TOKEN}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HubSpot API error ${res.status}: ${body}`);
  }

  return res.json();
}

async function listLearnPages() {
  const pages = [];
  let after = undefined;

  do {
    const params = new URLSearchParams({ limit: '100', archived: 'false' });
    if (after) params.set('after', after);
    const url = `https://api.hubapi.com/cms/v3/pages/site-pages?${params.toString()}`;
    const data = await hubspotFetch(url);

    for (const page of data.results || []) {
      if (page.slug && page.slug.startsWith(LEARN_PREFIX)) {
        pages.push(page);
      }
    }

    after = data.paging && data.paging.next ? data.paging.next.after : undefined;
  } while (after);

  return pages;
}

async function ensurePageUnprotected(page) {
  const membershipAccess = page.membershipAccess ?? null;
  const needsUpdate = membershipAccess !== null;

  if (!needsUpdate) {
    console.log(`OK: ${page.slug} (no membership access)`);
    return;
  }

  console.log(`FOUND: ${page.slug} has membershipAccess=${JSON.stringify(membershipAccess)}`);

  if (!APPLY) {
    console.log('  dry-run: not updating (pass --apply to change)');
    return;
  }

  const url = `https://api.hubapi.com/cms/v3/pages/site-pages/${page.id}`;
  await hubspotFetch(url, {
    method: 'PATCH',
    body: JSON.stringify({ membershipAccess: null }),
  });

  console.log(`  updated: ${page.slug} membershipAccess cleared`);
}

async function main() {
  const pages = await listLearnPages();
  if (pages.length === 0) {
    console.log(`No pages found with prefix "${LEARN_PREFIX}"`);
    return;
  }

  for (const page of pages) {
    await ensurePageUnprotected(page);
  }
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
