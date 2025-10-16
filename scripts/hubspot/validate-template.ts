#!/usr/bin/env ts-node
import 'dotenv/config';
import { readFileSync } from 'fs';
import { getHubSpotToken, maskToken } from './get-hubspot-token.js';

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  const long = process.argv.find(a => a.startsWith(flag + '='));
  if (long) return long.split('=').slice(1).join('=');
  return undefined;
}

async function validate(path: string, content: Uint8Array, env: 'draft'|'published', token: string) {
  const url = `https://api.hubapi.com/cms/v3/source-code/${env}/validate/${encodeURIComponent(path)}`;
  const form = new FormData();
  form.append('file', new Blob([content as BlobPart], { type: 'application/octet-stream' }), path.split('/').pop() || 'file');
  const res = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Validation failed: HTTP ${res.status} ${text}`);
  }
  console.log('✓ Validation succeeded:', text || '(no body)');
}

async function main(){
  const token = getHubSpotToken();
  const path = getArg('--path');
  const local = getArg('--local');
  const env = (getArg('--env') as 'draft'|'published') || 'published';
  if (!path) {
    console.error('Usage: validate-template --path "CLEAN x HEDGEHOG/templates/..." [--local clean-x-hedgehog-templates/...] [--env draft|published]');
    process.exit(2);
  }
  let content: Uint8Array;
  if (local) content = new Uint8Array(readFileSync(local));
  else {
    // fetch current draft bytes
    const url = `https://api.hubapi.com/cms/v3/source-code/draft/content/${encodeURIComponent(path)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/octet-stream' } });
    if (!res.ok) throw new Error(`Failed to fetch draft content: HTTP ${res.status}`);
    content = new Uint8Array(await res.arrayBuffer());
  }
  console.log(`🔍 Validating asset\n  Path: ${path}\n  Env: ${env}\n  Local: ${local || '(draft bytes)'}\n  Token: ${maskToken(token)}`);
  await validate(path, content, env, token);
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });

