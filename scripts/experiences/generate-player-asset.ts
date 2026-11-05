#!/usr/bin/env ts-node
/**
 * generate-player-asset — reproducibly build the shipped browser IIFE
 * clean-x-hedgehog-templates/assets/js/experience-player.js from the shared
 * TypeScript sources (player-core + player-view + entry).
 *
 * The browser asset is NOT a hand-maintained reimplementation: it is generated from
 * the same `player-core` that the jest unit tests exercise, so the tested logic and
 * the shipped logic cannot drift. Regeneration is deterministic (no timestamps/random).
 *
 * Usage: npx ts-node scripts/experiences/generate-player-asset.ts [--check]
 *   --check : exit non-zero if the on-disk asset differs from a fresh generation
 *             (used in CI to prove the committed asset is reproducible).
 */
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

// Script is invoked from the repo root (npm script / CI), so anchor on cwd —
// avoids __dirname/import.meta ambiguity under ts-node's ESM loader.
const ROOT = process.cwd();
const OUT = path.join(ROOT, 'clean-x-hedgehog-templates/assets/js/experience-player.js');

// Order matters: dependencies before dependents (core -> view -> entry).
const SOURCES = [
  'src/experiences/player-core.ts',
  'src/experiences/player-view.ts',
  'src/experiences/browser/experience-player.entry.ts',
];

/** Transpile one TS file to JS and strip module import/export syntax for concatenation. */
function transpileAndStrip(absPath: string): string {
  const src = fs.readFileSync(absPath, 'utf8');
  const out = ts.transpileModule(src, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2019,
      module: ts.ModuleKind.ESNext,
      removeComments: false,
      newLine: ts.NewLineKind.LineFeed,
    },
  }).outputText;

  return out
    .split('\n')
    .filter((line) => !/^\s*import\b/.test(line)) // drop `import ... from '...'`
    .filter((line) => !/^\s*export\s*\{/.test(line)) // drop `export { ... };`
    .map((line) => line.replace(/^(\s*)export\s+/, '$1')) // `export function`/`export const` -> local
    .join('\n');
}

function generate(): string {
  const body = SOURCES.map((rel) => transpileAndStrip(path.join(ROOT, rel))).join('\n');
  return (
    '/* hhl-exp v1 — GENERATED from src/experiences by scripts/experiences/generate-player-asset.ts. Do not edit by hand. */\n' +
    "(function () {\n'use strict';\n" +
    body +
    '\n})();\n'
  );
}

function main(): void {
  const generated = generate();
  const check = process.argv.includes('--check');
  if (check) {
    const current = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
    if (current !== generated) {
      console.error('✗ experience-player.js is out of date. Run: npx ts-node scripts/experiences/generate-player-asset.ts');
      process.exit(1);
    }
    console.log('✓ experience-player.js matches a fresh generation (reproducible).');
    return;
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, generated, 'utf8');
  console.log(`✓ wrote ${path.relative(ROOT, OUT)} (${generated.length} bytes)`);
}

main();
