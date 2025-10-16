#!/usr/bin/env ts-node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const fs_1 = require("fs");
const path_1 = require("path");
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
async function fetchContent(path, env, token) {
    const url = `https://api.hubapi.com/cms/v3/source-code/${env}/content/${encodeURIComponent(path)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/octet-stream' } });
    if (!res.ok)
        throw new Error(`Fetch failed ${env}:${path} HTTP ${res.status} ${await res.text()}`);
    return new Uint8Array(await res.arrayBuffer());
}
async function main() {
    const path = getArg('--path');
    const env = getArg('--env') || 'published';
    const out = getArg('--out');
    if (!path || !out) {
        console.error('Usage: fetch-template --path "CLEAN x HEDGEHOG/templates/..." --out clean-x-hedgehog-templates/... [--env draft|published]');
        process.exit(2);
    }
    const token = (0, get_hubspot_token_js_1.getHubSpotToken)();
    console.log(`🔽 Fetching ${env} content\n  Path: ${path}\n  Out: ${out}\n  Token: ${(0, get_hubspot_token_js_1.maskToken)(token)}`);
    const bytes = await fetchContent(path, env, token);
    (0, fs_1.mkdirSync)((0, path_1.dirname)(out), { recursive: true });
    (0, fs_1.writeFileSync)(out, bytes);
    console.log('✅ Wrote', out);
}
main().catch(err => { console.error('❌', err.message); process.exit(1); });
