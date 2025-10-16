#!/usr/bin/env ts-node
"use strict";
/**
 * Publish a Design Manager asset (template/CSS/JS/etc.) to the PUBLISHED environment via the CMS Source Code v3 API.
 *
 * Why: Uploading to `published` is equivalent to clicking "Publish" in the Design Manager UI.
 * Reference: https://developers.hubspot.com/docs/reference/api/cms/templates (Source Code API)
 *
 * Usage examples:
 *   npm run build && node dist/scripts/hubspot/publish-template.js --path "CLEAN x HEDGEHOG/templates/learn/register.html" --local "clean-x-hedgehog-templates/learn/register.html"
 *   npm run build && node dist/scripts/hubspot/publish-template.js --path "CLEAN x HEDGEHOG/templates/assets/css/registration.css" --local "clean-x-hedgehog-templates/assets/css/registration.css"
 *
 * Notes:
 * - If --local is omitted, this script will attempt to publish the current DRAFT by downloading it and re-uploading to PUBLISHED.
 * - Prefer providing --local to ensure VCS is the source of truth.
 */
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fs_1 = require("fs");
const get_hubspot_token_js_1 = require("./get-hubspot-token.js");
function getArg(flag) {
    const idx = process.argv.indexOf(flag);
    if (idx !== -1 && idx + 1 < process.argv.length)
        return process.argv[idx + 1];
    const long = process.argv.find(a => a.startsWith(flag + '='));
    if (long)
        return long.split('=').slice(1).join('=');
    return undefined;
}
async function fetchDraftFile(path, token) {
    const url = `https://api.hubapi.com/cms/v3/source-code/draft/content/${encodeURIComponent(path)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/octet-stream' } });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Failed to fetch draft content for ${path}: HTTP ${res.status} ${text}`);
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    return buf;
}
async function uploadPublished(path, content, token) {
    const url = `https://api.hubapi.com/cms/v3/source-code/published/content/${encodeURIComponent(path)}`;
    const form = new FormData();
    form.append('file', new Blob([content], { type: 'application/octet-stream' }), path.split('/').pop() || 'file');
    const res = await fetch(url, { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: form });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Publish failed for ${path}: HTTP ${res.status} ${text}`);
    }
}
async function uploadDraft(path, content, token) {
    const url = `https://api.hubapi.com/cms/v3/source-code/draft/content/${encodeURIComponent(path)}`;
    const form = new FormData();
    form.append('file', new Blob([content], { type: 'application/octet-stream' }), path.split('/').pop() || 'file');
    const res = await fetch(url, { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body: form });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Draft upload failed for ${path}: HTTP ${res.status} ${text}`);
    }
}
async function validateAsset(path, content, token, env = 'published') {
    const url = `https://api.hubapi.com/cms/v3/source-code/${env}/validate/${encodeURIComponent(path)}`;
    const form = new FormData();
    form.append('file', new Blob([content], { type: 'application/octet-stream' }), path.split('/').pop() || 'file');
    const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    if (!res.ok) {
        const text = await res.text();
        try {
            const j = JSON.parse(text);
            const isTemplateValidation = j?.errorType === 'TEMPLATE_VALIDATION_FAILED' && Array.isArray(j?.errors);
            if (isTemplateValidation) {
                const nonDeprecated = j.errors.filter((e) => e?.errorTokens?.category?.[0] !== 'DEPRECATED_HUBL_PROPERTY');
                if (nonDeprecated.length === 0) {
                    console.warn(`⚠️ Validation warnings (deprecated only) for ${path} (${env}); continuing.`);
                    return;
                }
            }
        }
        catch { }
        throw new Error(`Validation failed for ${path} (${env}): HTTP ${res.status} ${text}`);
    }
}
async function main() {
    const path = getArg('--path');
    const local = getArg('--local');
    const validateEnv = getArg('--validate-env') || 'published';
    if (!path) {
        console.error('Usage: publish-template --path "CLEAN x HEDGEHOG/templates/..." [--local clean-x-hedgehog-templates/...] [--validate-env draft|published]');
        process.exit(2);
    }
    const token = (0, get_hubspot_token_js_1.getHubSpotToken)();
    console.log(`🚀 Publishing asset to PUBLISHED:\n  Path: ${path}\n  Local: ${local || '(draft → published)'}\n  Token: ${(0, get_hubspot_token_js_1.maskToken)(token)}\n`);
    let content;
    if (local) {
        const buf = (0, fs_1.readFileSync)(local);
        content = new Uint8Array(buf);
        // Validate against the chosen environment (default: published), then sync draft and publish
        await validateAsset(path, content, token, validateEnv);
        await uploadDraft(path, content, token);
    }
    else {
        content = await fetchDraftFile(path, token);
        await validateAsset(path, content, token, validateEnv);
    }
    await uploadPublished(path, content, token);
    console.log('✅ Publish complete. Live asset updated.');
}
main().catch(err => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
