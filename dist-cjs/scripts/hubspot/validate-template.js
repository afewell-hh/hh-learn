#!/usr/bin/env ts-node
"use strict";
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
async function validate(path, content, env, token) {
    const url = `https://api.hubapi.com/cms/v3/source-code/${env}/validate/${encodeURIComponent(path)}`;
    const form = new FormData();
    form.append('file', new Blob([content], { type: 'application/octet-stream' }), path.split('/').pop() || 'file');
    const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    const text = await res.text();
    if (!res.ok) {
        throw new Error(`Validation failed: HTTP ${res.status} ${text}`);
    }
    console.log('✓ Validation succeeded:', text || '(no body)');
}
async function main() {
    const token = (0, get_hubspot_token_js_1.getHubSpotToken)();
    const path = getArg('--path');
    const local = getArg('--local');
    const env = getArg('--env') || 'published';
    if (!path) {
        console.error('Usage: validate-template --path "CLEAN x HEDGEHOG/templates/..." [--local clean-x-hedgehog-templates/...] [--env draft|published]');
        process.exit(2);
    }
    let content;
    if (local)
        content = new Uint8Array((0, fs_1.readFileSync)(local));
    else {
        // fetch current draft bytes
        const url = `https://api.hubapi.com/cms/v3/source-code/draft/content/${encodeURIComponent(path)}`;
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/octet-stream' } });
        if (!res.ok)
            throw new Error(`Failed to fetch draft content: HTTP ${res.status}`);
        content = new Uint8Array(await res.arrayBuffer());
    }
    console.log(`🔍 Validating asset\n  Path: ${path}\n  Env: ${env}\n  Local: ${local || '(draft bytes)'}\n  Token: ${(0, get_hubspot_token_js_1.maskToken)(token)}`);
    await validate(path, content, env, token);
}
main().catch(err => { console.error('❌', err.message); process.exit(1); });
