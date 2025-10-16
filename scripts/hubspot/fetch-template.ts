#!/usr/bin/env ts-node
import 'dotenv/config';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { getHubSpotToken, maskToken } from './get-hubspot-token.js';

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  const long = process.argv.find(a => a.startsWith(flag + '='));
  if (long) return long.split('=').slice(1).join('=');
  return undefined;
}

async function fetchContent(path: string, env: 'draft'|'published', token: string): Promise<Uint8Array> {
  const url = `https://api.hubapi.com/cms/v3/source-code/${env}/content/${encodeURIComponent(path)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/octet-stream' } });
  if (!res.ok) throw new Error(`Fetch failed ${env}:${path} HTTP ${res.status} ${await res.text()}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function main(){
  const path = getArg('--path');
  const env = (getArg('--env') as 'draft'|'published') || 'published';
  const out = getArg('--out');
  if(!path || !out){
    console.error('Usage: fetch-template --path "CLEAN x HEDGEHOG/templates/..." --out clean-x-hedgehog-templates/... [--env draft|published]');
    process.exit(2);
  }
  const token = getHubSpotToken();
  console.log(`🔽 Fetching ${env} content\n  Path: ${path}\n  Out: ${out}\n  Token: ${maskToken(token)}`);
  const bytes = await fetchContent(path, env, token);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, bytes);
  console.log('✅ Wrote', out);
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });

