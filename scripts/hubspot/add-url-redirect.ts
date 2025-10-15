#!/usr/bin/env ts-node
/**
 * Create a URL redirect in HubSpot via the CMS URL Redirects v3 API.
 * Docs: https://developers.hubspot.com/docs/api-reference/cms-url-redirects-v3/redirects (2025-08-22)
 *
 * Usage:
 *   npm run build && node dist/scripts/hubspot/add-url-redirect.js --from "/learn/catalog" --to "/learn" [--permanent] [--dry-run]
 *
 * Notes:
 * - Uses project access token if available, else private app token.
 * - Creates a standard 301 redirect by default (use --permanent to set 301 explicitly).
 */
import 'dotenv/config';
import { getHubSpotToken, maskToken } from './get-hubspot-token.js';

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i >= 0 && i + 1 < process.argv.length) return process.argv[i + 1];
  const eq = process.argv.find(a => a.startsWith(name + '='));
  return eq ? eq.split('=').slice(1).join('=') : fallback;
}

async function createRedirect(fromPath: string, toPath: string, permanent: boolean, dryRun: boolean) {
  const token = getHubSpotToken();
  const base = 'https://api.hubapi.com';

  const body = {
    isTrailingSlashOptional: true,
    isMatchQueryString: true,
    redirectStyle: permanent ? 301 : 302,
    routePrefix: fromPath,
    isMatchFullUrl: false,
    isProtocolAgnostic: true,
    destination: toPath,
    isOnlyAfterNotFound: false,
    isPattern: false,
    precedence: 1
  } as const;

  if (dryRun) {
    console.log('📝 DRY RUN – would create URL redirect with body:');
    console.log(JSON.stringify(body, null, 2));
    return;
  }

  const res = await fetch(`${base}/cms/v3/url-redirects/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Redirect create failed: HTTP ${res.status} ${text}`);
  }

  const json = await res.json();
  console.log('✅ Redirect created:', json);
}

async function main() {
  const from = arg('--from');
  const to = arg('--to');
  const permanent = process.argv.includes('--permanent');
  const dryRun = process.argv.includes('--dry-run');

  if (!from || !to) {
    console.error('Usage: add-url-redirect --from "/from" --to "/to" [--permanent] [--dry-run]');
    process.exit(2);
  }

  console.log(`🔐 Using HubSpot token: ${maskToken(process.env.HUBSPOT_PROJECT_ACCESS_TOKEN || process.env.HUBSPOT_PRIVATE_APP_TOKEN || '')}`);
  console.log(`➡️  Redirect: ${from} -> ${to} (${permanent ? '301' : '302'})`);

  await createRedirect(from, to, permanent, dryRun);
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
