#!/usr/bin/env ts-node
/**
 * Publish constants.json from DRAFT to PUBLISHED in HubSpot Design Manager
 *
 * Uses the CMS Source Code v3 API to publish design manager assets
 *
 * Usage: npm run build && node dist/scripts/hubspot/publish-constants.js
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { getHubSpotToken, maskToken } from './get-hubspot-token.js';

const HUBSPOT_TOKEN = getHubSpotToken();
const CONSTANTS_PATH = 'CLEAN x HEDGEHOG/templates/config/constants.json';

async function publishConstants() {
  console.log('🚀 Publishing constants.json to HubSpot...\n');
  console.log(`🔐 Using HubSpot token: ${maskToken(HUBSPOT_TOKEN)}`);
  console.log(`📄 File path: ${CONSTANTS_PATH}\n`);

  try {
    // Strategy: push local constants.json directly to PUBLISHED environment.
    // This avoids 404 when DRAFT asset is missing and mirrors the manual validated step we used.
    const localPath = 'clean-x-hedgehog-templates/config/constants.json';
    const fileBuf = readFileSync(localPath);

    const validateUrl = `https://api.hubapi.com/cms/v3/source-code/published/validate/${encodeURIComponent(CONSTANTS_PATH)}`;
    const draftUrl = `https://api.hubapi.com/cms/v3/source-code/draft/content/${encodeURIComponent(CONSTANTS_PATH)}`;
    const pubUrl = `https://api.hubapi.com/cms/v3/source-code/published/content/${encodeURIComponent(CONSTANTS_PATH)}`;

    const form = new FormData();
    form.append('file', new Blob([fileBuf], { type: 'application/json' }), 'constants.json');

    // 0) Validate (against published by default to resolve live deps)
    let res = await fetch(validateUrl, { method: 'POST', headers: { 'Authorization': `Bearer ${HUBSPOT_TOKEN}` }, body: form });
    if (!res.ok) {
      const errorText = await res.text();
      try {
        const j = JSON.parse(errorText);
        const isTemplateValidation = j?.errorType === 'TEMPLATE_VALIDATION_FAILED' && Array.isArray(j?.errors);
        if (isTemplateValidation) {
          const nonDeprecated = j.errors.filter((e: any) => e?.errorTokens?.category?.[0] !== 'DEPRECATED_HUBL_PROPERTY');
          if (nonDeprecated.length === 0) {
            console.warn('⚠️ Validation warnings (deprecated only) on constants; continuing.');
          } else {
            throw new Error(`Validation failed HTTP ${res.status}: ${errorText}`);
          }
        } else {
          throw new Error(`Validation failed HTTP ${res.status}: ${errorText}`);
        }
      } catch {
        throw new Error(`Validation failed HTTP ${res.status}: ${errorText}`);
      }
    }

    // 1) Upload to DRAFT to keep DM in sync so get_asset_url can resolve
    res = await fetch(draftUrl, { method: 'PUT', headers: { 'Authorization': `Bearer ${HUBSPOT_TOKEN}` }, body: form });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Draft upload failed HTTP ${res.status}: ${errorText}`);
    }

    // 2) Upload to PUBLISHED (equivalent to clicking Publish)
    res = await fetch(pubUrl, { method: 'PUT', headers: { 'Authorization': `Bearer ${HUBSPOT_TOKEN}` }, body: form });
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Published upload failed HTTP ${res.status}: ${errorText}`);
    }

    const result = await res.json().catch(() => ({} as any));

    console.log('✅ Successfully uploaded constants.json to PUBLISHED environment.');
    // Optional metadata from API, fallback to defaults if not present
    const updatedAt = (result as any).updatedAt || new Date().toISOString();
    const path = (result as any).path || CONSTANTS_PATH;
    console.log(`   Published at: ${updatedAt}`);
    console.log(`   Path: ${path}\n`);

    return result as any;
  } catch (err: any) {
    console.error('❌ Failed to publish constants.json:', err.message);
    if (err.body) {
      console.error('   Error details:', err.body);
    }
    throw err;
  }
}

publishConstants().catch(err => {
  console.error('Script failed:', err.message);
  process.exit(1);
});
