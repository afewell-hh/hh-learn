#!/usr/bin/env node
/**
 * build-compare-payload.mjs — assemble the inline JSON payload the compare renderer consumes.
 *
 *   node scripts/build-compare-payload.mjs <module-dir> <interactive-id> > payload.json
 *
 * Reads interactives.json and the two src files of a `compare` interactive and prints
 * { interactive, texts: { left, right } }. Read-only; no network; uploads nothing.
 * Refuses (exit 1) if the declaration fails the shared integrity rules, so a payload that the
 * renderer would reject is never produced. `<` is escaped so the JSON can sit in a <script> tag.
 */
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readConfined } from './lib/confined-read.mjs';

const require = createRequire(import.meta.url);
const { checkCompare } = require('../clean-x-hedgehog-templates/assets/js/compare.js');

export async function buildPayload(moduleDir, id) {
  const dir = resolve(moduleDir);
  const doc = JSON.parse(await readFile(join(dir, 'interactives.json'), 'utf-8'));
  const interactive = (doc.interactives || []).find((i) => i.id === id && i.type === 'compare');
  if (!interactive) throw new Error(`no compare interactive "${id}" in ${dir}/interactives.json`);
  const texts = {};
  for (const name of ['left', 'right']) {
    const src = interactive[name]?.src;
    try { texts[name] = await readConfined(dir, src); }
    catch (e) { throw new Error(`${name}.src "${src}": ${e.message}`); }
  }
  const problems = checkCompare(interactive, texts).filter((p) => p.level === 'error');
  if (problems.length) throw new Error(problems.map((p) => `${p.code}: ${p.message}`).join('\n'));
  return { interactive, texts };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const [dir, id] = process.argv.slice(2);
  if (!dir || !id) { console.error('usage: build-compare-payload.mjs <module-dir> <interactive-id>'); process.exit(2); }
  buildPayload(dir, id)
    .then((p) => { process.stdout.write(JSON.stringify(p).replace(/</g, '\\u003c') + '\n'); })
    .catch((e) => { console.error(e.message); process.exit(1); });
}
